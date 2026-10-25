#!/usr/bin/env python3
"""ödev/ altındaki 6 il verisini PostgreSQL (destinations) şemasına aktarır."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def main() -> int:
    odev_root = Path(__file__).resolve().parents[2]
    import_script = (
        odev_root / "turizm-platformu" / "packages" / "database" / "prisma" / "import_data_new.py"
    )
    if not import_script.is_file():
        print(f"[HATA] Import scripti bulunamadi: {import_script}")
        return 1

    env = os.environ.copy()
    env["ODEV_ROOT"] = str(odev_root)
    print(f"[BILGI] Veri kaynagi: {odev_root}")
    print(f"[BILGI] Resim hedefi: {odev_root / 'destinasyon' / 'images'}")
    print("[BILGI] Iller: Trabzon, Giresun, Ordu, Gumushane, Rize, Artvin")

    result = subprocess.run([sys.executable, str(import_script)], env=env, check=False)
    return int(result.returncode or 0)


if __name__ == "__main__":
    raise SystemExit(main())
