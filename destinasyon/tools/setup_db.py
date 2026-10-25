"""Veritabanini kurulum araci (Asama 1 yardimcisi).

Yaptiklari:
  1. config.ini'deki bilgilerle sunucuya baglanir.
  2. Hedef veritabani yoksa olusturur (CREATE DATABASE).
  3. sql/01_schema.sql dosyasini uygular.
  4. PostGIS varsa sql/02_postgis_opsiyonel.sql dosyasini uygular
     (eklenti kurulu degilse sessizce atlanir).
  5. --ornek-veri verilirse sql/03_ornek_veri.sql ile ornek kayitlari ekler.

Parola yalnizca config.ini'den okunur; ekrana veya loglara yazilmaz.

Kullanim:
    python tools/setup_db.py
    python tools/setup_db.py --ornek-veri
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import List

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pg8000.dbapi as pgdb  # noqa: E402

from app.config import ConfigManager  # noqa: E402
from app.paths import AppPaths  # noqa: E402

SQL_DIR = Path(__file__).resolve().parent.parent / "sql"


# ----------------------------------------------------------------------
def sql_ifadelerine_bol(script: str) -> List[str]:
    """SQL betigini ifadelere ayirir.

    Dollar-quoted govdeler ($$ ... $$) icindeki noktali virguller
    bolunmez; fonksiyon ve trigger tanimlari bu sayede bozulmaz.
    """
    ifadeler: List[str] = []
    tampon: List[str] = []
    i = 0
    uzunluk = len(script)
    tirnak: str | None = None  # aktif tirnak turu: ' " veya $etiket$

    while i < uzunluk:
        karakter = script[i]

        if tirnak is None:
            # Yorumlar
            if script.startswith("--", i):
                sonu = script.find("\n", i)
                i = uzunluk if sonu == -1 else sonu
                continue
            if script.startswith("/*", i):
                sonu = script.find("*/", i + 2)
                i = uzunluk if sonu == -1 else sonu + 2
                continue
            # Dollar quoting: $$ veya $etiket$
            if karakter == "$":
                kapanis = script.find("$", i + 1)
                if kapanis != -1 and script[i + 1 : kapanis].replace("_", "").isalnum() or (
                    kapanis == i + 1
                ):
                    tirnak = script[i : kapanis + 1]
                    tampon.append(tirnak)
                    i = kapanis + 1
                    continue
            if karakter in ("'", '"'):
                tirnak = karakter
            elif karakter == ";":
                ifade = "".join(tampon).strip()
                if ifade:
                    ifadeler.append(ifade)
                tampon = []
                i += 1
                continue
        else:
            if tirnak in ("'", '"'):
                if karakter == tirnak:
                    tirnak = None
            elif script.startswith(tirnak, i):
                tampon.append(tirnak)
                i += len(tirnak)
                tirnak = None
                continue

        tampon.append(karakter)
        i += 1

    son = "".join(tampon).strip()
    if son:
        ifadeler.append(son)
    return ifadeler


def betigi_calistir(conn, dosya: Path) -> int:
    """SQL dosyasini calistirir, uygulanan ifade sayisini dondurur."""
    script = dosya.read_text(encoding="utf-8")
    sayac = 0
    cur = conn.cursor()
    try:
        for ifade in sql_ifadelerine_bol(script):
            if ifade.upper() in {"BEGIN", "COMMIT"}:
                continue  # islem yonetimi bu araca ait
            cur.execute(ifade)
            sayac += 1
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
    return sayac


def baglan(c, dbname: str):
    return pgdb.connect(
        user=c.user,
        password=c.password or None,
        host=c.host,
        port=int(c.port),
        database=dbname,
        timeout=int(c.connect_timeout) or None,
        ssl_context=None,
        application_name="TurizmVeriPaneli-Setup",
    )


# ----------------------------------------------------------------------
def main() -> int:
    ornek_veri = "--ornek-veri" in sys.argv

    paths = AppPaths()
    config = ConfigManager(paths).load()
    c = config.database
    print(f"Hedef sunucu : {c.safe_summary()}")

    # 1) Sunucuya baglan (bakim veritabani uzerinden)
    try:
        yonetim = baglan(c, "postgres")
        yonetim.autocommit = True
    except Exception as exc:
        print(f"[HATA] Sunucuya baglanilamadi: {_kisa(exc)}")
        print("       config.ini > [database] altindaki user/password degerlerini kontrol edin.")
        return 1

    # 2) Veritabani yoksa olustur
    try:
        cur = yonetim.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (c.dbname,))
        if cur.fetchone() is None:
            cur.execute(f'CREATE DATABASE "{c.dbname}" ENCODING \'UTF8\'')
            print(f"[OK]   Veritabani olusturuldu: {c.dbname}")
        else:
            print(f"[ATLA] Veritabani zaten var: {c.dbname}")
        cur.close()
    except Exception as exc:
        print(f"[HATA] Veritabani olusturulamadi: {_kisa(exc)}")
        return 1
    finally:
        yonetim.close()

    # 3) Semayi uygula
    try:
        conn = baglan(c, c.dbname)
    except Exception as exc:
        print(f"[HATA] '{c.dbname}' veritabanina baglanilamadi: {_kisa(exc)}")
        return 1

    try:
        adet = betigi_calistir(conn, SQL_DIR / "01_schema.sql")
        print(f"[OK]   Sema uygulandi (01_schema.sql, {adet} ifade)")

        adet = betigi_calistir(conn, SQL_DIR / "04_il_ve_tur.sql")
        print(f"[OK]   Il/tur semasi uygulandi (04_il_ve_tur.sql, {adet} ifade)")

        # 4) PostGIS opsiyonel
        try:
            adet = betigi_calistir(conn, SQL_DIR / "02_postgis_opsiyonel.sql")
            print(f"[OK]   PostGIS destegi eklendi (02_postgis_opsiyonel.sql, {adet} ifade)")
        except Exception as exc:
            print(f"[ATLA] PostGIS eklenemedi, enlem/boylam sutunlari yeterli: {_kisa(exc)}")

        # 5) Ornek veri
        if ornek_veri:
            adet = betigi_calistir(conn, SQL_DIR / "03_ornek_veri.sql")
            print(f"[OK]   Ornek kayitlar eklendi (03_ornek_veri.sql, {adet} ifade)")

        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM trabzon_destinasyonlar")
        toplam = cur.fetchone()[0]
        cur.close()
        print(f"\nHazir. 'trabzon_destinasyonlar' tablosunda {toplam} kayit var.")
        print("Uygulamayi baslatmak icin: python main.py")
    except Exception as exc:
        print(f"[HATA] Sema uygulanamadi: {_kisa(exc)}")
        return 1
    finally:
        conn.close()
    return 0


def _kisa(exc: BaseException) -> str:
    for arg in getattr(exc, "args", ()):
        if isinstance(arg, dict) and arg.get("M"):
            return f"{arg.get('M')} (kod {arg.get('C')})"
    return str(exc)[:200]


if __name__ == "__main__":
    sys.exit(main())
