# -*- mode: python ; coding: utf-8 -*-
"""Turizm Veri App - PyInstaller onedir yapilandirmasi."""

from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_data_files

ROOT = Path(SPECPATH)

datas = collect_data_files("customtkinter")
binaries = []
hiddenimports = [
    "pg8000",
    "pg8000.dbapi",
    "pg8000.core",
    "scramp",
    "asn1crypto",
    "PIL",
    "PIL._tkinter_finder",
    "PIL.Image",
    "PIL.ImageTk",
]

# customtkinter tema/font dosyalari + alt paketler
ctk_datas, ctk_binaries, ctk_hidden = collect_all("customtkinter")
datas += ctk_datas
binaries += ctk_binaries
hiddenimports += ctk_hidden

icon_path = ROOT / "assets" / "app.ico"
icon = str(icon_path) if icon_path.exists() else None

a = Analysis(
    ["main.py"],
    pathex=[str(ROOT)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "PyQt5",
        "PyQt6",
        "PySide2",
        "PySide6",
        "psycopg2",
        "numpy",
        "pytest",
        "IPython",
        "matplotlib",
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="app",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=icon,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="Turizm_Veri_App",
)
