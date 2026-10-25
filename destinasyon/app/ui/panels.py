"""Ana pencerede kullanilan panel bilesenleri (CustomTkinter).

FormPanel   : veri giris formu + resim secici
TablePanel  : kayit listesi (arama + yenile), ttk.Treeview tabanli
DetailPanel : secilen kaydin detaylari + resim onizlemesi

Paneller veritabanini tanimaz; islemleri geri cagirma (callback) ile
MainWindow'a bildirir. Bu sayede arayuz ve is mantigi ayrik kalir.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from decimal import Decimal
from pathlib import Path
from typing import Callable, Dict, Iterator, List, Optional

import customtkinter as ctk
from PIL import Image, UnidentifiedImageError
from tkinter import Listbox

from app.models import Destinasyon, LookupItem
from app.ui.theme import CORNER, PAD, Theme

logger = logging.getLogger(__name__)

Callback = Callable[[], None]


def format_coord(value: Optional[Decimal | str]) -> str:
    """Koordinati okunur bicimde yazar (gereksiz sifirlari atar)."""
    if value is None or value == "":
        return ""
    try:
        text = f"{Decimal(str(value)):.6f}"
    except Exception:
        return str(value)
    return text.rstrip("0").rstrip(".") if "." in text else text


class Card(ctk.CTkFrame):
    """Baslikli, kenarlikli icerik kutusu."""

    def __init__(self, master, theme: Theme, title: str, **kwargs) -> None:
        super().__init__(
            master,
            corner_radius=CORNER,
            fg_color=theme.palette.surface,
            border_width=1,
            border_color=theme.palette.border,
            **kwargs,
        )
        self.theme = theme
        self.fonts = theme.fonts()

        self.title_label = ctk.CTkLabel(
            self, text=title, font=self.fonts["card_title"], anchor="w"
        )
        self.title_label.pack(fill="x", padx=PAD + 2, pady=(PAD, 4))

    # ------------------------------------------------------------------
    def _hint(self, parent, text: str, **kwargs) -> ctk.CTkLabel:
        return ctk.CTkLabel(
            parent,
            text=text,
            font=self.fonts["hint"],
            text_color=self.theme.palette.text_muted,
            anchor="w",
            justify="left",
            **kwargs,
        )

    def _field_label(self, parent, text: str) -> ctk.CTkLabel:
        return ctk.CTkLabel(
            parent,
            text=text,
            font=self.fonts["label"],
            text_color=self.theme.palette.text_muted,
            anchor="w",
        )


class FormPanel(Card):
    """Destinasyon ekleme / duzenleme formu."""

    def __init__(
        self,
        master,
        theme: Theme,
        callbacks: Dict[str, Callback],
        **kwargs,
    ) -> None:
        super().__init__(master, theme, "Destinasyon Bilgileri", **kwargs)
        self._callbacks = callbacks
        self._current_id: Optional[str] = None
        self._image_relative_path: Optional[str] = None
        self._image_paths: List[str] = []
        self._iller: List[LookupItem] = []
        self._turler: List[LookupItem] = []
        self._build()
        self.set_selection(None)

    # ------------------------------------------------------------------
    def _build(self) -> None:
        p = self.theme.palette
        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=PAD, pady=(0, PAD))

        self.id_label = self._hint(body, "Yeni kayit")
        self.id_label.pack(fill="x", pady=(0, 8))

        self._field_label(body, "Destinasyon Adi *").pack(fill="x")
        self.ad_entry = ctk.CTkEntry(
            body, placeholder_text="Ornek: Sumela Manastiri", height=34, corner_radius=8
        )
        self.ad_entry.pack(fill="x", pady=(3, 10))

        secim_row = ctk.CTkFrame(body, fg_color="transparent")
        secim_row.pack(fill="x", pady=(0, 10))
        secim_row.grid_columnconfigure(0, weight=1)
        secim_row.grid_columnconfigure(1, weight=1)

        self._field_label(secim_row, "Il *").grid(row=0, column=0, sticky="w")
        self._field_label(secim_row, "Destinasyon Turu *").grid(
            row=0, column=1, sticky="w", padx=(8, 0)
        )

        self.il_menu = ctk.CTkOptionMenu(
            secim_row,
            values=["— İl seçin —"],
            height=34,
            corner_radius=8,
            fg_color=p.surface_alt,
            button_color=p.border,
            button_hover_color=p.accent,
            text_color=p.text,
            dropdown_fg_color=p.surface,
            dropdown_hover_color=p.border,
            dropdown_text_color=p.text,
        )
        self.il_menu.grid(row=1, column=0, sticky="ew", pady=(3, 0))
        self.il_menu.set("— İl seçin —")

        tur_wrap = ctk.CTkFrame(secim_row, fg_color="transparent")
        tur_wrap.grid(row=1, column=1, sticky="ew", padx=(8, 0), pady=(3, 0))
        tur_wrap.grid_columnconfigure(0, weight=1)

        self.tur_menu = ctk.CTkOptionMenu(
            tur_wrap,
            values=["— Tür seçin —"],
            height=34,
            corner_radius=8,
            fg_color=p.surface_alt,
            button_color=p.border,
            button_hover_color=p.accent,
            text_color=p.text,
            dropdown_fg_color=p.surface,
            dropdown_hover_color=p.border,
            dropdown_text_color=p.text,
        )
        self.tur_menu.grid(row=0, column=0, sticky="ew")

        self.new_type_button = ctk.CTkButton(
            tur_wrap,
            text="+ Tür",
            width=64,
            height=34,
            corner_radius=8,
            fg_color=p.accent,
            hover_color=p.accent_hover,
            font=self.fonts["card_title"],
            command=self._callbacks.get("on_new_type", lambda: None),
        )
        self.new_type_button.grid(row=0, column=1, padx=(6, 0))

        self._hint(body, "Yeni destinasyon türü eklemek için tür kutusunun yanındaki + düğmesini kullanın.").pack(
            fill="x", pady=(0, 8)
        )

        self._field_label(body, "Kisa aciklama (harita / liste)").pack(fill="x")
        self.kisa_aciklama_entry = ctk.CTkEntry(
            body, placeholder_text="Bir cumlelik ozet", height=34, corner_radius=8
        )
        self.kisa_aciklama_entry.pack(fill="x", pady=(3, 8))

        self._field_label(body, "Detayli aciklama").pack(fill="x")
        self.aciklama_box = ctk.CTkTextbox(
            body, height=120, corner_radius=8, border_width=1, border_color=p.border,
            font=self.fonts["body"], wrap="word",
        )
        self.aciklama_box.pack(fill="x", pady=(3, 10))

        coord_row = ctk.CTkFrame(body, fg_color="transparent")
        coord_row.pack(fill="x", pady=(0, 10))
        coord_row.grid_columnconfigure((0, 1), weight=1, uniform="coord")

        self._field_label(coord_row, "Enlem (Latitude) *").grid(row=0, column=0, sticky="w")
        self._field_label(coord_row, "Boylam (Longitude) *").grid(
            row=0, column=1, sticky="w", padx=(8, 0)
        )
        self.enlem_entry = ctk.CTkEntry(
            coord_row, placeholder_text="40.690278", height=34, corner_radius=8
        )
        self.enlem_entry.grid(row=1, column=0, sticky="ew", pady=(3, 0))
        self.boylam_entry = ctk.CTkEntry(
            coord_row, placeholder_text="39.658611", height=34, corner_radius=8
        )
        self.boylam_entry.grid(row=1, column=1, sticky="ew", padx=(8, 0), pady=(3, 0))

        self._field_label(body, "Resimler (birden fazla)").pack(fill="x")
        list_wrap = ctk.CTkFrame(body, fg_color=p.surface_alt, corner_radius=8)
        list_wrap.pack(fill="x", pady=(3, 4))
        self.image_list = Listbox(list_wrap, height=4, activestyle="none")
        self.image_list.pack(fill="x", padx=6, pady=6)

        image_row = ctk.CTkFrame(body, fg_color="transparent")
        image_row.pack(fill="x", pady=(3, 4))
        image_row.grid_columnconfigure((0, 1), weight=1)

        self.select_image_button = ctk.CTkButton(
            image_row,
            text="Resim Ekle...",
            height=34,
            corner_radius=8,
            fg_color=p.accent,
            hover_color=p.accent_hover,
            command=self._callbacks.get("on_select_image", lambda: None),
        )
        self.select_image_button.grid(row=0, column=0, sticky="ew", padx=(0, 4))

        self.clear_image_button = ctk.CTkButton(
            image_row,
            text="Secili Sil",
            height=34,
            corner_radius=8,
            fg_color="transparent",
            hover_color=p.border,
            text_color=p.danger,
            border_width=1,
            border_color=p.danger,
            command=self._callbacks.get("on_clear_image", lambda: None),
        )
        self.clear_image_button.grid(row=0, column=1, sticky="ew")

        self._hint(
            body,
            "★ ilk resim kapak. Tum resimler images/ altinda; paket kaydinda hepsi kopyalanir.",
        ).pack(fill="x", pady=(0, 10))

        # Form durumu mesaji (dogrulama hatalari burada gosterilir)
        self.message_label = ctk.CTkLabel(
            body, text="", font=self.fonts["hint"], anchor="w", justify="left", wraplength=320
        )
        self.message_label.pack(fill="x", pady=(0, 6))

        spacer = ctk.CTkFrame(body, fg_color="transparent", height=1)
        spacer.pack(fill="both", expand=True)

        button_row = ctk.CTkFrame(body, fg_color="transparent")
        button_row.pack(fill="x")
        button_row.grid_columnconfigure((0, 1, 2), weight=1, uniform="btn")

        self.save_button = ctk.CTkButton(
            button_row,
            text="Kaydet",
            height=38,
            corner_radius=8,
            fg_color=p.accent,
            hover_color=p.accent_hover,
            font=self.fonts["card_title"],
            command=self._callbacks.get("on_save", lambda: None),
        )
        self.save_button.grid(row=0, column=0, sticky="ew")

        self.update_button = ctk.CTkButton(
            button_row,
            text="Guncelle",
            height=38,
            corner_radius=8,
            fg_color=p.surface_alt,
            hover_color=p.border,
            text_color=p.text,
            border_width=1,
            border_color=p.border,
            command=self._callbacks.get("on_update", lambda: None),
        )
        self.update_button.grid(row=0, column=1, sticky="ew", padx=6)

        self.delete_button = ctk.CTkButton(
            button_row,
            text="Sil",
            height=38,
            corner_radius=8,
            fg_color="transparent",
            hover_color=p.danger,
            text_color=p.danger,
            border_width=1,
            border_color=p.danger,
            command=self._callbacks.get("on_delete", lambda: None),
        )
        self.delete_button.grid(row=0, column=2, sticky="ew")

        self.clear_button = ctk.CTkButton(
            body,
            text="Formu Temizle",
            height=32,
            corner_radius=8,
            fg_color="transparent",
            hover_color=p.surface_alt,
            text_color=p.text_muted,
            command=self._callbacks.get("on_clear", lambda: None),
        )
        self.clear_button.pack(fill="x", pady=(8, 0))

    # ------------------------------------------------------------------
    # Form durumu
    # ------------------------------------------------------------------
    @property
    def current_id(self) -> Optional[str]:
        return self._current_id

    @property
    def image_relative_path(self) -> Optional[str]:
        return self._image_relative_path

    def set_image_path(self, relative_path: Optional[str]) -> None:
        self.set_image_paths([relative_path] if relative_path else [])

    def set_image_paths(self, paths: List[str]) -> None:
        self._image_paths = [p for p in paths if p]
        self._image_relative_path = self._image_paths[0] if self._image_paths else None
        self._refresh_image_list()

    def add_image_path(self, relative_path: Optional[str]) -> None:
        if not relative_path:
            return
        if relative_path not in self._image_paths:
            self._image_paths.append(relative_path)
        self._image_relative_path = self._image_paths[0]
        self._refresh_image_list()

    def remove_selected_image(self) -> Optional[str]:
        sel = self.image_list.curselection()
        if not sel:
            return None
        idx = int(sel[0])
        if idx < 0 or idx >= len(self._image_paths):
            return None
        removed = self._image_paths.pop(idx)
        self._image_relative_path = self._image_paths[0] if self._image_paths else None
        self._refresh_image_list()
        return removed

    def image_paths(self) -> List[str]:
        return list(self._image_paths)

    def _refresh_image_list(self) -> None:
        self.image_list.delete(0, "end")
        for i, path in enumerate(self._image_paths):
            prefix = "★ " if i == 0 else "  "
            self.image_list.insert("end", f"{prefix}{path}")
        self.clear_image_button.configure(state="normal" if self._image_paths else "disabled")

    def set_message(self, text: str, level: str = "info") -> None:
        colors = {
            "info": self.theme.palette.text_muted,
            "error": self.theme.palette.danger,
            "success": self.theme.palette.success,
            "warning": self.theme.palette.warning,
        }
        self.message_label.configure(text=text, text_color=colors.get(level, colors["info"]))

    def set_lookups(self, iller: List[LookupItem], turler: List[LookupItem]) -> None:
        """Il ve tur listelerini form acilir kutularina yazar."""
        self._iller = list(iller)
        self._turler = list(turler)
        il_degerler = ["— İl seçin —"] + [item.ad for item in self._iller]
        tur_degerler = ["— Tür seçin —"] + [item.ad for item in self._turler]
        mevcut_il = self.il_menu.get()
        mevcut_tur = self.tur_menu.get()
        self.il_menu.configure(values=il_degerler)
        self.tur_menu.configure(values=tur_degerler)
        if mevcut_il in il_degerler:
            self.il_menu.set(mevcut_il)
        else:
            self.il_menu.set("— İl seçin —")
        if mevcut_tur in tur_degerler:
            self.tur_menu.set(mevcut_tur)
        else:
            self.tur_menu.set("— Tür seçin —")

    def set_tur(self, ad: str) -> None:
        if ad in self.tur_menu.cget("values"):
            self.tur_menu.set(ad)

    def set_selection(self, item: Optional[Destinasyon]) -> None:
        """Tablodan secim yapildiginda formu doldurur; None ise temizler."""
        self._set_entry(self.ad_entry, item.ad if item else "")
        self._set_entry(self.enlem_entry, format_coord(item.enlem) if item else "")
        self._set_entry(self.boylam_entry, format_coord(item.boylam) if item else "")

        self.aciklama_box.delete("1.0", "end")
        if item and item.aciklama:
            self.aciklama_box.insert("1.0", item.aciklama)
        self._set_entry(self.kisa_aciklama_entry, item.kisa_aciklama if item else "")

        if item is None:
            self._current_id = None
            self.id_label.configure(text="Yeni kayit")
            self.set_image_paths([])
            self.il_menu.set("— İl seçin —")
            self.tur_menu.set("— Tür seçin —")
        else:
            self._current_id = item.id
            self.id_label.configure(text=f"Kayit #{item.id}")
            paths = list(item.resim_yollari or [])
            if item.resim_yolu and item.resim_yolu not in paths:
                paths.insert(0, item.resim_yolu)
            self.set_image_paths(paths)
            self.il_menu.set(item.il_ad if item.il_ad else "— İl seçin —")
            self.tur_menu.set(item.tur_ad if item.tur_ad else "— Tür seçin —")

        self.set_message("")
        self._refresh_button_states()

    def to_destinasyon(self) -> Destinasyon:
        """Formdaki degerlerden model uretir (dogrulama cagirana aittir)."""
        il_ad = self.il_menu.get()
        tur_ad = self.tur_menu.get()
        il = next((x for x in self._iller if x.ad == il_ad), None)
        tur = next((x for x in self._turler if x.ad == tur_ad), None)
        return Destinasyon(
            id=self._current_id,
            ad=self.ad_entry.get().strip(),
            aciklama=self.aciklama_box.get("1.0", "end").strip(),
            kisa_aciklama=self.kisa_aciklama_entry.get().strip(),
            il_id=il.id if il else None,
            tur_id=tur.id if tur else None,
            il_ad=il.ad if il else "",
            tur_ad=tur.ad if tur else "",
            enlem=self.enlem_entry.get().strip() or None,
            boylam=self.boylam_entry.get().strip() or None,
            resim_yolu=self._image_relative_path,
            resim_yollari=self.image_paths(),
        )

    def set_write_enabled(self, enabled: bool) -> None:
        """Baglanti yoksa yazma butonlarini kapatir."""
        self._write_enabled = enabled
        self._refresh_button_states()

    # ------------------------------------------------------------------
    _write_enabled: bool = False

    def _refresh_button_states(self) -> None:
        has_selection = self._current_id is not None
        # Secili kayit varken "Kaydet" yeni bir kayit olusturur; metin bunu belirtir
        self.save_button.configure(
            state="normal" if self._write_enabled else "disabled",
            text="Yeni Olarak Ekle" if has_selection else "Kaydet",
        )
        state = "normal" if (self._write_enabled and has_selection) else "disabled"
        self.update_button.configure(state=state)
        self.delete_button.configure(state=state)
        self.new_type_button.configure(
            state="normal" if self._write_enabled else "disabled"
        )

    @staticmethod
    def _set_entry(entry: ctk.CTkEntry, value: str) -> None:
        entry.delete(0, "end")
        if value:
            entry.insert(0, value)


class TablePanel(Card):
    """Kayitlarin listelendigi tablo (ttk.Treeview)."""

    COLUMNS = (
        ("id", "ID", 48, "center"),
        ("il", "İl", 90, "w"),
        ("tur", "Tür", 110, "w"),
        ("ad", "Ad", 180, "w"),
        ("enlem", "Enlem", 85, "center"),
        ("boylam", "Boylam", 85, "center"),
        ("resim", "Resim", 58, "center"),
    )

    def __init__(
        self,
        master,
        theme: Theme,
        on_select: Callable[[Optional[Destinasyon]], None],
        on_refresh: Callback,
        on_search: Callable[[str], None],
        **kwargs,
    ) -> None:
        super().__init__(master, theme, "Kayitlar", **kwargs)
        self._on_select = on_select
        self._on_refresh = on_refresh
        self._on_search = on_search
        self._items: List[Destinasyon] = []
        self._iller: List[LookupItem] = []
        self._turler: List[LookupItem] = []
        self._sort_column: str = "ad"
        self._sort_reverse = False
        # Programatik secim degisikliklerinde <<TreeviewSelect>> bastirilir
        self._suppress_select = 0
        self._build()

    # ------------------------------------------------------------------
    def _build(self) -> None:
        from tkinter import ttk

        p = self.theme.palette
        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=PAD, pady=(0, PAD))
        body.grid_rowconfigure(2, weight=1)
        body.grid_columnconfigure(0, weight=1)

        top = ctk.CTkFrame(body, fg_color="transparent")
        top.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 8))
        top.grid_columnconfigure(0, weight=1)

        self.search_var = ctk.StringVar()
        self.search_entry = ctk.CTkEntry(
            top,
            textvariable=self.search_var,
            placeholder_text="Ad veya aciklamada ara...",
            height=34,
            corner_radius=8,
        )
        self.search_entry.grid(row=0, column=0, sticky="ew")
        self.search_var.trace_add("write", lambda *_: self._on_search(self.search_var.get()))

        self.refresh_button = ctk.CTkButton(
            top,
            text="Yenile",
            width=88,
            height=34,
            corner_radius=8,
            fg_color=p.surface_alt,
            hover_color=p.border,
            text_color=p.text,
            border_width=1,
            border_color=p.border,
            command=self._on_refresh,
        )
        self.refresh_button.grid(row=0, column=1, padx=(6, 0))

        filtre = ctk.CTkFrame(body, fg_color="transparent")
        filtre.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(0, 8))
        filtre.grid_columnconfigure((0, 1), weight=1)

        self.il_filter = ctk.CTkOptionMenu(
            filtre,
            values=["Tüm iller"],
            height=30,
            corner_radius=8,
            fg_color=p.surface_alt,
            button_color=p.border,
            button_hover_color=p.accent,
            text_color=p.text,
            dropdown_fg_color=p.surface,
            command=lambda _: self._on_refresh(),
        )
        self.il_filter.grid(row=0, column=0, sticky="ew", padx=(0, 6))
        self.il_filter.set("Tüm iller")

        self.tur_filter = ctk.CTkOptionMenu(
            filtre,
            values=["Tüm türler"],
            height=30,
            corner_radius=8,
            fg_color=p.surface_alt,
            button_color=p.border,
            button_hover_color=p.accent,
            text_color=p.text,
            dropdown_fg_color=p.surface,
            command=lambda _: self._on_refresh(),
        )
        self.tur_filter.grid(row=0, column=1, sticky="ew")
        self.tur_filter.set("Tüm türler")

        self.theme.style_treeview(self)
        self.tree = ttk.Treeview(
            body,
            columns=[c[0] for c in self.COLUMNS],
            show="headings",
            style="Destinasyon.Treeview",
            selectmode="browse",
        )
        for key, title, width, anchor in self.COLUMNS:
            self.tree.heading(
                key, text=title, anchor=anchor, command=lambda k=key: self._sort_by(k)
            )
            self.tree.column(key, width=width, anchor=anchor, stretch=(key == "ad"))
        self.tree.tag_configure("oddrow", background=p.surface)
        self.tree.tag_configure("evenrow", background=p.row_alt)
        self.tree.grid(row=2, column=0, sticky="nsew")
        self.tree.bind("<<TreeviewSelect>>", self._on_tree_select)

        self.scrollbar = ctk.CTkScrollbar(body, command=self.tree.yview)
        self.scrollbar.grid(row=2, column=1, sticky="ns", padx=(4, 0))
        self.tree.configure(yscrollcommand=self.scrollbar.set)

        self.summary_label = self._hint(body, "0 kayit")
        self.summary_label.grid(row=3, column=0, sticky="w", pady=(8, 0))

    # ------------------------------------------------------------------
    def load_items(self, items: List[Destinasyon]) -> None:
        self._items = list(items)
        with self._silent_selection():
            self._render()
        self.summary_label.configure(text=f"{len(items)} kayit")

    def set_lookups(self, iller: List[LookupItem], turler: List[LookupItem]) -> None:
        self._iller = list(iller)
        self._turler = list(turler)
        il_degerler = ["Tüm iller"] + [x.ad for x in self._iller]
        tur_degerler = ["Tüm türler"] + [x.ad for x in self._turler]
        il_secim = self.il_filter.get()
        tur_secim = self.tur_filter.get()
        self.il_filter.configure(values=il_degerler)
        self.tur_filter.configure(values=tur_degerler)
        self.il_filter.set(il_secim if il_secim in il_degerler else "Tüm iller")
        self.tur_filter.set(tur_secim if tur_secim in tur_degerler else "Tüm türler")

    def selected_filters(self) -> tuple[Optional[str], Optional[str]]:
        il_ad = self.il_filter.get()
        tur_ad = self.tur_filter.get()
        il = next((x for x in self._iller if x.ad == il_ad), None)
        tur = next((x for x in self._turler if x.ad == tur_ad), None)
        return (il.id if il else None, tur.id if tur else None)

    @contextmanager
    def _silent_selection(self) -> Iterator[None]:
        """Programatik secim degisikliklerinde secim geri cagrisini susturur.

        Tk, <<TreeviewSelect>> olayini gecikmeli gonderir; bastirma
        sayaci bu yuzden hemen degil, olay kuyrugu bosalinca dusurulur.
        Aksi halde form temizlendikten sonra gelen gec olay, kullanicinin
        yeni girdigi verileri siliyordu.
        """
        self._suppress_select += 1
        try:
            yield
        finally:
            self.after_idle(self._release_suppress)

    def _release_suppress(self) -> None:
        self._suppress_select = max(0, self._suppress_select - 1)

    def _render(self) -> None:
        self.tree.delete(*self.tree.get_children())
        for index, item in enumerate(self._sorted_items()):
            self.tree.insert(
                "",
                "end",
                iid=str(item.id),
                values=(
                    (str(item.id)[:8] + "…") if item.id else "-",
                    item.il_ad,
                    item.tur_ad,
                    item.ad,
                    format_coord(item.enlem),
                    format_coord(item.boylam),
                    "Var" if item.resim_yolu else "-",
                ),
                tags=("evenrow" if index % 2 else "oddrow",),
            )

    def _sorted_items(self) -> List[Destinasyon]:
        keys = {
            "id": lambda d: d.id or "",
            "il": lambda d: (d.il_ad or "").lower(),
            "tur": lambda d: (d.tur_ad or "").lower(),
            "ad": lambda d: (d.ad or "").lower(),
            "enlem": lambda d: float(d.enlem or 0),
            "boylam": lambda d: float(d.boylam or 0),
            "resim": lambda d: bool(d.resim_yolu),
        }
        key = keys.get(self._sort_column, keys["ad"])
        return sorted(self._items, key=key, reverse=self._sort_reverse)

    def _sort_by(self, column: str) -> None:
        if self._sort_column == column:
            self._sort_reverse = not self._sort_reverse
        else:
            self._sort_column = column
            self._sort_reverse = False
        selected = self.selected_item()
        with self._silent_selection():
            self._render()
            if selected is not None:
                self.select_by_id(selected.id, notify=False)

    # ------------------------------------------------------------------
    def selected_item(self) -> Optional[Destinasyon]:
        selection = self.tree.selection()
        if not selection:
            return None
        record_id = str(selection[0])
        return next((item for item in self._items if item.id == record_id), None)

    def select_by_id(self, record_id: Optional[str], notify: bool = True) -> None:
        """Kaydi secer.

        Tk'nin gecikmeli <<TreeviewSelect>> olayi bastirilir; ``notify``
        ile geri cagri senkron olarak tetiklenir. Boylece secim sonrasi
        arayuz durumu ongorulebilir sekilde guncellenir.
        """
        if record_id is None:
            self.clear_selection(notify=notify)
            return
        iid = str(record_id)
        if not self.tree.exists(iid):
            return
        with self._silent_selection():
            self.tree.selection_set(iid)
            self.tree.focus(iid)
            self.tree.see(iid)
        if notify:
            self._on_select(self.selected_item())

    def clear_selection(self, notify: bool = False) -> None:
        with self._silent_selection():
            for iid in self.tree.selection():
                self.tree.selection_remove(iid)
        if notify:
            self._on_select(None)

    def _on_tree_select(self, _event=None) -> None:
        if self._suppress_select:
            return
        self._on_select(self.selected_item())


class DetailPanel(Card):
    """Secilen kaydin detaylari ve resim onizlemesi."""

    PREVIEW_HEIGHT = 220

    def __init__(self, master, theme: Theme, **kwargs) -> None:
        super().__init__(master, theme, "Onizleme", **kwargs)
        self._image_path: Optional[Path] = None
        self._gallery_paths: List[Path] = []
        self._gallery_index = 0
        self._rendered_width = 0
        self._resize_job: Optional[str] = None
        self._ctk_image: Optional[ctk.CTkImage] = None
        self._build()

    def _build(self) -> None:
        p = self.theme.palette
        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=PAD, pady=(0, PAD))

        self.preview_frame = ctk.CTkFrame(
            body,
            height=self.PREVIEW_HEIGHT,
            corner_radius=8,
            fg_color=p.surface_alt,
            border_width=1,
            border_color=p.border,
        )
        self.preview_frame.pack(fill="x")
        self.preview_frame.pack_propagate(False)

        self.preview_label = ctk.CTkLabel(
            self.preview_frame,
            text="Resim onizlemesi",
            text_color=p.text_muted,
            font=self.fonts["label"],
        )
        self.preview_label.pack(fill="both", expand=True, padx=6, pady=6)
        self.preview_frame.bind("<Configure>", self._on_preview_resize)

        nav = ctk.CTkFrame(body, fg_color="transparent")
        nav.pack(fill="x", pady=(4, 0))
        self.prev_image_btn = ctk.CTkButton(nav, text="◀", width=36, command=self._prev_image)
        self.prev_image_btn.pack(side="left")
        self.image_counter_label = ctk.CTkLabel(nav, text="Resim 0/0", font=self.fonts["hint"])
        self.image_counter_label.pack(side="left", padx=8)
        self.next_image_btn = ctk.CTkButton(nav, text="▶", width=36, command=self._next_image)
        self.next_image_btn.pack(side="left")

        self.name_label = ctk.CTkLabel(
            body, text="-", font=self.fonts["detail_title"], anchor="w", justify="left"
        )
        self.name_label.pack(fill="x", pady=(10, 2))

        self.coord_label = self._hint(body, "-")
        self.coord_label.pack(fill="x")

        self.meta_label = self._hint(body, "-")
        self.meta_label.pack(fill="x")

        self.path_label = self._hint(body, "-")
        self.path_label.pack(fill="x", pady=(2, 8))

        self.description_box = ctk.CTkTextbox(
            body,
            corner_radius=8,
            border_width=1,
            border_color=p.border,
            fg_color=p.surface_alt,
            font=self.fonts["body"],
            wrap="word",
        )
        self.description_box.pack(fill="both", expand=True)
        self._set_description("Detaylari gormek icin tablodan bir kayit secin.")

    # ------------------------------------------------------------------
    def show_item(self, item: Optional[Destinasyon], image_path: Optional[Path]) -> None:
        if item is None:
            self.name_label.configure(text="-")
            self.coord_label.configure(text="-")
            self.meta_label.configure(text="-")
            self.path_label.configure(text="-")
            self._set_description("Detaylari gormek icin tablodan bir kayit secin.")
            self.set_image(None)
            return

        self.name_label.configure(text=item.ad)
        self.meta_label.configure(text=f"İl: {item.il_ad or '-'}    Tür: {item.tur_ad or '-'}")
        self.coord_label.configure(
            text=f"Enlem: {format_coord(item.enlem)}    Boylam: {format_coord(item.boylam)}"
        )
        paths = list(item.resim_yollari or [])
        if item.resim_yolu and item.resim_yolu not in paths:
            paths.insert(0, item.resim_yolu)
        self.path_label.configure(
            text=f"Resimler ({len(paths)}): " + (", ".join(paths[:3]) + ("…" if len(paths) > 3 else "") if paths else "(yok)")
        )
        desc = item.aciklama or "(Detayli aciklama yok)"
        if item.kisa_aciklama:
            desc = f"Ozet: {item.kisa_aciklama}\n\n{desc}"
        self._set_description(desc)
        self._gallery_paths = [image_path] if image_path else []
        if paths and image_path is None:
            self._gallery_paths = []
        self._gallery_index = 0
        self.set_image(image_path)

    def _prev_image(self) -> None:
        if len(self._gallery_paths) < 2:
            return
        self._gallery_index = (self._gallery_index - 1) % len(self._gallery_paths)
        self.set_image(self._gallery_paths[self._gallery_index])

    def _next_image(self) -> None:
        if len(self._gallery_paths) < 2:
            return
        self._gallery_index = (self._gallery_index + 1) % len(self._gallery_paths)
        self.set_image(self._gallery_paths[self._gallery_index])

    def set_gallery(self, absolute_paths: List[Path]) -> None:
        self._gallery_paths = [p for p in absolute_paths if p and p.is_file()]
        self._gallery_index = 0
        if self._gallery_paths:
            self.set_image(self._gallery_paths[0])
        else:
            self.set_image(None)
        total = len(self._gallery_paths)
        idx = self._gallery_index + 1 if total else 0
        self.image_counter_label.configure(text=f"Resim {idx}/{total}")

    def set_image(self, image_path: Optional[Path]) -> None:
        self._image_path = image_path
        self._rendered_width = 0
        if image_path is None:
            self._clear_image("Resim yok")
            return
        self._render_image()

    # ------------------------------------------------------------------
    def _render_image(self) -> None:
        if self._image_path is None:
            return

        frame_width = max(self.preview_frame.winfo_width() - 16, 120)
        frame_height = self.PREVIEW_HEIGHT - 16
        try:
            with Image.open(self._image_path) as source:
                image = source.copy()
        except (OSError, UnidentifiedImageError) as exc:
            logger.warning("Resim okunamadi (%s): %s", self._image_path, exc)
            self._clear_image("Resim okunamadi")
            return

        ratio = min(frame_width / image.width, frame_height / image.height)
        size = (max(int(image.width * ratio), 1), max(int(image.height * ratio), 1))
        self._ctk_image = ctk.CTkImage(light_image=image, dark_image=image, size=size)
        self.preview_label.configure(image=self._ctk_image, text="")
        total = len(self._gallery_paths)
        if total:
            try:
                idx = self._gallery_paths.index(self._image_path) + 1
            except ValueError:
                idx = self._gallery_index + 1
            self.image_counter_label.configure(text=f"Resim {idx}/{total}")
        self._rendered_width = frame_width

    def _clear_image(self, message: str) -> None:
        """Onizlemeyi bosaltir.

        CustomTkinter'in CTkLabel'i ``image=None`` verildiginde alttaki
        tkinter.Label'in goruntu referansini temizlemez; CTkImage cop
        toplaninca Tk 'image "pyimageN" doesn't exist' hatasi verir.
        Bu yuzden sira onemlidir: once CTk referansi birakilir, sonra Tk
        etiketi bosaltilir, en son kendi referansimiz dusurulur.
        """
        previous = self._ctk_image  # cagri boyunca canli tutulur

        self.preview_label.configure(image=None)
        inner_label = getattr(self.preview_label, "_label", None)
        if inner_label is not None:
            try:
                inner_label.configure(image="")
            except Exception:
                logger.debug("Tk etiketinin goruntusu temizlenemedi.", exc_info=True)

        self.preview_label.configure(text=message)
        self._ctk_image = None
        del previous

    def _on_preview_resize(self, event) -> None:
        """Pencere boyutu degistiginde onizlemeyi yeniden olceklendirir."""
        if self._image_path is None:
            return
        if abs(event.width - self._rendered_width) < 24:
            return
        if self._resize_job is not None:
            self.after_cancel(self._resize_job)
        self._resize_job = self.after(120, self._render_image)

    def _set_description(self, text: str) -> None:
        self.description_box.configure(state="normal")
        self.description_box.delete("1.0", "end")
        self.description_box.insert("1.0", text)
        self.description_box.configure(state="disabled")
