"""Uygulama giris noktasi.

Calistirma:
    python main.py

Akis:
    1. Yollar tespit edilir (kaynak kod / PyInstaller .exe).
    2. config.ini okunur (yoksa varsayilanlarla olusturulur).
    3. images/ klasoru garanti altina alinir.
    4. CustomTkinter penceresi acilir. Veritabani baglantisi pencere
       cizildikten sonra denenir; basarisiz olursa uygulama kapanmaz,
       "baglanti yok" modunda calismaya devam eder.
"""

from __future__ import annotations

import logging
import sys
from tkinter import messagebox

from app import __app_name__
from app.config import ConfigError, ConfigManager
from app.database import DatabaseManager
from app.paths import AppPaths
from app.ui.main_window import MainWindow


def setup_logging(paths: AppPaths) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    try:
        handlers.append(logging.FileHandler(paths.root / "app.log", encoding="utf-8"))
    except OSError:
        pass  # salt-okunur klasorde calisiyorsa yalnizca konsola yaz
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=handlers,
    )


def main() -> int:
    paths = AppPaths()
    setup_logging(paths)
    logger = logging.getLogger("main")
    logger.info("%s baslatiliyor. Kok dizin: %s", __app_name__, paths.root)

    config_manager = ConfigManager(paths)
    try:
        config = config_manager.load()
    except ConfigError as exc:
        logger.error("Yapilandirma hatasi: %s", exc)
        messagebox.showerror("Yapilandirma Hatasi", str(exc))
        return 1

    paths.ensure_directories()

    db = DatabaseManager(config.database)
    window = MainWindow(
        paths=paths, config=config, config_manager=config_manager, db=db
    )
    try:
        window.mainloop()
    finally:
        db.close()
        logger.info("Uygulama kapatildi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
