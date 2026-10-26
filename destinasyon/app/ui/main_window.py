"""Ana uygulama penceresi (CustomTkinter).

MainWindow, servisleri (config / veritabani / resim) panellere baglayan
denetleyici katmandir. Asama 1'de okuma akislari (listeleme, arama,
onizleme) ve resmin images/ klasorune alinmasi calisir; yazma butonlari
Asama 2'de DestinasyonRepository'ye baglanacaktir.
"""

from __future__ import annotations

import logging
from pathlib import Path
from tkinter import filedialog, messagebox
from typing import Callable, List, Optional, Set

import customtkinter as ctk

from app import __app_name__, __version__
from app.config import AppConfig, ConfigManager
from app.database import (
    DatabaseError,
    DatabaseManager,
    DestinasyonRepository,
    DuplicateNameError,
    DuplicateTypeError,
    LookupRepository,
)
from app.models import Destinasyon, ValidationError
from app.paths import AppPaths
from app.services.image_service import ImageError, ImageService
from app.services.duplicate_service import DuplicateService
from app.services.paket_service import PaketSecenekleri, PaketService
from app.ui.duplicate_dialog import DuplicateDialog
from app.ui.export_dialog import PaketDialog
from app.ui.panels import DetailPanel, FormPanel, TablePanel
from app.ui.theme import PAD, Theme

logger = logging.getLogger(__name__)

SEARCH_DEBOUNCE_MS = 300


class MainWindow(ctk.CTk):
    def __init__(
        self,
        paths: AppPaths,
        config: AppConfig,
        config_manager: ConfigManager,
        db: DatabaseManager,
        on_back: Optional[Callable[[], None]] = None,
    ) -> None:
        super().__init__()
        self._on_back = on_back
        self._paths = paths
        self._config = config
        self._config_manager = config_manager
        self._db = db
        self._repo = DestinasyonRepository(db)
        self._lookups = LookupRepository(db)
        self._images = ImageService(paths)
        self._paket = PaketService(paths, db)
        self._duplicates = DuplicateService(db, self._repo)
        self._items: List[Destinasyon] = []
        self._search_job: Optional[str] = None
        # Kopyalanmis ama heniz veritabanina yazilmamis resimler
        self._pending_images: Set[str] = set()

        self.theme = Theme(config.application.theme)
        self.theme.apply_global()
        self.fonts = self.theme.fonts()

        self.title(f"{__app_name__}  v{__version__}")
        self.geometry("1480x860")
        self.minsize(1200, 740)
        self.configure(fg_color=self.theme.palette.background)

        self._build_layout()
        self._bind_shortcuts()
        self.protocol("WM_DELETE_WINDOW", self.on_close)

        # Pencere cizildikten sonra baglanti denenir
        self.after(150, self.connect_to_database)

    # ------------------------------------------------------------------
    # Arayuz kurulumu
    # ------------------------------------------------------------------
    def _build_layout(self) -> None:
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        self._build_header().grid(row=0, column=0, sticky="ew")

        content = ctk.CTkFrame(self, fg_color="transparent")
        content.grid(row=1, column=0, sticky="nsew", padx=PAD, pady=(PAD, 6))
        content.grid_rowconfigure(0, weight=1)
        content.grid_columnconfigure(0, weight=0, minsize=360)
        content.grid_columnconfigure(1, weight=3, minsize=420)
        content.grid_columnconfigure(2, weight=2, minsize=300)

        self.form_panel = FormPanel(
            content,
            self.theme,
            callbacks={
                "on_save": self.save_record,
                "on_update": self.update_record,
                "on_delete": self.delete_record,
                "on_clear": self.clear_form,
                "on_select_image": self.select_image,
                "on_clear_image": self.clear_image_selection,
                "on_new_type": self.create_new_type,
            },
            width=360,
        )
        self.form_panel.grid(row=0, column=0, sticky="nsew")

        self.table_panel = TablePanel(
            content,
            self.theme,
            on_select=self.on_selection_changed,
            on_refresh=self.refresh_records,
            on_search=self._schedule_search,
        )
        self.table_panel.grid(row=0, column=1, sticky="nsew", padx=(PAD, PAD))

        self.detail_panel = DetailPanel(content, self.theme)
        self.detail_panel.grid(row=0, column=2, sticky="nsew")

        self._build_statusbar().grid(row=2, column=0, sticky="ew")

    def _build_header(self) -> ctk.CTkFrame:
        p = self.theme.palette
        header = ctk.CTkFrame(self, height=74, corner_radius=0, fg_color=p.surface)
        header.grid_columnconfigure(1, weight=1)
        header.grid_propagate(False)

        titles = ctk.CTkFrame(header, fg_color="transparent")
        titles.grid(row=0, column=0, sticky="w", padx=(PAD + 6, 0), pady=PAD)
        ctk.CTkLabel(
            titles, text="Veri Yönetim Paneli", font=self.fonts["title"], anchor="w"
        ).pack(anchor="w")
        ctk.CTkLabel(
            titles,
            text="Destinasyon girisi · listeleme · cift kayit temizleme · PostgreSQL trabzon_turizm",
            font=self.fonts["subtitle"],
            text_color=p.text_muted,
            anchor="w",
        ).pack(anchor="w")

        actions = ctk.CTkFrame(header, fg_color="transparent")
        actions.grid(row=0, column=2, sticky="e", padx=(0, PAD + 6), pady=PAD)

        self.status_dot = ctk.CTkLabel(
            actions, text="\u25cf", text_color=p.danger, font=self.fonts["detail_title"]
        )
        self.status_dot.pack(side="left", padx=(0, 6))

        self.connection_label = ctk.CTkLabel(
            actions, text="Baglanti bekleniyor", font=self.fonts["label"], text_color=p.text_muted
        )
        self.connection_label.pack(side="left", padx=(0, 12))

        if self._on_back is not None:
            ctk.CTkButton(
                actions,
                text="← Ana menü",
                width=110,
                height=34,
                corner_radius=8,
                command=self._return_to_hub,
            ).pack(side="left", padx=(0, 8))

        self.reconnect_button = ctk.CTkButton(
            actions,
            text="Yeniden Baglan",
            width=132,
            height=34,
            corner_radius=8,
            fg_color=p.surface_alt,
            hover_color=p.border,
            text_color=p.text,
            border_width=1,
            border_color=p.border,
            command=self.connect_to_database,
        )
        self.reconnect_button.pack(side="left")

        self.schema_button = ctk.CTkButton(
            actions,
            text="Sema Kontrolu",
            width=124,
            height=34,
            corner_radius=8,
            fg_color="transparent",
            hover_color=p.surface_alt,
            text_color=p.text_muted,
            border_width=1,
            border_color=p.border,
            command=self.check_schema,
        )
        self.schema_button.pack(side="left", padx=(6, 0))

        self.duplicate_button = ctk.CTkButton(
            actions,
            text="Cift Kayitlar",
            width=118,
            height=34,
            corner_radius=8,
            fg_color="#b45309",
            hover_color="#92400e",
            text_color="white",
            command=self.open_duplicate_dialog,
        )
        self.duplicate_button.pack(side="left", padx=(6, 0))

        self.paket_save_button = ctk.CTkButton(
            actions,
            text="Veri Paketi",
            width=108,
            height=34,
            corner_radius=8,
            fg_color=p.accent,
            hover_color=p.accent_hover,
            command=self.export_paket_dialog,
        )
        self.paket_save_button.pack(side="left", padx=(6, 0))

        self.paket_folder_button = ctk.CTkButton(
            actions,
            text="veritabani/",
            width=96,
            height=34,
            corner_radius=8,
            fg_color=p.surface_alt,
            hover_color=p.border,
            text_color=p.text,
            border_width=1,
            border_color=p.border,
            command=self.save_to_veritabani_folder,
        )
        self.paket_folder_button.pack(side="left", padx=(6, 0))

        self.paket_load_button = ctk.CTkButton(
            actions,
            text="Paket Yukle",
            width=104,
            height=34,
            corner_radius=8,
            fg_color="transparent",
            hover_color=p.surface_alt,
            text_color=p.text_muted,
            border_width=1,
            border_color=p.border,
            command=self.import_paket_dialog,
        )
        self.paket_load_button.pack(side="left", padx=(6, 0))

        return header

    def _build_statusbar(self) -> ctk.CTkFrame:
        p = self.theme.palette
        bar = ctk.CTkFrame(self, height=30, corner_radius=0, fg_color=p.surface)
        bar.grid_columnconfigure(0, weight=1)
        bar.grid_propagate(False)

        self.status_label = ctk.CTkLabel(
            bar, text="Hazir", font=self.fonts["hint"], text_color=p.text_muted, anchor="w"
        )
        self.status_label.grid(row=0, column=0, sticky="w", padx=(PAD + 6, 0))

        self.env_label = ctk.CTkLabel(
            bar,
            text=f"{self._config.database.safe_summary()}  |  images: {self._paths.images_dir}",
            font=self.fonts["hint"],
            text_color=p.text_muted,
            anchor="e",
        )
        self.env_label.grid(row=0, column=1, sticky="e", padx=(0, PAD + 6))
        return bar

    def _bind_shortcuts(self) -> None:
        """Klavye kisayollari: Ctrl+S kaydet/guncelle, Ctrl+Del sil, Esc temizle, F5 yenile."""
        self.bind("<Control-s>", lambda _e: self._shortcut_save())
        self.bind("<Control-S>", lambda _e: self._shortcut_save())
        self.bind("<Control-Delete>", lambda _e: self._shortcut(self.delete_record))
        self.bind("<Escape>", lambda _e: self.clear_form())
        self.bind("<F5>", lambda _e: self._shortcut(self.refresh_records))

    def _shortcut_save(self) -> str:
        """Secili kayit varsa gunceller, yoksa yeni kayit ekler."""
        if self.form_panel.current_id is None:
            return self._shortcut(self.save_record)
        return self._shortcut(self.update_record)

    def _shortcut(self, eylem) -> str:
        if self._db.is_connected:
            eylem()
        return "break"

    # ------------------------------------------------------------------
    # Veritabani akislari
    # ------------------------------------------------------------------
    def connect_to_database(self) -> None:
        self._set_status("Veritabanina baglaniliyor...")
        self.update_idletasks()
        try:
            self._db.reconnect(self._config.database)
        except DatabaseError as exc:
            self._set_connection_state(False)
            self._set_status(str(exc))
            messagebox.showerror(
                "Baglanti Hatasi",
                f"{exc}\n\nAyar dosyasi: {self._config_manager.config_path}",
                parent=self,
            )
            return

        try:
            table_ready = self._db.schema_ready()
        except DatabaseError as exc:
            self._set_connection_state(True, schema_ok=False)
            self._set_status(str(exc))
            return

        if not table_ready:
            self._set_connection_state(True, schema_ok=False)
            self._set_status("Baglanti kuruldu ancak destinasyon tablosu bulunamadi.")
            messagebox.showwarning(
                "Tablo Bulunamadi",
                "Ne 'destinations' (web) ne de 'trabzon_destinasyonlar' tablosu var.\n\n"
                "Veri aktarmak icin destinasyon\\baslat.bat dosyasini calistirin\n"
                "veya sql/01_schema.sql ile eski semayi kurun.",
                parent=self,
            )
            return

        self._set_connection_state(True, schema_ok=True)
        try:
            self._reload_lookups()
        except DatabaseError as exc:
            self._set_status(str(exc))
            messagebox.showerror("Sema Hatasi", str(exc), parent=self)
            return
        postgis = "PostGIS aktif" if self._db.postgis_enabled else "PostGIS yok"
        sema = "destinations (web)" if self._db.uses_web_schema else "trabzon_destinasyonlar"
        try:
            adet = self._repo.count()
        except DatabaseError:
            adet = 0
        self._set_status(
            f"Baglanti kuruldu - {sema}, {adet} kayit, PostgreSQL {self._db.server_version()}, {postgis}."
        )
        self.refresh_records()
        if adet == 0:
            messagebox.showinfo(
                "Veri yok",
                "Destinasyon tablosu bos.\n\n"
                "Veri aktarmak icin:\n"
                "  destinasyon\\baslat.bat --import\n\n"
                "veya odev klasorunden import_from_odev.py calistirin.",
                parent=self,
            )

    def check_schema(self) -> None:
        if not self._db.is_connected:
            messagebox.showinfo("Sema Kontrolu", "Once veritabanina baglanin.", parent=self)
            return
        try:
            exists = self._db.schema_ready()
            adet = self._repo.count() if exists else 0
            tablo = "destinations" if self._db.uses_web_schema else "trabzon_destinasyonlar"
        except DatabaseError as exc:
            messagebox.showerror("Sema Kontrolu", str(exc), parent=self)
            return

        messagebox.showinfo(
            "Sema Kontrolu",
            f"Tablo ({tablo}): {'var' if exists else 'YOK'}\n"
            f"Kayit sayisi: {adet}\n"
            f"Iller / turler: {'hazir' if exists else '-'}\n"
            f"PostGIS: {'aktif' if self._db.postgis_enabled else 'kurulu degil'}\n"
            f"Sunucu: PostgreSQL {self._db.server_version()}\n"
            f"Baglanti: {self._config.database.safe_summary()}",
            parent=self,
        )

    def refresh_records(self, select_id: Optional[str] = None) -> None:
        if not self._db.is_connected:
            self._items = []
            self.table_panel.load_items([])
            return

        previous_id = select_id if select_id is not None else self.form_panel.current_id
        il_id, tur_id = self.table_panel.selected_filters()
        try:
            self._items = self._repo.list_all(
                search=self.table_panel.search_var.get(),
                limit=self._config.application.max_rows,
                il_id=il_id,
                tur_id=tur_id,
            )
        except DatabaseError as exc:
            self._set_status(str(exc))
            messagebox.showerror("Sorgu Hatasi", str(exc), parent=self)
            return
        except Exception as exc:  # beklenmeyen surucu hatalari
            logger.exception("Kayitlar okunamadi")
            self._set_status(f"Kayitlar okunamadi: {exc}")
            return

        self.table_panel.load_items(self._items)
        if previous_id is not None:
            self.table_panel.select_by_id(previous_id)
        if self.table_panel.selected_item() is None:
            self.on_selection_changed(None)
        self._set_status(f"{len(self._items)} kayit listelendi.")

    # ------------------------------------------------------------------
    # CRUD akislari
    # ------------------------------------------------------------------
    def save_record(self) -> None:
        """Formdaki bilgileri yeni kayit olarak ekler."""
        item = self._validated_form_data()
        if item is None:
            return
        item.id = None  # yeni kayit; secili kaydin id'si tasinmaz

        try:
            kayit = self._repo.insert(item)
        except DuplicateNameError as exc:
            self.form_panel.set_message(str(exc), "error")
            messagebox.showwarning("Kayit Eklenemedi", str(exc), parent=self)
            return
        except (DatabaseError, ValidationError) as exc:
            self._report_error("Kayit Eklenemedi", exc)
            return

        self._discard_pending_images(keep=kayit.resim_yolu)
        self.refresh_records(select_id=kayit.id)
        self.form_panel.set_message(f"Kayit eklendi (#{kayit.id}).", "success")
        self._set_status(f"'{kayit.ad}' eklendi.")

    def update_record(self) -> None:
        """Secili kaydi formdaki degerlerle gunceller."""
        kayit_id = self.form_panel.current_id
        if kayit_id is None:
            self.form_panel.set_message("Once tablodan bir kayit secin.", "warning")
            return

        onceki = next((i for i in self._items if i.id == kayit_id), None)
        item = self._validated_form_data()
        if item is None:
            return
        item.id = kayit_id

        try:
            kayit = self._repo.update(item)
        except DuplicateNameError as exc:
            self.form_panel.set_message(str(exc), "error")
            messagebox.showwarning("Kayit Guncellenemedi", str(exc), parent=self)
            return
        except (DatabaseError, ValidationError) as exc:
            self._report_error("Kayit Guncellenemedi", exc)
            return

        # Resim degistiyse eskisi artik kullanilmiyorsa diskten silinir
        eski_resim = onceki.resim_yolu if onceki else None
        if eski_resim and eski_resim != kayit.resim_yolu:
            self._delete_image_if_unused(eski_resim, exclude_id=kayit.id)

        self._discard_pending_images(keep=kayit.resim_yolu)
        self.refresh_records(select_id=kayit.id)
        self.form_panel.set_message("Kayit guncellendi.", "success")
        self._set_status(f"'{kayit.ad}' guncellendi.")

    def delete_record(self) -> None:
        """Secili kaydi ve (baska kayit kullanmiyorsa) resmini siler."""
        kayit_id = self.form_panel.current_id
        if kayit_id is None:
            self.form_panel.set_message("Once tablodan bir kayit secin.", "warning")
            return

        secili = next((i for i in self._items if i.id == kayit_id), None)
        ad = secili.ad if secili else f"#{kayit_id}"
        if not messagebox.askyesno(
            "Kaydi Sil",
            f"'{ad}' kaydi silinecek.\n\n"
            "Kayda bagli resim de images/ klasorunden silinecek.\n"
            "Bu islem geri alinamaz. Devam edilsin mi?",
            icon="warning",
            parent=self,
        ):
            return

        try:
            resim_yolu = self._repo.delete(kayit_id)
        except DatabaseError as exc:
            self._report_error("Kayit Silinemedi", exc)
            return

        silinen_resim = False
        if resim_yolu:
            silinen_resim = self._delete_image_if_unused(resim_yolu, exclude_id=None)

        self.clear_form()
        self.refresh_records()
        ek = " Resmi de silindi." if silinen_resim else ""
        self.form_panel.set_message(f"'{ad}' silindi.{ek}", "success")
        self._set_status(f"'{ad}' silindi.{ek}")

    # ------------------------------------------------------------------
    def _validated_form_data(self) -> Optional[Destinasyon]:
        """Formu dogrular; hatalari kullaniciya gosterir.

        Trabzon disindaki koordinatlar engellenmez, yalnizca onay istenir.
        """
        item = self.form_panel.to_destinasyon()
        try:
            item.validate()
        except ValidationError as exc:
            self.form_panel.set_message("  •  ".join(exc.errors), "error")
            self._set_status("Form eksik veya hatali.")
            return None

        if item.koordinat_bolge_disinda() and not messagebox.askyesno(
            "Koordinat Kontrolu",
            f"Girilen koordinat ({item.enlem}, {item.boylam}) "
            f"{item.il_ad or 'secilen il'} bolgesinin disinda gorunuyor.\n"
            "Yine de kaydedilsin mi?",
            parent=self,
        ):
            self.form_panel.set_message("Kayit koordinat onayi verilmedigi icin durduruldu.")
            return None
        return item

    def _report_error(self, baslik: str, exc: BaseException) -> None:
        mesaj = str(exc)
        logger.error("%s: %s", baslik, mesaj)
        self.form_panel.set_message(mesaj, "error")
        messagebox.showerror(baslik, mesaj, parent=self)
        self._set_status(mesaj)

    # ------------------------------------------------------------------
    # Resim dosyasi yasam dongusu
    # ------------------------------------------------------------------
    def create_new_type(self) -> None:
        """Kullanicinin yeni destinasyon turu eklemesini saglar."""
        if not self._db.is_connected:
            return
        dialog = ctk.CTkInputDialog(
            text="Yeni destinasyon türünün adını yazın:",
            title="Yeni Tür Oluştur",
        )
        ad = dialog.get_input()
        if ad is None:
            return
        ad = ad.strip()
        if not ad:
            self.form_panel.set_message("Tur adi bos olamaz.", "error")
            return
        try:
            kayit = self._lookups.insert_tur(ad)
        except DuplicateTypeError as exc:
            messagebox.showwarning("Tur Eklenemedi", str(exc), parent=self)
            self.form_panel.set_message(str(exc), "error")
            return
        except DatabaseError as exc:
            self._report_error("Tur Eklenemedi", exc)
            return

        self._reload_lookups()
        self.form_panel.set_tur(kayit.ad)
        self.form_panel.set_message(f"Yeni tur eklendi: {kayit.ad}", "success")
        self._set_status(f"Tur eklendi: {kayit.ad}")

    def _reload_lookups(self) -> None:
        iller = self._lookups.list_iller()
        turler = self._lookups.list_turler()
        self.form_panel.set_lookups(iller, turler)
        self.table_panel.set_lookups(iller, turler)

    def _delete_image_if_unused(self, resim_yolu: str, exclude_id: Optional[int]) -> bool:
        """Resmi siler; baska bir kayit ayni dosyayi kullaniyorsa dokunmaz."""
        try:
            if self._repo.image_in_use(resim_yolu, exclude_id=exclude_id):
                logger.info("Resim baska kayitta kullaniliyor, silinmedi: %s", resim_yolu)
                return False
        except DatabaseError:
            logger.warning("Resim kullanimi sorgulanamadi, dosya korundu: %s", resim_yolu)
            return False

        try:
            return self._images.delete_image(resim_yolu)
        except ImageError as exc:
            logger.warning("Resim silinemedi (%s): %s", resim_yolu, exc)
            return False

    def _discard_pending_images(self, keep: Optional[str] = None) -> None:
        """Kaydedilmeden birakilan resim kopyalarini diskten temizler."""
        for resim_yolu in list(self._pending_images):
            if resim_yolu == keep:
                continue
            self._delete_image_if_unused(resim_yolu, exclude_id=None)
        self._pending_images.clear()

    def _schedule_search(self, _text: str) -> None:
        """Her tus vurusunda sorgu atmamak icin gecikmeli arama."""
        if self._search_job is not None:
            self.after_cancel(self._search_job)
        self._search_job = self.after(SEARCH_DEBOUNCE_MS, self.refresh_records)

    # ------------------------------------------------------------------
    # Secim / form akislari
    # ------------------------------------------------------------------
    def on_selection_changed(self, item: Optional[Destinasyon]) -> None:
        # Baska kayda gecilirken kaydedilmemis resim kopyalari birakilmaz
        self._discard_pending_images(keep=item.resim_yolu if item else None)

        self.form_panel.set_selection(item)
        gallery: List[Path] = []
        if item:
            for rel in item.resim_yollari or ([item.resim_yolu] if item.resim_yolu else []):
                pth = self._images.absolute_path(rel)
                if pth.is_file():
                    gallery.append(pth)
        image_path = gallery[0] if gallery else None
        self.detail_panel.show_item(item, image_path)
        if item and gallery:
            self.detail_panel.set_gallery(gallery)

        if item and item.resim_yolu and image_path is None:
            self.form_panel.set_message(
                f"Uyari: '{item.resim_yolu}' dosyasi images/ klasorunde yok.", "warning"
            )

    def clear_form(self) -> None:
        self._discard_pending_images()
        self.table_panel.clear_selection()
        self.form_panel.set_selection(None)
        self.detail_panel.show_item(None, None)
        self._set_status("Form temizlendi.")

    def select_image(self) -> None:
        file_path = filedialog.askopenfilename(
            title="Destinasyon Resmi Sec",
            initialdir=str(self._paths.root),
            filetypes=self._images.file_dialog_types(),
            parent=self,
        )
        if not file_path:
            return
        try:
            relative = self._images.import_image(
                file_path, destinasyon_adi=self.form_panel.ad_entry.get()
            )
        except ImageError as exc:
            messagebox.showwarning("Resim Eklenemedi", str(exc), parent=self)
            self.form_panel.set_message(str(exc), "error")
            return

        # Onceki secim kaydedilmediyse kopyasi diskte birakilmaz
        self._pending_images.add(relative)
        self.form_panel.add_image_path(relative)
        self.form_panel.set_message(
            f"Resim kopyalandi: {relative}\nKalici olmasi icin kaydi kaydedin.", "success"
        )
        self.detail_panel.set_image(self._images.absolute_path(relative))
        self._set_status(f"Resim images/ klasorune kopyalandi: {relative}")

    def clear_image_selection(self) -> None:
        removed = self.form_panel.remove_selected_image()
        if not removed:
            self.form_panel.set_message("Silmek icin listeden bir resim secin.", "warning")
            return
        if removed in self._pending_images:
            self._pending_images.discard(removed)
            self._delete_image_if_unused(removed, exclude_id=None)
            self.form_panel.set_message("Kaydedilmemis resim silindi.")
        else:
            self.form_panel.set_message(
                "Resim listeden cikarildi. Guncelle'ye basinca veritabanina yansir.",
                "warning",
            )
        first = self.form_panel.image_relative_path
        self.detail_panel.set_image(self._images.absolute_path(first) if first else None)

    def open_duplicate_dialog(self) -> None:
        if not self._db.is_connected:
            messagebox.showwarning("Baglanti", "Once veritabanina baglanin.", parent=self)
            return
        if not self._db.uses_web_schema:
            messagebox.showwarning(
                "Sema",
                "Cift kayit araci yalnizca web tablosu (destinations) ile calisir.",
                parent=self,
            )
            return
        DuplicateDialog(self, self.theme, self._duplicates, on_done=self.refresh_records)

    def export_paket_dialog(self) -> None:
        if not self._db.is_connected:
            messagebox.showwarning("Baglanti", "Once veritabanina baglanin.", parent=self)
            return
        PaketDialog(self, self.theme, self._paket, mode="export", on_done=self.refresh_records)

    def import_paket_dialog(self) -> None:
        if not self._db.is_connected:
            messagebox.showwarning("Baglanti", "Once veritabanina baglanin.", parent=self)
            return
        PaketDialog(self, self.theme, self._paket, mode="import", on_done=self.refresh_records)

    def save_to_veritabani_folder(self) -> None:
        if not self._db.is_connected:
            messagebox.showwarning("Baglanti", "Once veritabanina baglanin.", parent=self)
            return
        hedef = self._paket.varsayilan_klasor
        try:
            sonuc = self._paket.export_paket(
                hedef,
                PaketSecenekleri(
                    destinasyonlar=True,
                    kullanicilar=True,
                    profiller=True,
                    blog_yazilari=True,
                    resimleri_kopyala=True,
                ),
            )
            messagebox.showinfo(
                "Kaydedildi",
                f"Tum veriler klasore yazildi:\n{hedef}\n\n"
                f"Destinasyon: {sonuc.destinasyon_sayisi}, resim: {sonuc.resim_sayisi}",
                parent=self,
            )
        except Exception as exc:
            messagebox.showerror("Hata", str(exc), parent=self)

    # ------------------------------------------------------------------
    # Yardimci
    # ------------------------------------------------------------------
    def _set_connection_state(self, connected: bool, schema_ok: bool = True) -> None:
        p = self.theme.palette
        if connected and schema_ok:
            self.status_dot.configure(text_color=p.success)
            self.connection_label.configure(text="Baglanti aktif")
        elif connected:
            self.status_dot.configure(text_color=p.warning)
            self.connection_label.configure(text="Baglandi / tablo yok")
        else:
            self.status_dot.configure(text_color=p.danger)
            self.connection_label.configure(text="Baglanti yok")

        usable = connected and schema_ok
        self.form_panel.set_write_enabled(usable)
        self.table_panel.refresh_button.configure(state="normal" if usable else "disabled")
        self.env_label.configure(
            text=f"{self._config.database.safe_summary()}  |  images: {self._paths.images_dir}"
        )

    def _set_status(self, message: str) -> None:
        self.status_label.configure(text=message)
        logger.info("Durum: %s", message)

    def _return_to_hub(self) -> None:
        self.on_close()
        if self._on_back is not None:
            self._on_back()

    def on_close(self) -> None:
        self._discard_pending_images()
        self.destroy()
