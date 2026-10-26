#!/usr/bin/env python3
"""veritabani/ paketini PostgreSQL'e yukler (6 il klasoru gerekmez)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import ConfigManager
from app.database import DatabaseManager
from app.paths import AppPaths
from app.services.paket_service import PaketSecenekleri, PaketService


def main() -> int:
    paket = ROOT / "veritabani"
    if not (paket / "manifest.json").is_file():
        print(f"[HATA] Paket bulunamadi: {paket / 'manifest.json'}")
        return 1

    paths = AppPaths()
    config = ConfigManager(paths).load()
    db = DatabaseManager(config.database)
    try:
        db.connect()
        svc = PaketService(paths, db)
        sonuc = svc.import_paket(paket, PaketSecenekleri())
        print(f"[OK] {sonuc.destinasyon_sayisi} destinasyon yuklendi.")
        return 0
    except Exception as exc:
        print(f"[HATA] {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
