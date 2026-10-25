"""Calisma dizini ve dosya yolu yonetimi.

PyInstaller ile paketlendiginde (``sys.frozen``) uygulamanin "kok dizini"
exe dosyasinin bulundugu klasordur. Kaynak koddan calistirildiginda ise
proje kok dizinidir. config.ini ve images/ klasoru her iki durumda da
bu kok dizinin altinda aranir.
"""

from __future__ import annotations

import sys
from pathlib import Path


class AppPaths:
    """Uygulamanin kullandigi tum dosya/klasor yollarini tek yerden uretir."""

    CONFIG_FILENAME = "config.ini"

    def __init__(self, images_dirname: str = "images") -> None:
        self._root = self._detect_root()
        self._images_dirname = images_dirname

    # ------------------------------------------------------------------
    # Kok dizin tespiti
    # ------------------------------------------------------------------
    @staticmethod
    def _detect_root() -> Path:
        if getattr(sys, "frozen", False):  # PyInstaller ile uretilmis .exe
            return Path(sys.executable).resolve().parent
        # app/paths.py -> app/ -> proje koku
        return Path(__file__).resolve().parent.parent

    # ------------------------------------------------------------------
    # Yollar
    # ------------------------------------------------------------------
    @property
    def root(self) -> Path:
        """app.exe (veya main.py) ile ayni seviyedeki kok dizin."""
        return self._root

    @property
    def config_file(self) -> Path:
        return self._root / self.CONFIG_FILENAME

    @property
    def images_dir(self) -> Path:
        return self._root / self._images_dirname

    @property
    def assets_dir(self) -> Path:
        """Ikon/QSS gibi salt-okunur kaynaklar.

        PyInstaller'da ``--add-data`` ile gomulen dosyalar gecici
        ``sys._MEIPASS`` klasorune acilir.
        """
        bundle = getattr(sys, "_MEIPASS", None)
        if bundle:
            return Path(bundle) / "assets"
        return self._root / "assets"

    # ------------------------------------------------------------------
    def set_images_dirname(self, dirname: str) -> None:
        """config.ini okunduktan sonra images klasor adini gunceller."""
        if dirname and dirname.strip():
            self._images_dirname = dirname.strip()

    def ensure_directories(self) -> None:
        """Eksik klasorleri olusturur (ilk calistirmada images/ gibi)."""
        self.images_dir.mkdir(parents=True, exist_ok=True)

    def to_relative(self, path: Path) -> str:
        """Kok dizine goreceli, ileri-slash'li yol uretir (DB'de saklanir)."""
        try:
            rel = Path(path).resolve().relative_to(self._root)
        except ValueError:
            rel = Path(path)
        return rel.as_posix()

    def to_absolute(self, relative_path: str) -> Path:
        """DB'deki goreceli yolu tam yola cevirir.

        Basta egik cizgi olan yollar (``/images/a.jpg``) Windows'ta kok
        dizini dusurur. images/ altina inmesi icin onlar da goreceli sayilir.
        """
        cleaned = relative_path.strip().replace("\\", "/").lstrip("/")
        candidate = Path(cleaned)
        if candidate.is_absolute():
            return candidate
        return self._root / candidate

    def __repr__(self) -> str:  # pragma: no cover - tanilama amacli
        return f"AppPaths(root={self._root!s}, images={self.images_dir!s})"
