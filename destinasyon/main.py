"""Uygulama giris noktasi — once modul hub, sonra secilen panel."""

from __future__ import annotations

import logging
import sys
from tkinter import messagebox

from app import __app_name__
from app.config import ConfigError, ConfigManager
from app.database import DatabaseManager
from app.paths import AppPaths
from app.ui.main_window import MainWindow
from app.ui.module_hub import ModuleHub
from app.ui.partner_window import PartnerWindow
from app.partner_repository import HOTELS, TOURS


def setup_logging(paths: AppPaths) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    try:
        handlers.append(logging.FileHandler(paths.root / "app.log", encoding="utf-8"))
    except OSError:
        pass
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=handlers,
    )


def run_module(
    choice: str,
    paths: AppPaths,
    config,
    config_manager: ConfigManager,
    db: DatabaseManager,
    reopen_hub,
) -> None:
    if choice == "destinations":
        window = MainWindow(
            paths=paths,
            config=config,
            config_manager=config_manager,
            db=db,
            on_back=reopen_hub,
        )
        window.protocol("WM_DELETE_WINDOW", window._return_to_hub)
        window.mainloop()
    elif choice == "hotels":
        win = PartnerWindow(
            config,
            db,
            HOTELS,
            "Otel Yönetimi",
            "Yıldız (1-5)",
            reopen_hub,
        )
        win.mainloop()
    elif choice == "tours":
        win = PartnerWindow(
            config,
            db,
            TOURS,
            "Tur Firması Yönetimi",
            "Hizmet türü",
            reopen_hub,
        )
        win.mainloop()


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

    def hub_loop() -> None:
        hub = ModuleHub(config)
        hub.mainloop()
        choice = hub.choice or "exit"
        if choice == "exit":
            return
        run_module(choice, paths, config, config_manager, db, hub_loop)

    try:
        hub_loop()
    finally:
        db.close()
        logger.info("Uygulama kapatildi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
