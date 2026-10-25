"""Veri modelleri ve dogrulama kurallari."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Mapping, Optional, Tuple

# Sabit il listesi (iller tablosu ile ayni sirada tutulur)
ILLER: Tuple[str, ...] = (
    "Trabzon",
    "Giresun",
    "Ordu",
    "Gümüşhane",
    "Rize",
    "Artvin",
)

# Varsayilan destinasyon turleri (kullanici yenilerini ekleyebilir)
VARSAYILAN_TURLER: Tuple[str, ...] = (
    "Cami",
    "Türbe",
    "Kilise",
    "Şapel",
    "Kale",
    "Tarihi bina",
    "Han",
    "Hamam",
    "Şelale",
    "Köprü",
    "Sivil mimari",
    "Mağara",
    "Milli park",
    "Müze",
    "Şenlikler",
    "Göl",
    "Kanyon",
)

# Il bazinda yaklasik bounding box (uyari amacli, engelleyici degil)
# (enlem_min, enlem_max, boylam_min, boylam_max)
IL_KOORDINAT: Dict[str, Tuple[float, float, float, float]] = {
    "Ordu": (40.50, 41.15, 37.15, 38.20),
    "Giresun": (40.35, 41.15, 37.95, 39.10),
    "Gümüşhane": (40.05, 40.75, 38.75, 39.95),
    "Trabzon": (40.45, 41.25, 39.15, 40.45),
    "Rize": (40.70, 41.30, 40.25, 41.35),
    "Artvin": (40.80, 41.65, 41.15, 42.55),
}

# Tum bolge (secili il yoksa)
BOLGE_ENLEM = (40.00, 41.70)
BOLGE_BOYLAM = (37.10, 42.60)


class ValidationError(Exception):
    """Form verisi gecersiz oldugunda firlatilir."""

    def __init__(self, errors: List[str]) -> None:
        self.errors = errors
        super().__init__("; ".join(errors))


@dataclass
class LookupItem:
    """iller / destinasyon_turleri veya provinces / destination_types satiri."""

    id: str
    ad: str


@dataclass
class Destinasyon:
    """destinations (web) veya trabzon_destinasyonlar (legacy) satiri."""

    id: Optional[str] = None
    ad: str = ""
    aciklama: str = ""
    il_id: Optional[str] = None
    tur_id: Optional[str] = None
    il_ad: str = ""
    tur_ad: str = ""
    enlem: Optional[Decimal] = None
    boylam: Optional[Decimal] = None
    resim_yolu: Optional[str] = None
    resim_yollari: List[str] = field(default_factory=list)
    kisa_aciklama: str = ""
    olusturma_tarihi: Optional[datetime] = None
    guncelleme_tarihi: Optional[datetime] = None

    # ------------------------------------------------------------------
    @classmethod
    def from_row(cls, row: Mapping[str, Any]) -> "Destinasyon":
        resimler = cls._parse_resimler(row)
        thumb = row.get("resim_yolu") or (resimler[0] if resimler else None)
        aciklama = row.get("aciklama") or ""
        kisa = row.get("kisa_aciklama") or ""
        return cls(
            id=str(row["id"]) if row.get("id") is not None else None,
            ad=row["ad"] or "",
            aciklama=aciklama,
            kisa_aciklama=kisa or aciklama[:500],
            il_id=row.get("il_id"),
            tur_id=row.get("tur_id"),
            il_ad=row.get("il_ad") or "",
            tur_ad=row.get("tur_ad") or "",
            enlem=row.get("enlem"),
            boylam=row.get("boylam"),
            resim_yolu=thumb,
            resim_yollari=resimler,
            olusturma_tarihi=row.get("olusturma_tarihi"),
            guncelleme_tarihi=row.get("guncelleme_tarihi"),
        )

    @staticmethod
    def _parse_resimler(row: Mapping[str, Any]) -> List[str]:
        raw = row.get("resim_yollari")
        if raw is None:
            single = row.get("resim_yolu")
            return [single] if single else []
        if isinstance(raw, (list, tuple)):
            return [str(x) for x in raw if x]
        text = str(raw).strip()
        if text.startswith("{") and text.endswith("}"):
            inner = text[1:-1].strip()
            if not inner:
                return []
            parts: List[str] = []
            current = ""
            in_quotes = False
            for ch in inner:
                if ch == '"':
                    in_quotes = not in_quotes
                    continue
                if ch == "," and not in_quotes:
                    if current.strip():
                        parts.append(current.strip())
                    current = ""
                else:
                    current += ch
            if current.strip():
                parts.append(current.strip())
            return parts
        return [text] if text else []

    # ------------------------------------------------------------------
    def validate(self) -> None:
        """Kaydetmeden once is kurallarini dogrular."""
        errors: List[str] = []

        if not self.ad or not self.ad.strip():
            errors.append("Destinasyon adi bos olamaz.")
        elif len(self.ad.strip()) > 150:
            errors.append("Destinasyon adi en fazla 150 karakter olabilir.")

        if not self.il_id:
            errors.append("Il secimi zorunludur.")
        if not self.tur_id:
            errors.append("Destinasyon turu zorunludur.")

        self.enlem = self._check_coordinate(self.enlem, "Enlem", -90, 90, errors)
        self.boylam = self._check_coordinate(self.boylam, "Boylam", -180, 180, errors)

        paths = self.resim_yollari or []
        if self.resim_yolu and self.resim_yolu not in paths:
            paths = [self.resim_yolu, *paths]
        self.resim_yollari = [p for p in paths if p]
        self.resim_yolu = self.resim_yollari[0] if self.resim_yollari else self.resim_yolu
        for path in self.resim_yollari:
            if len(path) > 512:
                errors.append("Resim yolu cok uzun (512 karakter siniri).")
                break

        if errors:
            raise ValidationError(errors)

    def koordinat_bolge_disinda(self) -> bool:
        """Koordinat secili ilin (veya genel bolgenin) disindaysa True."""
        if self.enlem is None or self.boylam is None:
            return False
        enlem = float(self.enlem)
        boylam = float(self.boylam)
        kutu = IL_KOORDINAT.get(self.il_ad)
        if kutu:
            e_min, e_max, b_min, b_max = kutu
            return not (e_min <= enlem <= e_max and b_min <= boylam <= b_max)
        return not (
            BOLGE_ENLEM[0] <= enlem <= BOLGE_ENLEM[1]
            and BOLGE_BOYLAM[0] <= boylam <= BOLGE_BOYLAM[1]
        )

    # eski isim: bazi testler bunu cagiriyor
    def koordinat_trabzon_disinda(self) -> bool:
        return self.koordinat_bolge_disinda()

    # ------------------------------------------------------------------
    @staticmethod
    def _check_coordinate(
        value: Any, label: str, low: float, high: float, errors: List[str]
    ) -> Optional[Decimal]:
        if value is None or (isinstance(value, str) and not value.strip()):
            errors.append(f"{label} alani zorunludur.")
            return None
        try:
            normalized = str(value).strip().replace(",", ".")
            number = Decimal(normalized)
        except (InvalidOperation, ValueError):
            errors.append(f"{label} gecerli bir sayi olmalidir.")
            return None
        if not (Decimal(str(low)) <= number <= Decimal(str(high))):
            errors.append(f"{label} {low} ile {high} arasinda olmalidir.")
            return None
        return number.quantize(Decimal("0.000001"))
