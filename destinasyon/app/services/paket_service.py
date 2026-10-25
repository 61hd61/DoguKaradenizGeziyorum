"""Tasınabilir veri paketi: tek klasorde JSON + SQLite + resimler."""

from __future__ import annotations

import json
import shutil
import sqlite3
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.database import DatabaseManager, DatabaseError
from app.paths import AppPaths


def _parse_images_field(raw: Any) -> List[str]:
    if raw is None:
        return []
    if isinstance(raw, (list, tuple)):
        return [str(x) for x in raw if x]
    text = str(raw).strip()
    if text.startswith("{") and text.endswith("}"):
        inner = text[1:-1].strip()
        return [p.strip().strip('"') for p in inner.split(",") if p.strip()] if inner else []
    return [text] if text else []


def _json_default(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(type(obj))


@dataclass
class PaketSecenekleri:
    destinasyonlar: bool = True
    kullanicilar: bool = True
    profiller: bool = True
    blog_yazilari: bool = True
    resimleri_kopyala: bool = True


@dataclass
class PaketSonuc:
    hedef: Path
    destinasyon_sayisi: int = 0
    kullanici_sayisi: int = 0
    blog_sayisi: int = 0
    resim_sayisi: int = 0


class PaketService:
    FORMAT = "karadeniz-turizm-paket"
    FORMAT_VERSION = 1

    def __init__(self, paths: AppPaths, db: DatabaseManager) -> None:
        self._paths = paths
        self._db = db

    @property
    def varsayilan_klasor(self) -> Path:
        """odev/veritabani — tek klasor olarak paylasilir."""
        odev = self._paths.root.parent
        return odev / "veritabani"

    def export_paket(self, hedef: Path, secenekler: PaketSecenekleri) -> PaketSonuc:
        if not self._db.is_connected:
            raise DatabaseError("Veri paketi icin once PostgreSQL baglantisi gerekli.")
        hedef = hedef.resolve()
        data_dir = hedef / "data"
        images_dir = hedef / "images"
        data_dir.mkdir(parents=True, exist_ok=True)
        if secenekler.resimleri_kopyala:
            images_dir.mkdir(parents=True, exist_ok=True)

        sonuc = PaketSonuc(hedef=hedef)
        manifest: Dict[str, Any] = {
            "format": self.FORMAT,
            "version": self.FORMAT_VERSION,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "secenekler": asdict(secenekler),
            "counts": {},
        }

        if secenekler.destinasyonlar:
            rows = self._fetch_destinations()
            copied: set[str] = set()
            for row in rows:
                imgs = _parse_images_field(row.get("images"))
                new_imgs: List[str] = []
                for rel in imgs:
                    if not rel:
                        continue
                    if secenekler.resimleri_kopyala:
                        rel_norm = self._copy_image(rel, images_dir, copied)
                        new_imgs.append(rel_norm)
                        sonuc.resim_sayisi += 1
                    else:
                        new_imgs.append(rel.replace("\\", "/"))
                row["images"] = new_imgs
                thumb = row.get("thumbnailUrl")
                if thumb and secenekler.resimleri_kopyala:
                    row["thumbnailUrl"] = self._copy_image(thumb, images_dir, copied)
                elif new_imgs:
                    row["thumbnailUrl"] = new_imgs[0]
            self._write_json(data_dir / "destinations.json", rows)
            sonuc.destinasyon_sayisi = len(rows)
            manifest["counts"]["destinations"] = len(rows)
            self._write_sqlite_destinations(hedef / "turizm.sqlite", rows)

        if secenekler.kullanicilar:
            users = self._fetch_table(
                """
                SELECT id, username, email, role, "isEmailVerified", "createdAt", "updatedAt"
                FROM users ORDER BY "createdAt"
                """
            )
            self._write_json(data_dir / "users.json", users)
            sonuc.kullanici_sayisi = len(users)
            manifest["counts"]["users"] = len(users)

        if secenekler.profiller:
            profiles = self._fetch_table(
                """
                SELECT id, "userId", "firstName", "lastName", bio, "createdAt", "updatedAt"
                FROM user_profiles ORDER BY "createdAt"
                """
            )
            self._write_json(data_dir / "user_profiles.json", profiles)
            manifest["counts"]["user_profiles"] = len(profiles)

        if secenekler.blog_yazilari:
            posts = self._fetch_table(
                """
                SELECT id, "userId", title, content, images, "likeCount", "commentCount",
                       "publishedAt", "createdAt", "updatedAt"
                FROM posts ORDER BY "createdAt"
                """
            )
            self._write_json(data_dir / "posts.json", posts)
            sonuc.blog_sayisi = len(posts)
            manifest["counts"]["posts"] = len(posts)

        self._write_json(hedef / "manifest.json", manifest)
        readme = hedef / "OKU_BENI.txt"
        readme.write_text(
            "Karadeniz Turizm veri paketi\n"
            "============================\n"
            "Bu klasoru baska bilgisayara kopyalayip panelden 'Paket Yukle' ile acabilirsiniz.\n"
            "Icinde: manifest.json, data/*.json, turizm.sqlite, images/\n",
            encoding="utf-8",
        )
        return sonuc

    def import_paket(self, kaynak: Path, secenekler: Optional[PaketSecenekleri] = None) -> PaketSonuc:
        kaynak = kaynak.resolve()
        manifest_path = kaynak / "manifest.json"
        if not manifest_path.is_file():
            raise DatabaseError("Gecerli paket degil: manifest.json yok.")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("format") != self.FORMAT:
            raise DatabaseError("Desteklenmeyen paket formati.")

        opts = secenekler or PaketSecenekleri()
        sonuc = PaketSonuc(hedef=kaynak)
        data_dir = kaynak / "data"
        images_src = kaynak / "images"

        if opts.destinasyonlar and (data_dir / "destinations.json").is_file():
            rows = json.loads((data_dir / "destinations.json").read_text(encoding="utf-8"))
            for row in rows:
                self._upsert_destination_from_paket(row, images_src if images_src.is_dir() else None)
            sonuc.destinasyon_sayisi = len(rows)

        if opts.kullanicilar and (data_dir / "users.json").is_file():
            sonuc.kullanici_sayisi = len(json.loads((data_dir / "users.json").read_text(encoding="utf-8")))

        if opts.blog_yazilari and (data_dir / "posts.json").is_file():
            sonuc.blog_sayisi = len(json.loads((data_dir / "posts.json").read_text(encoding="utf-8")))

        return sonuc

    # ------------------------------------------------------------------
    def _copy_image(self, relative: str, target_images: Path, copied: set[str]) -> str:
        rel = relative.strip().replace("\\", "/").lstrip("/")
        if rel in copied:
            return f"images/{Path(rel).name}" if not rel.startswith("images/") else rel
        src = self._paths.to_absolute(rel)
        if not src.is_file():
            alt = self._paths.images_dir / Path(rel).name
            src = alt if alt.is_file() else src
        dest_name = Path(rel).name
        dest = target_images / dest_name
        if src.is_file():
            shutil.copy2(src, dest)
            copied.add(rel)
        return f"images/{dest_name}"

    def _write_json(self, path: Path, data: Any) -> None:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=_json_default), encoding="utf-8")

    def _fetch_destinations(self) -> List[Dict[str, Any]]:
        sql = """
            SELECT d.id, d.name, d.slug, d.description, d."shortDescription",
                   d."provinceId", d."typeId", p.name AS province_name, t.name AS type_name,
                   d.latitude, d.longitude, d.images, d."thumbnailUrl", d."isActive"
            FROM destinations d
            JOIN provinces p ON p.id = d."provinceId"
            JOIN destination_types t ON t.id = d."typeId"
            ORDER BY p.name, d.name
        """
        with self._db.cursor() as cur:
            cur.execute(sql)
            return [dict(row) for row in cur.fetchall()]

    def _fetch_table(self, sql: str) -> List[Dict[str, Any]]:
        try:
            with self._db.cursor() as cur:
                cur.execute(sql)
                return [dict(row) for row in cur.fetchall()]
        except Exception:
            return []

    def _write_sqlite_destinations(self, db_path: Path, rows: List[Dict[str, Any]]) -> None:
        if db_path.exists():
            db_path.unlink()
        conn = sqlite3.connect(db_path)
        conn.execute(
            """
            CREATE TABLE destinations (
                id TEXT PRIMARY KEY,
                name TEXT,
                slug TEXT,
                description TEXT,
                short_description TEXT,
                province_id TEXT,
                type_id TEXT,
                province_name TEXT,
                type_name TEXT,
                latitude REAL,
                longitude REAL,
                images_json TEXT,
                thumbnail_url TEXT,
                is_active INTEGER
            )
            """
        )
        for row in rows:
            imgs = row.get("images") or []
            conn.execute(
                """
                INSERT INTO destinations VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    row.get("id"),
                    row.get("name"),
                    row.get("slug"),
                    row.get("description"),
                    row.get("shortDescription"),
                    row.get("provinceId"),
                    row.get("typeId"),
                    row.get("province_name"),
                    row.get("type_name"),
                    float(row["latitude"]) if row.get("latitude") is not None else None,
                    float(row["longitude"]) if row.get("longitude") is not None else None,
                    json.dumps(imgs, ensure_ascii=False),
                    row.get("thumbnailUrl"),
                    1 if row.get("isActive", True) else 0,
                ),
            )
        conn.commit()
        conn.close()

    def _upsert_destination_from_paket(self, row: Dict[str, Any], images_src: Optional[Path]) -> None:
        """Paketteki destinasyonu PostgreSQL'e yazar (id korunur)."""
        imgs: List[str] = list(row.get("images") or [])
        local_imgs: List[str] = []
        for rel in imgs:
            rel_clean = rel.replace("\\", "/")
            if images_src and images_src.is_dir():
                name = Path(rel_clean).name
                src = images_src / name
                if src.is_file():
                    dest = self._paths.images_dir / name
                    shutil.copy2(src, dest)
                    local_imgs.append(f"images/{name}")
                    continue
            local_imgs.append(rel_clean)
        thumb = local_imgs[0] if local_imgs else row.get("thumbnailUrl")
        with self._db.cursor(commit=True) as cur:
            cur.execute(
                """
                INSERT INTO destinations (
                    id, name, slug, description, "shortDescription",
                    "typeId", "provinceId", latitude, longitude,
                    images, "thumbnailUrl", "isActive", "createdAt", "updatedAt"
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::text[], %s, %s, NOW(), NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    "shortDescription" = EXCLUDED."shortDescription",
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    images = EXCLUDED.images,
                    "thumbnailUrl" = EXCLUDED."thumbnailUrl",
                    "updatedAt" = NOW()
                """,
                (
                    row["id"],
                    row["name"],
                    row.get("slug") or row["name"][:40],
                    row.get("description"),
                    row.get("shortDescription"),
                    row["typeId"],
                    row["provinceId"],
                    row.get("latitude"),
                    row.get("longitude"),
                    local_imgs,
                    thumb,
                    row.get("isActive", True),
                ),
            )
