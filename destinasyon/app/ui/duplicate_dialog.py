"""Cift destinasyon kayitlarini listeleme ve temizleme penceresi."""

from __future__ import annotations

import customtkinter as ctk
from tkinter import messagebox
from typing import Callable, List, Optional

from app.services.duplicate_service import DuplicateGroup, DuplicateService
from app.ui.theme import PAD, Theme


class DuplicateDialog(ctk.CTkToplevel):
    def __init__(
        self,
        master,
        theme: Theme,
        service: DuplicateService,
        on_done: Optional[Callable[[], None]] = None,
    ) -> None:
        super().__init__(master)
        self._service = service
        self._on_done = on_done
        self.theme = theme
        self._groups: List[DuplicateGroup] = []

        self.title("Cift kayit temizleme")
        self.geometry("720x520")
        self.transient(master)
        self.grab_set()

        p = theme.palette
        top = ctk.CTkFrame(self, fg_color="transparent")
        top.pack(fill="x", padx=PAD, pady=PAD)

        ctk.CTkLabel(
            top,
            text="Ayni ilde ayni ada sahip destinasyonlar",
            font=theme.fonts["card_title"],
        ).pack(anchor="w")
        self.summary = ctk.CTkLabel(top, text="Yukleniyor...", text_color=p.text_muted)
        self.summary.pack(anchor="w", pady=(4, 8))

        btn_row = ctk.CTkFrame(top, fg_color="transparent")
        btn_row.pack(fill="x")
        ctk.CTkButton(btn_row, text="Yenile", width=80, command=self.reload).pack(side="left")
        ctk.CTkButton(
            btn_row,
            text="En zengin kaydi birak (otomatik)",
            fg_color=p.accent,
            hover_color=p.accent_hover,
            command=self.auto_clean,
        ).pack(side="left", padx=(8, 0))

        self.text = ctk.CTkTextbox(self, wrap="word", font=theme.fonts["body"])
        self.text.pack(fill="both", expand=True, padx=PAD, pady=(0, PAD))
        self.text.configure(state="disabled")

        self.after(100, self.reload)

    def reload(self) -> None:
        try:
            self._groups = self._service.find_groups()
        except Exception as exc:
            messagebox.showerror("Hata", str(exc), parent=self)
            return
        toplam_fazla = sum(g.adet - 1 for g in self._groups)
        self.summary.configure(
            text=f"{len(self._groups)} cift grup, silinebilecek {toplam_fazla} tekrar kayit"
        )
        self.text.configure(state="normal")
        self.text.delete("1.0", "end")
        if not self._groups:
            self.text.insert("end", "Cift kayit bulunamadi.")
        else:
            for i, g in enumerate(self._groups, 1):
                self.text.insert("end", f"--- Grup {i}: {g.il_ad} / {g.norm_ad} ({g.adet} adet) ---\n")
                for m in g.uyeler:
                    self.text.insert(
                        "end",
                        f"  • {m.ad}\n"
                        f"    id={m.id[:8]}…  resim={m.resim_sayisi}  aciklama={m.aciklama_uzunluk} karakter\n",
                    )
                self.text.insert("end", "\n")
        self.text.configure(state="disabled")

    def auto_clean(self) -> None:
        if not self._groups:
            messagebox.showinfo("Bilgi", "Temizlenecek cift kayit yok.", parent=self)
            return
        fazla = sum(g.adet - 1 for g in self._groups)
        if not messagebox.askyesno(
            "Onay",
            f"{fazla} tekrar kayit silinecek.\n"
            "Her grupta en cok resim ve aciklamasi olan kayit kalir.\nDevam?",
            parent=self,
        ):
            return
        try:
            silinen = self._service.auto_clean_keep_richest(self._groups)
            messagebox.showinfo("Tamam", f"{silinen} kayit silindi.", parent=self)
            if self._on_done:
                self._on_done()
            self.reload()
        except Exception as exc:
            messagebox.showerror("Hata", str(exc), parent=self)
