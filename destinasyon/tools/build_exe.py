"""PyInstaller ile onedir dagitim klasoru uretir.

Cikti:
    dist/Turizm_Veri_App/
        app.exe
        _internal/          (kutuphaneler)
        config.ini          (yerel kopya; parola icerebilir - DAGITMAYIN)
        config.example.ini  (parolasiz sablon)
        images/             (bos resim klasoru)

Kullanim:
    python tools/build_exe.py
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST_NAME = "Turizm_Veri_App"
DIST_DIR = ROOT / "dist" / DIST_NAME
SPEC = ROOT / "app.spec"


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.check_call(cmd, cwd=ROOT)


def copy_runtime_files() -> None:
    DIST_DIR.mkdir(parents=True, exist_ok=True)

    # Yerel calistirma icin mevcut config.ini kopyalanir (varsa).
    # Parola icerebilecegi icin dagitimda config.example.ini kullanin.
    src_config = ROOT / "config.ini"
    if src_config.exists():
        shutil.copy2(src_config, DIST_DIR / "config.ini")
        print(f"config.ini kopyalandi -> {DIST_DIR / 'config.ini'}")
    else:
        shutil.copy2(ROOT / "config.example.ini", DIST_DIR / "config.ini")
        print("config.ini yoktu; ornek sablon kopyalandi.")

    shutil.copy2(ROOT / "config.example.ini", DIST_DIR / "config.example.ini")

    images = DIST_DIR / "images"
    images.mkdir(exist_ok=True)
    keep = images / ".gitkeep"
    if not keep.exists():
        keep.write_text("", encoding="utf-8")
    print(f"images/ hazir: {images}")


def main() -> int:
    if not SPEC.exists():
        print(f"[HATA] Spec dosyasi yok: {SPEC}")
        return 1

    icon_script = ROOT / "tools" / "make_icon.py"
    if icon_script.exists() and not (ROOT / "assets" / "app.ico").exists():
        run([sys.executable, str(icon_script)])

    run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            "--noconfirm",
            "--clean",
            str(SPEC),
        ]
    )

    if not (DIST_DIR / "app.exe").exists():
        print(f"[HATA] app.exe uretilmedi: {DIST_DIR}")
        return 1

    copy_runtime_files()
    print(f"\nHazir: {DIST_DIR / 'app.exe'}")
    print("Calistirmak icin bu klasordeki app.exe'ye cift tiklayin.")
    print("Baska bir makineye verirken config.example.ini'yi config.ini olarak kopyalayip doldurun.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
