"""Resim dosyalarinin images/ klasorunde yonetimi.

Kural: veritabaninda binary veri tutulmaz; yalnizca ``images/<dosya>.jpg``
bicimindeki GORECELI yol saklanir. Bu servis kopyalama, benzersiz isim
uretme ve silme islerini yapar.
"""

from __future__ import annotations

import logging
import re
import shutil
import unicodedata
import uuid
from pathlib import Path
from typing import Optional

from app.paths import AppPaths

logger = logging.getLogger(__name__)

DESTEKLENEN_UZANTILAR = (".jpg", ".jpeg", ".png", ".webp", ".bmp")
MAX_BOYUT_MB = 15


class ImageError(Exception):
    """Resim kopyalama/silme sirasinda olusan hatalar."""


class ImageService:
    def __init__(self, paths: AppPaths) -> None:
        self._paths = paths

    # ------------------------------------------------------------------
    @property
    def images_dir(self) -> Path:
        return self._paths.images_dir

    def file_dialog_types(self) -> list[tuple[str, str]]:
        """tkinter.filedialog icin uzanti filtresi."""
        patterns = " ".join(f"*{ext}" for ext in DESTEKLENEN_UZANTILAR)
        return [("Resim Dosyalari", patterns), ("Tum Dosyalar", "*.*")]

    # ------------------------------------------------------------------
    def import_image(self, source: str | Path, destinasyon_adi: str = "") -> str:
        """Secilen resmi images/ klasorune kopyalar, goreceli yolu dondurur."""
        src = Path(source)
        if not src.is_file():
            raise ImageError(f"Resim dosyasi bulunamadi: {src}")

        suffix = src.suffix.lower()
        if suffix not in DESTEKLENEN_UZANTILAR:
            raise ImageError(
                f"Desteklenmeyen dosya turu: {suffix or '(uzanti yok)'}. "
                f"Izin verilenler: {', '.join(DESTEKLENEN_UZANTILAR)}"
            )

        boyut_mb = src.stat().st_size / (1024 * 1024)
        if boyut_mb > MAX_BOYUT_MB:
            raise ImageError(f"Resim {MAX_BOYUT_MB} MB sinirini asiyor ({boyut_mb:.1f} MB).")

        self._paths.ensure_directories()
        target = self._unique_target(destinasyon_adi or src.stem, suffix)

        # Kaynak zaten images/ icindeyse tekrar kopyalamaya gerek yok
        try:
            if src.resolve() == target.resolve():
                return self._paths.to_relative(target)
        except OSError:
            pass

        try:
            shutil.copy2(src, target)
        except OSError as exc:
            raise ImageError(f"Resim kopyalanamadi: {exc}") from exc

        logger.info("Resim kopyalandi: %s -> %s", src, target)
        return self._paths.to_relative(target)

    # ------------------------------------------------------------------
    def delete_image(self, relative_path: Optional[str]) -> bool:
        """images/ altindaki resmi siler. Disaridaki yollara dokunmaz."""
        if not relative_path:
            return False

        target = self._paths.to_absolute(relative_path)
        try:
            images_root = self.images_dir.resolve()
            resolved = target.resolve()
            resolved.relative_to(images_root)  # klasor disina cikisi engeller
        except (OSError, ValueError):
            logger.warning("images/ disindaki dosya silinmedi: %s", relative_path)
            return False

        if not resolved.is_file():
            return False
        try:
            resolved.unlink()
        except OSError as exc:
            raise ImageError(f"Resim silinemedi: {exc}") from exc
        logger.info("Resim silindi: %s", resolved)
        return True

    # ------------------------------------------------------------------
    def absolute_path(self, relative_path: Optional[str]) -> Optional[Path]:
        if not relative_path:
            return None
        path = self._paths.to_absolute(relative_path)
        return path if path.is_file() else None

    # ------------------------------------------------------------------
    def _unique_target(self, base_name: str, suffix: str) -> Path:
        slug = self._slugify(base_name) or "destinasyon"
        candidate = self.images_dir / f"{slug}{suffix}"
        if not candidate.exists():
            return candidate
        # Cakismayi kisa bir benzersiz ek ile coz
        for _ in range(10):
            token = uuid.uuid4().hex[:6]
            candidate = self.images_dir / f"{slug}_{token}{suffix}"
            if not candidate.exists():
                return candidate
        raise ImageError("Benzersiz dosya adi uretilemedi.")

    @staticmethod
    def _slugify(value: str) -> str:
        """Turkce karakterleri sadelestirip dosya adina uygun hale getirir."""
        replacements = {
            "ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g",
            "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c",
        }
        for src, dst in replacements.items():
            value = value.replace(src, dst)
        value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
        value = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
        return value[:60]
