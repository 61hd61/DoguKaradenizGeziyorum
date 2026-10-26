"""Otel ve tur firmasi yonetim penceresi."""

from __future__ import annotations

from tkinter import messagebox, ttk
from typing import Callable, Dict, List, Optional

import customtkinter as ctk

from app.config import AppConfig
from app.database import DatabaseError, DatabaseManager
from app.partner_repository import HOTELS, TOURS, PartnerRecord, PartnerRepository, ensure_partner_tables
from app.ui.theme import PAD, Theme


class PartnerWindow(ctk.CTk):
    def __init__(
        self,
        config: AppConfig,
        db: DatabaseManager,
        table: str,
        title: str,
        extra_label: str,
        on_back: Callable[[], None],
    ) -> None:
        super().__init__()
        self._db = db
        self._repo = PartnerRepository(db, table)
        self._table = table
        self._on_back = on_back
        self._selected_id: Optional[str] = None
        self._extra_label = extra_label

        self.theme = Theme(config.application.theme)
        self.fonts = self.theme.fonts()
        p = self.theme.palette
        self.title(title)
        self.geometry("1100x720")
        self.minsize(900, 600)
        self.configure(fg_color=p.background)

        header = ctk.CTkFrame(self, fg_color=p.surface, corner_radius=0, height=64)
        header.pack(fill="x")
        header.pack_propagate(False)
        ctk.CTkLabel(header, text=title, font=self.fonts["title"]).pack(side="left", padx=PAD)
        ctk.CTkButton(
            header,
            text="← Ana menü",
            width=110,
            command=self._go_back,
        ).pack(side="right", padx=PAD)

        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=PAD, pady=PAD)
        body.grid_columnconfigure(0, weight=2)
        body.grid_columnconfigure(1, weight=1)
        body.grid_rowconfigure(1, weight=1)

        self.search_var = ctk.StringVar()
        search_row = ctk.CTkFrame(body, fg_color="transparent")
        search_row.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, PAD))
        ctk.CTkEntry(search_row, textvariable=self.search_var, placeholder_text="Ara…", width=280).pack(
            side="left", padx=(0, 8)
        )
        ctk.CTkButton(search_row, text="Listele", width=90, command=self.refresh).pack(side="left")

        table_frame = ctk.CTkFrame(body, fg_color=p.surface)
        table_frame.grid(row=1, column=0, sticky="nsew", padx=(0, PAD))
        self._tree = ttk.Treeview(table_frame, columns=("ad", "il", "extra"), show="headings", height=18)
        self._tree.heading("ad", text="Ad")
        self._tree.heading("il", text="İl")
        self._tree.heading("extra", text=extra_label)
        self._tree.column("ad", width=220)
        self._tree.column("il", width=100)
        self._tree.column("extra", width=100)
        self._tree.pack(fill="both", expand=True, padx=8, pady=8)
        self._tree.bind("<<TreeviewSelect>>", self._on_select)

        form = ctk.CTkFrame(body, fg_color=p.surface)
        form.grid(row=1, column=1, sticky="nsew")
        self._fields: Dict[str, ctk.CTkEntry] = {}
        for i, (key, label) in enumerate(
            [
                ("ad", "Ad *"),
                ("il", "İl"),
                ("telefon", "Telefon"),
                ("eposta", "E-posta"),
                ("extra", extra_label),
                ("web", "Web sitesi"),
            ]
        ):
            ctk.CTkLabel(form, text=label, anchor="w", font=self.fonts["label"]).grid(
                row=i * 2, column=0, sticky="w", padx=12, pady=(10, 0)
            )
            ent = ctk.CTkEntry(form, width=280)
            ent.grid(row=i * 2 + 1, column=0, padx=12, pady=(2, 0))
            self._fields[key] = ent

        ctk.CTkLabel(form, text="Açıklama", anchor="w", font=self.fonts["label"]).grid(
            row=12, column=0, sticky="w", padx=12, pady=(10, 0)
        )
        self.aciklama = ctk.CTkTextbox(form, width=280, height=100)
        self.aciklama.grid(row=13, column=0, padx=12, pady=(2, 12))

        btns = ctk.CTkFrame(form, fg_color="transparent")
        btns.grid(row=14, column=0, padx=12, pady=8)
        ctk.CTkButton(btns, text="Yeni", width=70, command=self.clear_form).pack(side="left", padx=2)
        ctk.CTkButton(btns, text="Kaydet", width=80, command=self.save).pack(side="left", padx=2)
        ctk.CTkButton(btns, text="Sil", width=70, fg_color=p.danger, command=self.delete).pack(side="left", padx=2)

        self.protocol("WM_DELETE_WINDOW", self._go_back)
        self.after(100, self._init_db)

    def _init_db(self) -> None:
        try:
            if not self._db.is_connected:
                self._db.connect()
            ensure_partner_tables(self._db)
            self.refresh()
        except DatabaseError as exc:
            messagebox.showerror("Veritabanı", str(exc), parent=self)

    def _go_back(self) -> None:
        self.destroy()
        self._on_back()

    def refresh(self) -> None:
        for item in self._tree.get_children():
            self._tree.delete(item)
        try:
            rows = self._repo.list_all(self.search_var.get())
            for r in rows:
                self._tree.insert("", "end", iid=r.id, values=(r.ad, r.il, r.extra))
        except DatabaseError as exc:
            messagebox.showerror("Liste", str(exc), parent=self)

    def _on_select(self, _evt=None) -> None:
        sel = self._tree.selection()
        if not sel:
            return
        self._selected_id = sel[0]
        try:
            rec = self._repo.get_by_id(sel[0])
        except DatabaseError as exc:
            messagebox.showerror("Kayıt", str(exc), parent=self)
            return
        if not rec:
            return
        self._fill_form(rec)

    def _fill_form(self, rec: PartnerRecord) -> None:
        for key, val in (
            ("ad", rec.ad),
            ("il", rec.il),
            ("telefon", rec.telefon),
            ("eposta", rec.eposta),
            ("extra", rec.extra),
            ("web", rec.web),
        ):
            self._fields[key].delete(0, "end")
            self._fields[key].insert(0, val or "")
        self.aciklama.delete("1.0", "end")
        self.aciklama.insert("1.0", rec.aciklama or "")

    def clear_form(self) -> None:
        self._selected_id = None
        for ent in self._fields.values():
            ent.delete(0, "end")
        self.aciklama.delete("1.0", "end")
        self._tree.selection_remove(self._tree.selection())

    def _form_data(self) -> Dict[str, str]:
        return {
            "ad": self._fields["ad"].get(),
            "il": self._fields["il"].get(),
            "telefon": self._fields["telefon"].get(),
            "eposta": self._fields["eposta"].get(),
            "extra": self._fields["extra"].get(),
            "web": self._fields["web"].get(),
            "aciklama": self.aciklama.get("1.0", "end").strip(),
        }

    def save(self) -> None:
        data = self._form_data()
        if not data["ad"].strip():
            messagebox.showwarning("Kayıt", "Ad zorunludur.", parent=self)
            return
        try:
            if self._selected_id:
                self._repo.update(self._selected_id, data)
            else:
                self._selected_id = self._repo.insert(data)
            self.refresh()
            messagebox.showinfo("Kayıt", "Kaydedildi.", parent=self)
        except DatabaseError as exc:
            messagebox.showerror("Kayıt", str(exc), parent=self)

    def delete(self) -> None:
        if not self._selected_id:
            return
        if not messagebox.askyesno("Sil", "Seçili kayıt silinsin mi?", parent=self):
            return
        try:
            self._repo.delete(self._selected_id)
            self.clear_form()
            self.refresh()
        except DatabaseError as exc:
            messagebox.showerror("Sil", str(exc), parent=self)
