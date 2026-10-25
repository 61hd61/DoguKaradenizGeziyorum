"""PostgreSQL baglanti yonetimi ve veri erisim katmani.

Surucu: pg8000 (saf Python DB-API 2.0 surucusu). Windows "Uygulama
Denetimi" politikasi psycopg2'nin ikili (DLL) bilesenlerini engelledigi
icin saf Python surucu tercih edildi; SQL ve paramstyle ('format', yani
%s) psycopg2 ile ayni oldugu icin gerekirse surucu degistirilebilir.

Mimari:
    DatabaseManager       -> baglanti yasam dongusu, cursor context'i,
                             sema ve ortam kontrolleri
    DestinasyonRepository -> yalnizca SQL; arayuzden tamamen bagimsiz

Tum sorgular parametrelidir (SQL injection'a kapali).
"""

from __future__ import annotations

import logging
import re
import ssl
import unicodedata
import uuid
from contextlib import contextmanager
from typing import Any, Dict, Iterator, List, Optional, Sequence

import pg8000.dbapi as pgdb

from app.config import DatabaseConfig
from app.models import Destinasyon, LookupItem, ILLER, VARSAYILAN_TURLER

logger = logging.getLogger(__name__)

TABLE_NAME = "trabzon_destinasyonlar"
WEB_DESTINATIONS = "destinations"


def _slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[-\s]+", "-", text).strip("-") or str(uuid.uuid4())[:8]


def _normalize_type_name(ad: str) -> str:
    """Legacy tur adlarini web semasindaki isimlere yaklastirir."""
    mapping = {
        "tarihi bina": "Tarihi Bina",
        "sivil mimari": "Sivil Mimari",
        "milli park": "Milli Park",
    }
    key = (ad or "").strip().lower()
    return mapping.get(key, ad.strip() if ad else ad)


def _normalize_image_paths(item: Destinasyon) -> List[str]:
    paths: List[str] = []
    for p in list(item.resim_yollari or []):
        if p and p not in paths:
            paths.append(p.replace("\\", "/"))
    if item.resim_yolu and item.resim_yolu not in paths:
        paths.insert(0, item.resim_yolu.replace("\\", "/"))
    return paths

# PostgreSQL hata kodlari
UNIQUE_VIOLATION = "23505"
CHECK_VIOLATION = "23514"

SSL_REQUIRED_MODES = {"require", "verify-ca", "verify-full"}


class DatabaseError(Exception):
    """Veritabani katmanindan arayuze tasinan kullanici dostu hata."""


class DuplicateNameError(DatabaseError):
    """Ayni il icinde ayni ada sahip destinasyon zaten var."""


class DuplicateTypeError(DatabaseError):
    """Ayni ada sahip destinasyon turu zaten var."""


def _error_code(exc: BaseException) -> Optional[str]:
    """pg8000 hatasindan SQLSTATE kodunu cikarir.

    pg8000, sunucu hatalarini args[0] icinde sozluk olarak tasir:
    {'S': 'ERROR', 'C': '23505', 'M': 'duplicate key ...'}
    """
    for arg in getattr(exc, "args", ()):
        if isinstance(arg, dict):
            code = arg.get("C")
            if code:
                return str(code)
    return None


def _error_message(exc: BaseException) -> str:
    for arg in getattr(exc, "args", ()):
        if isinstance(arg, dict):
            message = arg.get("M")
            if message:
                return str(message)
    return str(exc)


class DictCursor:
    """Satirlari sozluk olarak donduren ince cursor sarmalayicisi."""

    def __init__(self, cursor: Any) -> None:
        self._cursor = cursor

    # -- DB-API gecisleri ---------------------------------------------
    def execute(self, query: str, params: Optional[Sequence[Any]] = None) -> "DictCursor":
        # pg8000 parametre listesi olarak None kabul etmez; bos tuple beklenir
        self._cursor.execute(query, tuple(params) if params else ())
        return self

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount

    def close(self) -> None:
        self._cursor.close()

    # -- Sozluk donusumu ----------------------------------------------
    def _columns(self) -> List[str]:
        description = self._cursor.description or []
        columns: List[str] = []
        for column in description:
            name = column[0]
            columns.append(name.decode() if isinstance(name, bytes) else str(name))
        return columns

    def fetchone(self) -> Optional[Dict[str, Any]]:
        row = self._cursor.fetchone()
        return dict(zip(self._columns(), row)) if row is not None else None

    def fetchall(self) -> List[Dict[str, Any]]:
        columns = self._columns()
        return [dict(zip(columns, row)) for row in self._cursor.fetchall()]


class DatabaseManager:
    """Tek bir kalici baglantiyi yonetir (masaustu uygulamasi icin yeterli)."""

    def __init__(self, config: DatabaseConfig) -> None:
        self._config = config
        self._conn: Optional[Any] = None
        self._postgis_enabled = False
        self._server_version = "bilinmiyor"
        self._uses_web_schema = False

    # ------------------------------------------------------------------
    # Baglanti yasam dongusu
    # ------------------------------------------------------------------
    @property
    def config(self) -> DatabaseConfig:
        return self._config

    @property
    def is_connected(self) -> bool:
        return self._conn is not None

    @property
    def postgis_enabled(self) -> bool:
        return self._postgis_enabled

    @property
    def uses_web_schema(self) -> bool:
        return self._uses_web_schema

    def schema_ready(self) -> bool:
        """Panelin kullanabilecegi destinasyon tablosu mevcut mu?"""
        if self._uses_web_schema:
            return self.table_exists(WEB_DESTINATIONS)
        return self.table_exists(TABLE_NAME)

    def connect(self) -> None:
        """Baglantiyi acar; basarisiz olursa DatabaseError firlatir."""
        if self.is_connected:
            return

        sslmode = (self._config.sslmode or "prefer").lower()
        attempts: List[Optional[ssl.SSLContext]] = []
        if sslmode in SSL_REQUIRED_MODES:
            attempts.append(self._ssl_context(verify=sslmode != "require"))
        elif sslmode in {"prefer", "allow"}:
            attempts.extend([self._ssl_context(verify=False), None])
        else:  # disable
            attempts.append(None)

        last_error: Optional[BaseException] = None
        for ssl_context in attempts:
            try:
                self._conn = pgdb.connect(
                    user=self._config.user,
                    password=self._config.password or None,
                    host=self._config.host,
                    port=int(self._config.port),
                    database=self._config.dbname,
                    timeout=int(self._config.connect_timeout) or None,
                    ssl_context=ssl_context,
                    application_name="TurizmVeriPaneli",
                )
                self._conn.autocommit = False
                logger.info(
                    "Veritabanina baglandi: %s (ssl=%s)",
                    self._config.safe_summary(),
                    bool(ssl_context),
                )
                break
            except Exception as exc:  # pg8000 cesitli hata turleri firlatir
                last_error = exc
                self._conn = None

        if self._conn is None:
            raise DatabaseError(self._friendly_error(last_error)) from last_error

        self._postgis_enabled = self._detect_postgis()
        self._server_version = self._read_server_version()
        self._uses_web_schema = self.table_exists(WEB_DESTINATIONS)
        if self._uses_web_schema:
            logger.info("Web semasi (destinations) kullaniliyor; web haritasi ile senkron.")
        else:
            self.ensure_extended_schema()

    def close(self) -> None:
        if self._conn is not None:
            try:
                self._conn.close()
            except Exception:  # kapanis hatasi kullaniciyi ilgilendirmez
                logger.debug("Baglanti kapatilirken hata olustu.", exc_info=True)
            finally:
                self._conn = None
                self._uses_web_schema = False
                logger.info("Veritabani baglantisi kapatildi.")

    def reconnect(self, config: Optional[DatabaseConfig] = None) -> None:
        """Ayarlar degistiginde veya baglanti koptugunda yeniden baglanir."""
        self.close()
        if config is not None:
            self._config = config
        self.connect()

    # ------------------------------------------------------------------
    @contextmanager
    def cursor(self, commit: bool = False) -> Iterator[DictCursor]:
        """Sozluk donduren cursor saglar; hata halinde rollback yapar."""
        if self._conn is None:
            raise DatabaseError("Veritabani baglantisi yok. Once baglanti kurun.")

        cursor = DictCursor(self._conn.cursor())
        try:
            yield cursor
            if commit:
                self._conn.commit()
        except Exception:
            try:
                self._conn.rollback()
            except Exception:
                logger.debug("Rollback basarisiz.", exc_info=True)
            raise
        finally:
            cursor.close()

    # ------------------------------------------------------------------
    # Sema / ortam kontrolleri
    # ------------------------------------------------------------------
    def table_exists(self, table: str = TABLE_NAME) -> bool:
        try:
            with self.cursor() as cur:
                cur.execute("SELECT to_regclass(%s) AS oid;", (f"public.{table}",))
                row = cur.fetchone()
        except DatabaseError:
            raise
        except Exception as exc:
            raise DatabaseError(f"Sema kontrolu basarisiz: {_error_message(exc)}") from exc
        return bool(row and row["oid"])

    def ensure_extended_schema(self) -> None:
        """Il / tur tablolarini ve FK sutunlarini idempotent olarak olusturur.

        sql/ klasoru exe dagitiminda olmayabilir; bu yuzden sema Python icinde
        uygulanir. Mevcut kayitlar Trabzon + 'Tarihi bina' ile doldurulur.
        """
        if not self.table_exists():
            return
        try:
            with self.cursor(commit=True) as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS iller (
                        id SERIAL PRIMARY KEY,
                        ad VARCHAR(40) NOT NULL
                    );
                    """
                )
                cur.execute(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS uq_il_ad
                        ON iller (lower(btrim(ad)));
                    """
                )
                for ad in ILLER:
                    cur.execute(
                        "INSERT INTO iller (ad) VALUES (%s) ON CONFLICT DO NOTHING;",
                        (ad,),
                    )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS destinasyon_turleri (
                        id SERIAL PRIMARY KEY,
                        ad VARCHAR(80) NOT NULL,
                        olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        CONSTRAINT chk_tur_ad_bos CHECK (length(btrim(ad)) > 0)
                    );
                    """
                )
                cur.execute(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS uq_tur_ad
                        ON destinasyon_turleri (lower(btrim(ad)));
                    """
                )
                for ad in VARSAYILAN_TURLER:
                    cur.execute(
                        "INSERT INTO destinasyon_turleri (ad) VALUES (%s) ON CONFLICT DO NOTHING;",
                        (ad,),
                    )
                cur.execute(
                    "ALTER TABLE trabzon_destinasyonlar ADD COLUMN IF NOT EXISTS il_id INTEGER;"
                )
                cur.execute(
                    "ALTER TABLE trabzon_destinasyonlar ADD COLUMN IF NOT EXISTS tur_id INTEGER;"
                )
                cur.execute(
                    """
                    UPDATE trabzon_destinasyonlar d
                       SET il_id = (SELECT id FROM iller WHERE ad = 'Trabzon' LIMIT 1)
                     WHERE d.il_id IS NULL;
                    """
                )
                cur.execute(
                    """
                    UPDATE trabzon_destinasyonlar d
                       SET tur_id = (
                           SELECT id FROM destinasyon_turleri WHERE ad = 'Tarihi bina' LIMIT 1
                       )
                     WHERE d.tur_id IS NULL;
                    """
                )
                cur.execute(
                    "SELECT 1 AS var FROM pg_constraint WHERE conname = 'fk_destinasyon_il';"
                )
                if cur.fetchone() is None:
                    cur.execute(
                        """
                        ALTER TABLE trabzon_destinasyonlar
                            ADD CONSTRAINT fk_destinasyon_il
                            FOREIGN KEY (il_id) REFERENCES iller (id);
                        """
                    )
                cur.execute(
                    "SELECT 1 AS var FROM pg_constraint WHERE conname = 'fk_destinasyon_tur';"
                )
                if cur.fetchone() is None:
                    cur.execute(
                        """
                        ALTER TABLE trabzon_destinasyonlar
                            ADD CONSTRAINT fk_destinasyon_tur
                            FOREIGN KEY (tur_id) REFERENCES destinasyon_turleri (id);
                        """
                    )
                cur.execute(
                    "ALTER TABLE trabzon_destinasyonlar ALTER COLUMN il_id SET NOT NULL;"
                )
                cur.execute(
                    "ALTER TABLE trabzon_destinasyonlar ALTER COLUMN tur_id SET NOT NULL;"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_destinasyon_il ON trabzon_destinasyonlar (il_id);"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_destinasyon_tur ON trabzon_destinasyonlar (tur_id);"
                )
                cur.execute("DROP INDEX IF EXISTS uq_destinasyon_ad;")
                cur.execute(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS uq_destinasyon_il_ad
                        ON trabzon_destinasyonlar (il_id, lower(btrim(ad)));
                    """
                )
        except Exception as exc:
            raise DatabaseError(f"Il/tur semasi uygulanamadi: {_error_message(exc)}") from exc

    def server_version(self) -> str:
        return self._server_version

    def _read_server_version(self) -> str:
        try:
            with self.cursor() as cur:
                cur.execute("SHOW server_version;")
                row = cur.fetchone()
            return str(row["server_version"]) if row else "bilinmiyor"
        except Exception:
            return "bilinmiyor"

    def _detect_postgis(self) -> bool:
        try:
            with self.cursor() as cur:
                cur.execute("SELECT extname FROM pg_extension WHERE extname = 'postgis';")
                return cur.fetchone() is not None
        except Exception:
            return False

    # ------------------------------------------------------------------
    @staticmethod
    def _ssl_context(verify: bool) -> ssl.SSLContext:
        context = ssl.create_default_context()
        if not verify:
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
        return context

    def _friendly_error(self, exc: Optional[BaseException]) -> str:
        if exc is None:
            return "Baglanti kurulamadi."
        message = _error_message(exc)
        lowered = message.lower()
        code = _error_code(exc)

        if code == "28P01" or "password authentication failed" in lowered:
            return "Kullanici adi veya sifre hatali (config.ini > [database])."
        if code == "3D000" or ("database" in lowered and "does not exist" in lowered):
            return (
                f"'{self._config.dbname}' veritabani bulunamadi. Once "
                f"CREATE DATABASE {self._config.dbname}; komutunu calistirin."
            )
        if isinstance(exc, (ConnectionRefusedError, OSError)) or "refused" in lowered:
            return (
                f"PostgreSQL sunucusuna ulasilamadi ({self._config.host}:{self._config.port}). "
                "Sunucunun calistigini ve config.ini bilgilerini kontrol edin."
            )
        if "timed out" in lowered or "timeout" in lowered:
            return "Baglanti zaman asimina ugradi (config.ini > connect_timeout)."
        return f"Baglanti kurulamadi: {message}"


class LookupRepository:
    """iller ve destinasyon_turleri icin okuma / tur ekleme."""

    def __init__(self, manager: DatabaseManager) -> None:
        self._db = manager

    def list_iller(self) -> List[LookupItem]:
        if self._db.uses_web_schema:
            return self._list_web_provinces()
        return self._list("iller")

    def list_turler(self) -> List[LookupItem]:
        if self._db.uses_web_schema:
            return self._list_web_types()
        return self._list("destinasyon_turleri")

    def _list(self, table: str) -> List[LookupItem]:
        try:
            with self._db.cursor() as cur:
                cur.execute(f"SELECT id, ad FROM {table} ORDER BY ad;")
                rows = cur.fetchall()
        except Exception as exc:
            raise DatabaseError(f"Liste okunamadi ({table}): {_error_message(exc)}") from exc
        return [LookupItem(id=str(row["id"]), ad=row["ad"]) for row in rows]

    def _list_web_provinces(self) -> List[LookupItem]:
        try:
            with self._db.cursor() as cur:
                cur.execute('SELECT id, name AS ad FROM provinces ORDER BY name;')
                rows = cur.fetchall()
        except Exception as exc:
            raise DatabaseError(f"Iller okunamadi: {_error_message(exc)}") from exc
        return [LookupItem(id=str(row["id"]), ad=row["ad"]) for row in rows]

    def _list_web_types(self) -> List[LookupItem]:
        try:
            with self._db.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, name AS ad
                      FROM destination_types
                     WHERE "isActive" = true
                     ORDER BY "sortOrder", name;
                    """
                )
                rows = cur.fetchall()
        except Exception as exc:
            raise DatabaseError(f"Turler okunamadi: {_error_message(exc)}") from exc
        return [LookupItem(id=str(row["id"]), ad=row["ad"]) for row in rows]

    def insert_tur(self, ad: str) -> LookupItem:
        ad = (ad or "").strip()
        if not ad:
            raise DatabaseError("Tur adi bos olamaz.")
        if len(ad) > 80:
            raise DatabaseError("Tur adi en fazla 80 karakter olabilir.")
        if self._db.uses_web_schema:
            display = _normalize_type_name(ad)
            slug = _slugify(display)
            try:
                with self._db.cursor(commit=True) as cur:
                    cur.execute(
                        """
                        INSERT INTO destination_types (id, name, slug, "sortOrder", "isActive")
                        VALUES (gen_random_uuid(), %s, %s, 999, true)
                        RETURNING id, name AS ad;
                        """,
                        (display, slug),
                    )
                    row = cur.fetchone()
            except Exception as exc:
                if _error_code(exc) == UNIQUE_VIOLATION:
                    raise DuplicateTypeError(f"'{display}' adli tur zaten kayitli.") from exc
                raise DatabaseError(f"Tur eklenemedi: {_error_message(exc)}") from exc
            return LookupItem(id=str(row["id"]), ad=row["ad"])  # type: ignore[index]

        try:
            with self._db.cursor(commit=True) as cur:
                cur.execute(
                    """
                    INSERT INTO destinasyon_turleri (ad)
                    VALUES (%s)
                    RETURNING id, ad;
                    """,
                    (ad,),
                )
                row = cur.fetchone()
        except Exception as exc:
            if _error_code(exc) == UNIQUE_VIOLATION:
                raise DuplicateTypeError(f"'{ad}' adli tur zaten kayitli.") from exc
            raise DatabaseError(f"Tur eklenemedi: {_error_message(exc)}") from exc
        return LookupItem(id=str(row["id"]), ad=row["ad"])  # type: ignore[index]


class DestinasyonRepository:
    """destinations (web) veya trabzon_destinasyonlar icin CRUD."""

    def __init__(self, manager: DatabaseManager) -> None:
        self._db = manager

    _SELECT = """
        SELECT d.id, d.ad, d.aciklama, d.il_id, d.tur_id,
               i.ad AS il_ad, t.ad AS tur_ad,
               d.enlem, d.boylam, d.resim_yolu,
               d.olusturma_tarihi, d.guncelleme_tarihi
          FROM trabzon_destinasyonlar d
          JOIN iller i ON i.id = d.il_id
          JOIN destinasyon_turleri t ON t.id = d.tur_id
    """

    _WEB_SELECT = """
        SELECT d.id, d.name AS ad, d.description AS aciklama,
               d."shortDescription" AS kisa_aciklama,
               d."provinceId" AS il_id, d."typeId" AS tur_id,
               p.name AS il_ad, t.name AS tur_ad,
               d.latitude AS enlem, d.longitude AS boylam,
               d.images AS resim_yollari,
               COALESCE(
                   NULLIF(d."thumbnailUrl", ''),
                   CASE WHEN array_length(d.images, 1) >= 1 THEN d.images[1] ELSE NULL END
               ) AS resim_yolu,
               d."createdAt" AS olusturma_tarihi,
               d."updatedAt" AS guncelleme_tarihi
          FROM destinations d
          JOIN provinces p ON p.id = d."provinceId"
          JOIN destination_types t ON t.id = d."typeId"
    """

    def _select_query(self) -> str:
        return self._WEB_SELECT if self._db.uses_web_schema else self._SELECT

    # -- Okuma ---------------------------------------------------------
    def list_all(
        self,
        search: str = "",
        limit: int = 0,
        il_id: Optional[str] = None,
        tur_id: Optional[str] = None,
    ) -> List[Destinasyon]:
        query = self._select_query()
        params: List[Any] = []
        where: List[str] = []

        if search.strip():
            if self._db.uses_web_schema:
                where.append(
                    "(d.name ILIKE %s OR COALESCE(d.description, '') ILIKE %s "
                    "OR p.name ILIKE %s OR t.name ILIKE %s)"
                )
            else:
                where.append(
                    "(d.ad ILIKE %s OR COALESCE(d.aciklama, '') ILIKE %s "
                    "OR i.ad ILIKE %s OR t.ad ILIKE %s)"
                )
            pattern = f"%{search.strip()}%"
            params.extend([pattern, pattern, pattern, pattern])
        if il_id:
            col = '"provinceId"' if self._db.uses_web_schema else "il_id"
            where.append(f"d.{col} = %s")
            params.append(il_id)
        if tur_id:
            col = '"typeId"' if self._db.uses_web_schema else "tur_id"
            where.append(f"d.{col} = %s")
            params.append(tur_id)
        if where:
            query += " WHERE " + " AND ".join(where)
        order_il = "p.name" if self._db.uses_web_schema else "i.ad"
        order_ad = "d.name" if self._db.uses_web_schema else "d.ad"
        query += f" ORDER BY {order_il}, {order_ad}"
        if limit and limit > 0:
            query += " LIMIT %s"
            params.append(limit)

        try:
            with self._db.cursor() as cur:
                cur.execute(query, params)
                rows = cur.fetchall()
        except DatabaseError:
            raise
        except Exception as exc:
            raise DatabaseError(f"Kayitlar okunamadi: {_error_message(exc)}") from exc
        return [Destinasyon.from_row(row) for row in rows]

    def get(self, destinasyon_id: str) -> Optional[Destinasyon]:
        try:
            with self._db.cursor() as cur:
                cur.execute(self._select_query() + " WHERE d.id = %s;", (destinasyon_id,))
                row = cur.fetchone()
        except DatabaseError:
            raise
        except Exception as exc:
            raise DatabaseError(f"Kayit okunamadi: {_error_message(exc)}") from exc
        return Destinasyon.from_row(row) if row else None

    def image_in_use(self, resim_yolu: str, exclude_id: Optional[str] = None) -> bool:
        """Resim yolu baska bir kayit tarafindan kullaniliyor mu?

        Bir kaydin resmi silinmeden once cagrilir; ayni dosyaya isaret
        eden baska kayit varsa dosya diskte birakilir.
        """
        if not resim_yolu:
            return False
        if self._db.uses_web_schema:
            query = (
                'SELECT 1 FROM destinations WHERE "thumbnailUrl" = %s OR %s = ANY(images)'
            )
            params: List[Any] = [resim_yolu, resim_yolu]
            if exclude_id is not None:
                query += " AND id <> %s"
                params.append(exclude_id)
        else:
            query = f"SELECT 1 FROM {TABLE_NAME} WHERE resim_yolu = %s"
            params = [resim_yolu]
            if exclude_id is not None:
                query += " AND id <> %s"
                params.append(exclude_id)
        try:
            with self._db.cursor() as cur:
                cur.execute(query + " LIMIT 1;", params)
                return cur.fetchone() is not None
        except DatabaseError:
            raise
        except Exception as exc:
            raise DatabaseError(f"Resim kullanimi sorgulanamadi: {_error_message(exc)}") from exc

    def count(self) -> int:
        table = WEB_DESTINATIONS if self._db.uses_web_schema else TABLE_NAME
        try:
            with self._db.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) AS adet FROM {table};")
                row = cur.fetchone()
        except DatabaseError:
            raise
        except Exception as exc:
            raise DatabaseError(f"Kayit sayisi alinamadi: {_error_message(exc)}") from exc
        return int(row["adet"]) if row else 0

    # -- Yazma (Asama 2'de arayuze baglanacak) -------------------------
    def insert(self, item: Destinasyon) -> Destinasyon:
        item.validate()
        if self._db.uses_web_schema:
            return self._insert_web(item)
        try:
            with self._db.cursor(commit=True) as cur:
                cur.execute(
                    f"""
                    INSERT INTO {TABLE_NAME} (ad, aciklama, il_id, tur_id, enlem, boylam, resim_yolu)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id;
                    """,
                    (
                        item.ad.strip(),
                        item.aciklama.strip() or None,
                        item.il_id,
                        item.tur_id,
                        item.enlem,
                        item.boylam,
                        item.resim_yolu,
                    ),
                )
                row = cur.fetchone()
        except DatabaseError:
            raise
        except Exception as exc:
            self._raise_write_error(exc, item, "eklenemedi")
        return self.get(str(row["id"]))  # type: ignore[index, arg-type]

    def _insert_web(self, item: Destinasyon) -> Destinasyon:
        slug_base = _slugify(item.ad.strip())
        slug = slug_base
        aciklama = item.aciklama.strip() or None
        kisa = (item.kisa_aciklama or "").strip() or (aciklama[:500] if aciklama else None)
        image_paths = _normalize_image_paths(item)
        thumb = image_paths[0] if image_paths else None
        try:
            with self._db.cursor(commit=True) as cur:
                cur.execute(
                    """
                    SELECT 1 FROM destinations
                     WHERE "provinceId" = %s AND lower(name) = lower(%s)
                     LIMIT 1;
                    """,
                    (item.il_id, item.ad.strip()),
                )
                if cur.fetchone():
                    raise DuplicateNameError(
                        f"'{item.ad.strip()}' adli destinasyon bu ilde zaten kayitli."
                    )
                suffix = 1
                while True:
                    cur.execute("SELECT 1 FROM destinations WHERE slug = %s LIMIT 1;", (slug,))
                    if cur.fetchone() is None:
                        break
                    suffix += 1
                    slug = f"{slug_base}-{suffix}"
                cur.execute(
                    """
                    INSERT INTO destinations (
                        id, name, slug, description, "shortDescription",
                        "typeId", "provinceId", latitude, longitude,
                        images, "thumbnailUrl", "isActive", "createdAt", "updatedAt"
                    )
                    VALUES (
                        gen_random_uuid(), %s, %s, %s, %s,
                        %s, %s, %s, %s, %s::text[], %s, true, NOW(), NOW()
                    )
                    RETURNING id;
                    """,
                    (
                        item.ad.strip(),
                        slug,
                        aciklama,
                        kisa,
                        item.tur_id,
                        item.il_id,
                        item.enlem,
                        item.boylam,
                        image_paths,
                        thumb,
                    ),
                )
                row = cur.fetchone()
        except DuplicateNameError:
            raise
        except DatabaseError:
            raise
        except Exception as exc:
            self._raise_write_error(exc, item, "eklenemedi")
        return self.get(str(row["id"]))  # type: ignore[index, arg-type]

    def update(self, item: Destinasyon) -> Destinasyon:
        if item.id is None:
            raise DatabaseError("Guncelleme icin kayit id'si gerekli.")
        item.validate()
        if self._db.uses_web_schema:
            return self._update_web(item)
        try:
            with self._db.cursor(commit=True) as cur:
                cur.execute(
                    f"""
                    UPDATE {TABLE_NAME}
                       SET ad = %s, aciklama = %s, il_id = %s, tur_id = %s,
                           enlem = %s, boylam = %s, resim_yolu = %s
                     WHERE id = %s
                 RETURNING id;
                    """,
                    (
                        item.ad.strip(),
                        item.aciklama.strip() or None,
                        item.il_id,
                        item.tur_id,
                        item.enlem,
                        item.boylam,
                        item.resim_yolu,
                        item.id,
                    ),
                )
                row = cur.fetchone()
        except DatabaseError:
            raise
        except Exception as exc:
            self._raise_write_error(exc, item, "guncellenemedi")

        if row is None:
            raise DatabaseError(f"id={item.id} olan kayit bulunamadi.")
        kayit = self.get(str(row["id"]))
        if kayit is None:
            raise DatabaseError(f"id={item.id} olan kayit bulunamadi.")
        return kayit

    def _update_web(self, item: Destinasyon) -> Destinasyon:
        aciklama = item.aciklama.strip() or None
        kisa = (item.kisa_aciklama or "").strip() or (aciklama[:500] if aciklama else None)
        image_paths = _normalize_image_paths(item)
        thumb = image_paths[0] if image_paths else None
        try:
            with self._db.cursor(commit=True) as cur:
                cur.execute(
                    """
                    SELECT 1 FROM destinations
                     WHERE "provinceId" = %s AND lower(name) = lower(%s) AND id <> %s
                     LIMIT 1;
                    """,
                    (item.il_id, item.ad.strip(), item.id),
                )
                if cur.fetchone():
                    raise DuplicateNameError(
                        f"'{item.ad.strip()}' adli destinasyon bu ilde zaten kayitli."
                    )
                cur.execute(
                    """
                    UPDATE destinations
                       SET name = %s,
                           description = %s,
                           "shortDescription" = %s,
                           "typeId" = %s,
                           "provinceId" = %s,
                           latitude = %s,
                           longitude = %s,
                           images = %s::text[],
                           "thumbnailUrl" = %s,
                           "updatedAt" = NOW()
                     WHERE id = %s
                 RETURNING id;
                    """,
                    (
                        item.ad.strip(),
                        aciklama,
                        kisa,
                        item.tur_id,
                        item.il_id,
                        item.enlem,
                        item.boylam,
                        image_paths,
                        thumb,
                        item.id,
                    ),
                )
                row = cur.fetchone()
        except DuplicateNameError:
            raise
        except DatabaseError:
            raise
        except Exception as exc:
            self._raise_write_error(exc, item, "guncellenemedi")
        if row is None:
            raise DatabaseError(f"id={item.id} olan kayit bulunamadi.")
        kayit = self.get(str(row["id"]))
        if kayit is None:
            raise DatabaseError(f"id={item.id} olan kayit bulunamadi.")
        return kayit

    def delete(self, destinasyon_id: str) -> Optional[str]:
        """Kaydi siler ve silinen kaydin resim yolunu dondurur.

        Donen yol, resmi images/ klasorunden temizlemek icin kullanilir.
        """
        try:
            with self._db.cursor(commit=True) as cur:
                if self._db.uses_web_schema:
                    cur.execute(
                        'DELETE FROM destinations WHERE id = %s RETURNING "thumbnailUrl" AS resim_yolu;',
                        (destinasyon_id,),
                    )
                else:
                    cur.execute(
                        f"DELETE FROM {TABLE_NAME} WHERE id = %s RETURNING resim_yolu;",
                        (destinasyon_id,),
                    )
                row = cur.fetchone()
        except DatabaseError:
            raise
        except Exception as exc:
            raise DatabaseError(f"Kayit silinemedi: {_error_message(exc)}") from exc

        if row is None:
            raise DatabaseError(f"id={destinasyon_id} olan kayit bulunamadi.")
        return row["resim_yolu"]

    # ------------------------------------------------------------------
    @staticmethod
    def _raise_write_error(exc: BaseException, item: Destinasyon, fiil: str) -> None:
        code = _error_code(exc)
        if code == UNIQUE_VIOLATION:
            raise DuplicateNameError(
                f"'{item.ad.strip()}' adli destinasyon bu ilde zaten kayitli."
            ) from exc
        if code == CHECK_VIOLATION:
            raise DatabaseError(
                f"Veritabani kisiti ihlal edildi: {_error_message(exc)}"
            ) from exc
        raise DatabaseError(f"Kayit {fiil}: {_error_message(exc)}") from exc
