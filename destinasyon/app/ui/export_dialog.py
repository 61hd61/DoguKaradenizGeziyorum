"""Veri paketi disa / ice aktarma secim penceresi."""

from __future__ import annotations

import customtkinter as ctk
from tkinter import filedialog, messagebox
from typing import Callable, Optional

from app.services.paket_service import PaketSecenekleri, PaketService
from app.ui.theme import PAD, Theme


class PaketDialog(ctk.CTkToplevel):
    def __init__(
        self,
        master,
        theme: Theme,
        paket: PaketService,
        mode: str,
        on_done: Optional[Callable[[], None]] = None,
    ) -> None:
        super().__init__(master)
        self._paket = paket
        self._mode = mode
        self._on_done = on_done
        self.theme = theme
        self.title("Veri paketi — disa aktar" if mode == "export" else "Veri paketi — ice aktar")
        self.geometry("420x380")
        self.transient(master)
        self.grab_set()

        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=PAD, pady=PAD)

        ctk.CTkLabel(
            body,
            text="Hangi veriler pakete dahil edilsin?",
            font=theme.fonts["card_title"],
            anchor="w",
        ).pack(fill="x", pady=(0, 8))

        self.var_dest = ctk.BooleanVar(value=True)
        self.var_users = ctk.BooleanVar(value=True)
        self.var_profiles = ctk.BooleanVar(value=True)
        self.var_posts = ctk.BooleanVar(value=True)
        self.var_images = ctk.BooleanVar(value=True)

        for text, var in [
            ("Destinasyonlar (ad, aciklama, koordinat, resimler)", self.var_dest),
            ("Kullanici hesaplari (sifreler hash olarak)", self.var_users),
            ("Kisisel profil bilgileri", self.var_profiles),
            ("Blog / gonderiler", self.var_posts),
            ("Resim dosyalarini da kopyala", self.var_images),
        ]:
            ctk.CTkCheckBox(body, text=text, variable=var).pack(anchor="w", pady=4)

        btn_row = ctk.CTkFrame(body, fg_color="transparent")
        btn_row.pack(fill="x", pady=(16, 0))

        ctk.CTkButton(
            btn_row,
            text="Iptal",
            fg_color="transparent",
            border_width=1,
            command=self.destroy,
        ).pack(side="right", padx=(6, 0))

        action = "Buraya / secilen klasore kaydet" if mode == "export" else "Paketi yukle"
        ctk.CTkButton(btn_row, text=action, command=self._run).pack(side="right")

    def _secenekler(self) -> PaketSecenekleri:
        return PaketSecenekleri(
            destinasyonlar=self.var_dest.get(),
            kullanicilar=self.var_users.get(),
            profiller=self.var_profiles.get(),
            blog_yazilari=self.var_posts.get(),
            resimleri_kopyala=self.var_images.get(),
        )

    def _run(self) -> None:
        opts = self._secenekler()
        if not any(
            [
                opts.destinasyonlar,
                opts.kullanicilar,
                opts.profiller,
                opts.blog_yazilari,
            ]
        ):
            messagebox.showwarning("Secim yok", "En az bir veri turu secin.", parent=self)
            return
        try:
            if self._mode == "export":
                initial = str(self._paket.varsayilan_klasor)
                hedef = filedialog.askdirectory(
                    title="Veri paketinin kaydedilecegi klasor",
                    initialdir=initial if self._paket.varsayilan_klasor.is_dir() else None,
                    parent=self,
                )
                if not hedef:
                    return
                sonuc = self._paket.export_paket(hedef, opts)
            else:
                kaynak = filedialog.askdirectory(
                    title="Yuklenecek veri paketi klasoru (manifest.json iceren)",
                    parent=self,
                )
                if not kaynak:
                    return
                sonuc = self._paket.import_paket(kaynak, opts)
            messagebox.showinfo(
                "Tamam",
                f"Paket islemi bitti.\n"
                f"Destinasyon: {sonuc.destinasyon_sayisi}\n"
                f"Kullanici: {sonuc.kullanici_sayisi}\n"
                f"Blog: {sonuc.blog_sayisi}\n"
                f"Kopyalanan resim: {sonuc.resim_sayisi}\n"
                f"Klasor: {sonuc.hedef}",
                parent=self,
            )
            if self._on_done:
                self._on_done()
            self.destroy()
        except Exception as exc:
            messagebox.showerror("Hata", str(exc), parent=self)
