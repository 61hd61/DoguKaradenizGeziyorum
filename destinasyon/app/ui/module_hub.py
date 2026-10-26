"""Ana modul secim ekrani — destinasyon / otel / tur firmasi."""

from __future__ import annotations

from typing import Literal, Optional

import customtkinter as ctk

from app import __app_name__, __version__
from app.config import AppConfig
from app.ui.theme import PAD, Theme

ModuleChoice = Literal["destinations", "hotels", "tours", "exit"]


class ModuleHub(ctk.CTk):
    def __init__(self, config: AppConfig) -> None:
        super().__init__()
        self.choice: Optional[ModuleChoice] = None
        self.theme = Theme(config.application.theme)
        self.theme.apply_global()
        self.fonts = self.theme.fonts()
        p = self.theme.palette

        self.title(f"{__app_name__} — Modul Secimi  v{__version__}")
        self.geometry("920x560")
        self.minsize(800, 480)
        self.configure(fg_color=p.background)

        wrap = ctk.CTkFrame(self, fg_color="transparent")
        wrap.pack(expand=True, fill="both", padx=PAD * 2, pady=PAD * 2)

        ctk.CTkLabel(
            wrap,
            text="Veri Yönetim Paneli",
            font=self.fonts["title"],
        ).pack(pady=(20, 4))
        ctk.CTkLabel(
            wrap,
            text="Yönetmek istediğiniz bölümü seçin. Her modül ayrı pencerede açılır.",
            font=self.fonts["subtitle"],
            text_color=p.text_muted,
        ).pack(pady=(0, 28))

        cards = ctk.CTkFrame(wrap, fg_color="transparent")
        cards.pack(expand=True)
        cards.grid_columnconfigure((0, 1, 2), weight=1, uniform="c")

        self._card(
            cards,
            0,
            "🏛 Destinasyonlar",
            "Turizm noktaları, koordinat,\ngörseller, çift kayıt, veri paketi",
            p.accent,
            lambda: self._pick("destinations"),
        )
        self._card(
            cards,
            1,
            "🏨 Oteller",
            "Konaklama iş ortakları,\nyıldız, iletişim bilgileri",
            "#0d9488",
            lambda: self._pick("hotels"),
        )
        self._card(
            cards,
            2,
            "🚌 Tur Firmaları",
            "Tur operatörleri,\nhizmet türü, iletişim",
            "#7c3aed",
            lambda: self._pick("tours"),
        )

        ctk.CTkButton(
            wrap,
            text="Çıkış",
            width=120,
            height=36,
            fg_color=p.surface_alt,
            hover_color=p.border,
            text_color=p.text_muted,
            command=lambda: self._pick("exit"),
        ).pack(pady=(24, 8))

        self.protocol("WM_DELETE_WINDOW", lambda: self._pick("exit"))

    def _card(
        self,
        parent: ctk.CTkFrame,
        col: int,
        title: str,
        subtitle: str,
        color: str,
        command,
    ) -> None:
        p = self.theme.palette
        frame = ctk.CTkFrame(
            parent,
            width=240,
            height=220,
            corner_radius=16,
            fg_color=p.surface,
            border_width=1,
            border_color=p.border,
        )
        frame.grid(row=0, column=col, padx=12, sticky="nsew")
        frame.grid_propagate(False)

        ctk.CTkLabel(frame, text=title, font=self.fonts["detail_title"]).pack(pady=(28, 8))
        ctk.CTkLabel(
            frame,
            text=subtitle,
            font=self.fonts["label"],
            text_color=p.text_muted,
            justify="center",
        ).pack(padx=12)
        ctk.CTkButton(
            frame,
            text="Aç",
            width=120,
            height=38,
            corner_radius=10,
            fg_color=color,
            hover_color=color,
            command=command,
        ).pack(pady=(20, 0))

    def _pick(self, choice: ModuleChoice) -> None:
        self.choice = choice
        self.destroy()
