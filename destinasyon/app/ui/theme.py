"""Tema: renk paleti, yazi tipleri ve ttk.Treeview stillendirmesi.

CustomTkinter kendi widget'larini temalandirir; ancak tablo icin
ttk.Treeview kullanildigi icin onun stili elle tanimlanir. Tum renkler
tek yerden yonetilir.
"""

from __future__ import annotations

from dataclasses import dataclass
from tkinter import ttk

import customtkinter as ctk


@dataclass(frozen=True)
class Palette:
    background: str
    surface: str
    surface_alt: str
    border: str
    text: str
    text_muted: str
    accent: str
    accent_hover: str
    danger: str
    danger_hover: str
    success: str
    warning: str
    row_alt: str


DARK = Palette(
    background="#0f1720",
    surface="#16202b",
    surface_alt="#1d2935",
    border="#2b3947",
    text="#e6edf3",
    text_muted="#8fa3b8",
    accent="#2f81f7",
    accent_hover="#4894fb",
    danger="#d9484c",
    danger_hover="#e9595d",
    success="#3fb950",
    warning="#d29922",
    row_alt="#1a2431",
)

LIGHT = Palette(
    background="#f4f6f9",
    surface="#ffffff",
    surface_alt="#eef2f7",
    border="#d4dbe4",
    text="#1b2631",
    text_muted="#5b6b7c",
    accent="#1f6feb",
    accent_hover="#3b82f6",
    danger="#c4353a",
    danger_hover="#d94a4f",
    success="#1a7f37",
    warning="#9a6700",
    row_alt="#f7f9fc",
)

# Olcu birimleri (tek yerden ayarlanabilir)
CORNER = 10
PAD = 12
FONT_FAMILY = "Segoe UI"


class Theme:
    """Aktif temayi tasiyan ve ttk stillerini uygulayan yardimci."""

    def __init__(self, mode: str = "dark") -> None:
        self.mode = "light" if mode.lower() == "light" else "dark"
        self.palette = LIGHT if self.mode == "light" else DARK

    # ------------------------------------------------------------------
    def apply_global(self) -> None:
        ctk.set_appearance_mode(self.mode)
        ctk.set_default_color_theme("blue")

    # ------------------------------------------------------------------
    def fonts(self) -> dict:
        return {
            "title": ctk.CTkFont(family=FONT_FAMILY, size=17, weight="bold"),
            "subtitle": ctk.CTkFont(family=FONT_FAMILY, size=12),
            "card_title": ctk.CTkFont(family=FONT_FAMILY, size=14, weight="bold"),
            "label": ctk.CTkFont(family=FONT_FAMILY, size=12),
            "body": ctk.CTkFont(family=FONT_FAMILY, size=13),
            "hint": ctk.CTkFont(family=FONT_FAMILY, size=11),
            "detail_title": ctk.CTkFont(family=FONT_FAMILY, size=16, weight="bold"),
        }

    # ------------------------------------------------------------------
    def style_treeview(self, widget) -> ttk.Style:
        """Tabloyu (ttk.Treeview) tema renklerine uydurur."""
        p = self.palette
        style = ttk.Style(widget)
        try:
            style.theme_use("clam")  # renk ayarlarini destekleyen tek tema
        except Exception:
            pass

        style.configure(
            "Destinasyon.Treeview",
            background=p.surface,
            fieldbackground=p.surface,
            foreground=p.text,
            bordercolor=p.border,
            borderwidth=0,
            rowheight=30,
            font=(FONT_FAMILY, 10),
        )
        style.map(
            "Destinasyon.Treeview",
            background=[("selected", p.accent)],
            foreground=[("selected", "#ffffff")],
        )
        style.configure(
            "Destinasyon.Treeview.Heading",
            anchor="w",
            background=p.surface_alt,
            foreground=p.text_muted,
            relief="flat",
            borderwidth=0,
            padding=(8, 8),
            font=(FONT_FAMILY, 10, "bold"),
        )
        style.map(
            "Destinasyon.Treeview.Heading",
            background=[("active", p.border)],
            foreground=[("active", p.text)],
        )
        style.layout(
            "Destinasyon.Treeview",
            [("Destinasyon.Treeview.treearea", {"sticky": "nswe"})],
        )
        return style
