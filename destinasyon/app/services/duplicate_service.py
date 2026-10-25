"""Ayni il + ayni ad destinasyon tekrarlarini bulma ve temizleme."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from app.database import DatabaseManager, DatabaseError, DestinasyonRepository


@dataclass
class DuplicateMember:
    id: str
    ad: str
    il_ad: str
    resim_sayisi: int
    aciklama_uzunluk: int
    guncelleme: Optional[str]


@dataclass
class DuplicateGroup:
    il_ad: str
    norm_ad: str
    uyeler: List[DuplicateMember]

    @property
    def adet(self) -> int:
        return len(self.uyeler)


class DuplicateService:
    def __init__(self, db: DatabaseManager, repo: DestinasyonRepository) -> None:
        self._db = db
        self._repo = repo

    def find_groups(self, limit: int = 200) -> List[DuplicateGroup]:
        if not self._db.is_connected or not self._db.uses_web_schema:
            raise DatabaseError("Cift kayit aramasi web semasi (destinations) ile calisir.")
        sql = """
            SELECT p.name AS il_ad,
                   lower(btrim(d.name)) AS norm_ad,
                   array_agg(d.id ORDER BY d."updatedAt" DESC) AS ids
            FROM destinations d
            JOIN provinces p ON p.id = d."provinceId"
            GROUP BY p.name, lower(btrim(d.name))
            HAVING count(*) > 1
            ORDER BY count(*) DESC, p.name
            LIMIT %s
        """
        groups: List[DuplicateGroup] = []
        with self._db.cursor() as cur:
            cur.execute(sql, (limit,))
            for row in cur.fetchall():
                ids = row["ids"] or []
                if isinstance(ids, str):
                    inner = ids.strip("{} ")
                    id_list = [p.strip().strip('"') for p in inner.split(",") if p.strip()] if inner else []
                elif hasattr(ids, "__iter__"):
                    id_list = [str(i) for i in ids]
                else:
                    id_list = [str(ids)]
                uyeler: List[DuplicateMember] = []
                for did in id_list:
                    det = self._member_detail(did)
                    if det:
                        uyeler.append(det)
                if len(uyeler) > 1:
                    groups.append(
                        DuplicateGroup(
                            il_ad=row["il_ad"],
                            norm_ad=row["norm_ad"],
                            uyeler=uyeler,
                        )
                    )
        return groups

    def _member_detail(self, destinasyon_id: str) -> Optional[DuplicateMember]:
        sql = """
            SELECT d.id, d.name AS ad, p.name AS il_ad,
                   d.description, d.images, d."updatedAt"
            FROM destinations d
            JOIN provinces p ON p.id = d."provinceId"
            WHERE d.id = %s
        """
        with self._db.cursor() as cur:
            cur.execute(sql, (destinasyon_id,))
            row = cur.fetchone()
        if not row:
            return None
        imgs = row.get("images") or []
        if isinstance(imgs, str):
            imgs = [imgs] if imgs else []
        desc = row.get("description") or ""
        upd = row.get("updatedAt")
        return DuplicateMember(
            id=str(row["id"]),
            ad=row["ad"],
            il_ad=row["il_ad"],
            resim_sayisi=len(list(imgs)),
            aciklama_uzunluk=len(desc),
            guncelleme=str(upd) if upd else None,
        )

    def delete_ids(self, ids: List[str]) -> int:
        silinen = 0
        for did in ids:
            try:
                self._repo.delete(did)
                silinen += 1
            except DatabaseError:
                continue
        return silinen

    def auto_clean_keep_richest(self, groups: List[DuplicateGroup]) -> int:
        """Her grupta en cok resim + aciklama olani birakir, digerlerini siler."""
        to_delete: List[str] = []
        for group in groups:
            ranked = sorted(
                group.uyeler,
                key=lambda m: (m.resim_sayisi, m.aciklama_uzunluk, m.guncelleme or ""),
                reverse=True,
            )
            to_delete.extend(m.id for m in ranked[1:])
        return self.delete_ids(to_delete)
