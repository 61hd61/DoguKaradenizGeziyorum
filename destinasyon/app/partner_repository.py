"""Otel ve tur firmasi kayitlari (panel tablolari)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app.database import DatabaseError, DatabaseManager

HOTELS = "panel_hotels"
TOURS = "panel_tur_firmalari"


@dataclass
class PartnerRecord:
    id: str
    ad: str
    il: str = ""
    telefon: str = ""
    eposta: str = ""
    aciklama: str = ""
    web: str = ""
    extra: str = ""  # yildiz veya hizmet_turu


class PartnerRepository:
    def __init__(self, db: DatabaseManager, table: str) -> None:
        self._db = db
        self._table = table

    def list_all(self, search: str = "") -> List[PartnerRecord]:
        extra_col = "CAST(yildiz AS TEXT)" if self._table == HOTELS else "hizmet_turu"
        q = f"""
            SELECT id, ad, il, telefon, eposta, aciklama, web,
                   COALESCE({extra_col}, '') AS extra
            FROM {self._table}
        """
        params: tuple[Any, ...] = ()
        if search.strip():
            q += " WHERE ad ILIKE %s OR il ILIKE %s"
            like = f"%{search.strip()}%"
            params = (like, like)
        q += " ORDER BY ad ASC LIMIT 500"
        with self._db.cursor() as cur:
            cur.execute(q, params)
            rows = cur.fetchall()
        return [
            PartnerRecord(
                id=str(r["id"]),
                ad=r.get("ad") or "",
                il=r.get("il") or "",
                telefon=r.get("telefon") or "",
                eposta=r.get("eposta") or "",
                aciklama=r.get("aciklama") or "",
                web=r.get("web") or "",
                extra=str(r.get("extra") or ""),
            )
            for r in rows
        ]

    def get_by_id(self, rid: str) -> Optional[PartnerRecord]:
        extra_col = "CAST(yildiz AS TEXT)" if self._table == HOTELS else "hizmet_turu"
        q = f"""
            SELECT id, ad, il, telefon, eposta, aciklama, web,
                   COALESCE({extra_col}, '') AS extra
            FROM {self._table} WHERE id = %s
        """
        with self._db.cursor() as cur:
            cur.execute(q, (rid,))
            r = cur.fetchone()
        if not r:
            return None
        return PartnerRecord(
            id=str(r["id"]),
            ad=r.get("ad") or "",
            il=r.get("il") or "",
            telefon=r.get("telefon") or "",
            eposta=r.get("eposta") or "",
            aciklama=r.get("aciklama") or "",
            web=r.get("web") or "",
            extra=str(r.get("extra") or ""),
        )

    def insert(self, data: Dict[str, Any]) -> str:
        rid = str(uuid.uuid4())
        if self._table == HOTELS:
            sql = f"""
                INSERT INTO {HOTELS} (id, ad, il, telefon, eposta, yildiz, enlem, boylam, aciklama, web)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """
            params = (
                rid,
                data.get("ad", "").strip(),
                data.get("il", "").strip(),
                data.get("telefon", "").strip(),
                data.get("eposta", "").strip(),
                int(data.get("extra") or 3),
                data.get("enlem"),
                data.get("boylam"),
                data.get("aciklama", "").strip(),
                data.get("web", "").strip(),
            )
        else:
            sql = f"""
                INSERT INTO {TOURS} (id, ad, il, telefon, eposta, hizmet_turu, aciklama, web)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """
            params = (
                rid,
                data.get("ad", "").strip(),
                data.get("il", "").strip(),
                data.get("telefon", "").strip(),
                data.get("eposta", "").strip(),
                data.get("extra", "").strip() or "Karadeniz turlari",
                data.get("aciklama", "").strip(),
                data.get("web", "").strip(),
            )
        with self._db.cursor(commit=True) as cur:
            cur.execute(sql, params)
        return rid

    def update(self, rid: str, data: Dict[str, Any]) -> None:
        if self._table == HOTELS:
            sql = f"""
                UPDATE {HOTELS} SET ad=%s, il=%s, telefon=%s, eposta=%s, yildiz=%s,
                    aciklama=%s, web=%s, guncelleme=NOW() WHERE id=%s
            """
            params = (
                data.get("ad", "").strip(),
                data.get("il", "").strip(),
                data.get("telefon", "").strip(),
                data.get("eposta", "").strip(),
                int(data.get("extra") or 3),
                data.get("aciklama", "").strip(),
                data.get("web", "").strip(),
                rid,
            )
        else:
            sql = f"""
                UPDATE {TOURS} SET ad=%s, il=%s, telefon=%s, eposta=%s, hizmet_turu=%s,
                    aciklama=%s, web=%s, guncelleme=NOW() WHERE id=%s
            """
            params = (
                data.get("ad", "").strip(),
                data.get("il", "").strip(),
                data.get("telefon", "").strip(),
                data.get("eposta", "").strip(),
                data.get("extra", "").strip(),
                data.get("aciklama", "").strip(),
                data.get("web", "").strip(),
                rid,
            )
        with self._db.cursor(commit=True) as cur:
            cur.execute(sql, params)

    def delete(self, rid: str) -> None:
        with self._db.cursor(commit=True) as cur:
            cur.execute(f"DELETE FROM {self._table} WHERE id = %s", (rid,))


def ensure_partner_tables(db: DatabaseManager) -> None:
    if not db.is_connected:
        raise DatabaseError("Baglanti yok")
    with db.cursor(commit=True) as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS panel_hotels (
                id TEXT PRIMARY KEY,
                ad VARCHAR(200) NOT NULL,
                il VARCHAR(80),
                telefon VARCHAR(60),
                eposta VARCHAR(120),
                yildiz SMALLINT DEFAULT 3,
                enlem NUMERIC(9,6),
                boylam NUMERIC(9,6),
                aciklama TEXT,
                web VARCHAR(300),
                olusturma TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                guncelleme TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS panel_tur_firmalari (
                id TEXT PRIMARY KEY,
                ad VARCHAR(200) NOT NULL,
                il VARCHAR(80),
                telefon VARCHAR(60),
                eposta VARCHAR(120),
                hizmet_turu VARCHAR(120),
                aciklama TEXT,
                web VARCHAR(300),
                olusturma TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                guncelleme TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
