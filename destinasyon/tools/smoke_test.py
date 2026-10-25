"""Arayuz ve servis duman testi (gelistirici araci).

Kontrol ettikleri:
  * AppPaths / ConfigManager : config.ini, images/ klasoru, goreceli yol
  * Destinasyon.validate()   : dogrulama kurallari
  * ImageService             : images/ altina kopyalama, cakisma, silme
  * MainWindow               : pencere acilisi, tablo/secim/onizleme akisi
                               ve ekran goruntusu (tools/smoke_screenshot.png)

Kullanim:
    python tools/smoke_test.py

config.ini'yi degistirmeden baska bir sunucuya baglanmak icin (ornegin
test konteyneri) su ortam degiskenleri kullanilabilir:
    SMOKE_DB_HOST, SMOKE_DB_PORT, SMOKE_DB_NAME, SMOKE_DB_USER,
    SMOKE_DB_PASSWORD
"""

from __future__ import annotations

import dataclasses
import os
import sys
import tempfile
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image  # noqa: E402

from app.config import ConfigManager  # noqa: E402
from app.database import DatabaseManager  # noqa: E402
from app.models import Destinasyon, ValidationError  # noqa: E402
from app.paths import AppPaths  # noqa: E402
from app.services.image_service import ImageError, ImageService  # noqa: E402

basarili = 0
basarisiz: list[str] = []


def kontrol(ad: str, kosul: bool, detay: str = "") -> None:
    global basarili
    if kosul:
        basarili += 1
        print(f"  [OK]   {ad}")
    else:
        basarisiz.append(ad)
        print(f"  [HATA] {ad} {detay}")


def pump(window, ms: int = 400) -> None:
    """Pencereyi ms suresince canli tutar (after/trace islemleri islesin)."""
    window.after(ms, window.quit)
    window.mainloop()


def ornek_resim(path: Path, boyut=(480, 300), renk="#2f81f7") -> None:
    Image.new("RGB", boyut, renk).save(path)


def ortam_ile_ezilmis(config):
    """SMOKE_DB_* ortam degiskenleri varsa baglanti ayarlarini degistirir."""
    esleme = {
        "host": "SMOKE_DB_HOST",
        "port": "SMOKE_DB_PORT",
        "dbname": "SMOKE_DB_NAME",
        "user": "SMOKE_DB_USER",
        "password": "SMOKE_DB_PASSWORD",
    }
    degisiklikler = {}
    for alan, degisken in esleme.items():
        deger = os.environ.get(degisken)
        if deger:
            degisiklikler[alan] = int(deger) if alan == "port" else deger
    if not degisiklikler:
        return config
    yeni_db = dataclasses.replace(config.database, **degisiklikler)
    print(f"  (ortam degiskenleri uygulandi: {', '.join(degisiklikler)})")
    return dataclasses.replace(config, database=yeni_db)


def formu_doldur(
    window,
    ad: str,
    aciklama: str,
    enlem: str,
    boylam: str,
    il: str = "Trabzon",
    tur: str = "Müze",
) -> None:
    form = window.form_panel
    form._set_entry(form.ad_entry, ad)
    form._set_entry(form.enlem_entry, enlem)
    form._set_entry(form.boylam_entry, boylam)
    form.aciklama_box.delete("1.0", "end")
    form.aciklama_box.insert("1.0", aciklama)
    try:
        form.il_menu.set(il)
        form.tur_menu.set(tur)
    except Exception:
        pass


def crud_testleri(window, db, paths, images, diyaloglar, yakalayici) -> None:
    """Ekle / Guncelle / Sil akislarini canli veritabaninda dogrular."""
    import time

    from app.ui import main_window as mw

    print("\n5) CRUD akislari")
    repo = window._repo
    etiket = f"Test Destinasyonu {int(time.time())}"

    # Onceki yarim kalan calismalardan artan kayitlari temizle
    for eski in repo.list_all(search="Test Destinasyonu"):
        artik_resim = repo.delete(eski.id)
        if artik_resim:
            images.delete_image(artik_resim)

    baslangic = repo.count()

    # -- Dogrulama: bos form kaydedilemez ------------------------------
    window.clear_form()
    formu_doldur(window, "", "", "", "")
    diyaloglar.clear()
    window.save_record()
    pump(window, 200)
    kontrol("bos form reddedildi", repo.count() == baslangic)
    kontrol(
        "dogrulama mesaji gosterildi",
        "bos olamaz" in window.form_panel.message_label.cget("text"),
        window.form_panel.message_label.cget("text"),
    )

    # -- Gecersiz koordinat --------------------------------------------
    formu_doldur(window, etiket, "", "999", "39.7")
    window.save_record()
    pump(window, 200)
    kontrol("gecersiz enlem reddedildi", repo.count() == baslangic)

    # -- Resim secimi (dosya secici taklit edilir) ----------------------
    gecici = paths.root / "tools" / "_test_resim.png"
    ornek_resim(gecici, renk="#3fb950")
    mw.filedialog.askopenfilename = lambda **_: str(gecici)  # type: ignore[assignment]

    formu_doldur(window, etiket, "Test amacli olusturuldu.", "40.95", "39.75")
    window.select_image()
    pump(window, 250)
    resim1 = window.form_panel.image_relative_path
    kontrol("resim secildi ve kopyalandi", bool(resim1) and (paths.root / resim1).is_file(), str(resim1))
    kontrol("resim bekleyen olarak isaretlendi", resim1 in window._pending_images)

    # -- Ekleme ---------------------------------------------------------
    window.save_record()
    pump(window, 400)
    yeni = next((i for i in window._items if i.ad == etiket), None)
    kontrol("kayit eklendi", yeni is not None)
    if yeni is None:
        return
    kontrol("kayit sayisi artti", repo.count() == baslangic + 1)
    kontrol("resim yolu veritabanina yazildi", yeni.resim_yolu == resim1)
    kontrol("resim dosyasi duruyor", (paths.root / yeni.resim_yolu).is_file())
    kontrol("bekleyen resim listesi bosaldi", not window._pending_images)
    kontrol("yeni kayit tabloda secili", window.form_panel.current_id == yeni.id)

    # -- Ayni ad ile ikinci kayit engellenir -----------------------------
    window.clear_form()
    formu_doldur(window, etiket, "", "40.95", "39.75")
    diyaloglar.clear()
    window.save_record()
    pump(window, 250)
    kontrol("mukerrer ad engellendi", repo.count() == baslangic + 1)
    kontrol(
        "mukerrer ad uyarisi verildi",
        any("zaten kayitli" in metin for _, metin in diyaloglar),
        str(diyaloglar[:1]),
    )

    # -- Guncelleme: aciklama + resim degisimi ---------------------------
    window.table_panel.select_by_id(yeni.id)
    pump(window, 250)
    formu_doldur(window, etiket, "Aciklama guncellendi.", "40.96", "39.76")
    yeni_kaynak = paths.root / "tools" / "_test_resim2.png"
    ornek_resim(yeni_kaynak, renk="#d29922")
    mw.filedialog.askopenfilename = lambda **_: str(yeni_kaynak)  # type: ignore[assignment]
    window.select_image()
    pump(window, 200)
    resim2 = window.form_panel.image_relative_path
    window.update_record()
    pump(window, 400)

    guncel = repo.get(yeni.id)
    kontrol("aciklama guncellendi", guncel.aciklama == "Aciklama guncellendi.")
    kontrol("enlem guncellendi", str(guncel.enlem) == "40.960000", str(guncel.enlem))
    kontrol("yeni resim kaydedildi", guncel.resim_yolu == resim2)
    kontrol("eski resim dosyasi silindi", not (paths.root / resim1).is_file())
    kontrol("yeni resim dosyasi duruyor", (paths.root / resim2).is_file())

    # -- Resim baglantisini kaldirma (kayitli resim) ---------------------
    window.clear_image_selection()
    pump(window, 150)
    kontrol("kayitli resim hemen silinmedi", (paths.root / resim2).is_file())
    window.update_record()
    pump(window, 350)
    guncel = repo.get(yeni.id)
    kontrol("resim yolu bosaltildi", guncel.resim_yolu is None)
    kontrol("resim dosyasi guncellemede silindi", not (paths.root / resim2).is_file())

    # -- Yetim resim temizligi: sec, kaydetme, formu temizle -------------
    mw.filedialog.askopenfilename = lambda **_: str(gecici)  # type: ignore[assignment]
    window.clear_form()
    diyaloglar.clear()
    window.select_image()
    pump(window, 200)
    yetim = window.form_panel.image_relative_path
    kontrol(
        "yetim aday dosya olustu",
        bool(yetim) and (paths.root / yetim).is_file(),
        f"yol={yetim} kaynak_var={gecici.is_file()} diyalog={diyaloglar[-1:]}",
    )
    window.clear_form()
    pump(window, 200)
    kontrol(
        "kaydedilmeyen resim temizlendi",
        not yetim or not (paths.root / yetim).is_file(),
    )

    # -- Trabzon disi koordinat onayi reddedilirse kayit yapilmaz --------
    yakalayici.onay_yaniti = False
    formu_doldur(window, f"{etiket} Uzak", "", "52.5", "13.4")
    window.save_record()
    pump(window, 200)
    kontrol("Trabzon disi koordinat onaysiz kaydedilmedi", repo.count() == baslangic + 1)
    yakalayici.onay_yaniti = True

    # -- Silme ------------------------------------------------------------
    mw.filedialog.askopenfilename = lambda **_: str(gecici)  # type: ignore[assignment]
    window.table_panel.select_by_id(yeni.id)
    pump(window, 200)
    window.select_image()
    pump(window, 200)
    silinecek_resim = window.form_panel.image_relative_path
    window.update_record()
    pump(window, 350)

    diyaloglar.clear()
    window.delete_record()
    pump(window, 400)
    kontrol("silme onayi soruldu", any(tur == "onay" for tur, _ in diyaloglar))
    kontrol("kayit silindi", repo.get(yeni.id) is None)
    kontrol("kayit sayisi basa dondu", repo.count() == baslangic)
    kontrol("silinen kaydin resmi de silindi", not (paths.root / silinecek_resim).is_file())
    kontrol("form silme sonrasi temizlendi", window.form_panel.current_id is None)
    kontrol("test kaydi veritabaninda birakilmadi", not repo.list_all(search="Test Destinasyonu"))

    for dosya in (gecici, yeni_kaynak):
        dosya.unlink(missing_ok=True)


def main() -> int:
    print("\n1) Yollar ve yapilandirma")
    paths = AppPaths()
    config = ortam_ile_ezilmis(ConfigManager(paths).load())
    paths.ensure_directories()
    kontrol("config.ini mevcut", paths.config_file.exists())
    kontrol("images/ klasoru mevcut", paths.images_dir.is_dir())
    kontrol("dbname okundu", bool(config.database.dbname), config.database.dbname)
    rel = paths.to_relative(paths.images_dir / "x.jpg")
    kontrol("goreceli yol donusumu", rel == f"{config.application.images_dir}/x.jpg", rel)
    d = config.database
    kontrol(
        "baglanti ozeti sifre icermiyor",
        d.safe_summary() == f"{d.user}@{d.host}:{d.port}/{d.dbname}",
        d.safe_summary(),
    )

    print("\n2) Model dogrulama")
    gecerli = Destinasyon(ad="Sumela Manastiri", enlem="40,690278", boylam="39.658611")
    try:
        gecerli.validate()
        kontrol("virgullu koordinat normalize edildi", gecerli.enlem == Decimal("40.690278"))
    except ValidationError as exc:
        kontrol("gecerli kayit dogrulandi", False, str(exc))

    try:
        Destinasyon(ad="", enlem="95", boylam="abc").validate()
        kontrol("gecersiz kayit reddedildi", False)
    except ValidationError as exc:
        kontrol("gecersiz kayit reddedildi", len(exc.errors) == 3, str(exc.errors))

    kontrol(
        "Trabzon disi koordinat uyarisi",
        Destinasyon(ad="T", enlem=Decimal("52"), boylam=Decimal("13")).koordinat_trabzon_disinda(),
    )

    print("\n3) Resim servisi")
    images = ImageService(paths)
    kopyalananlar: list[str] = []
    with tempfile.TemporaryDirectory() as tmp:
        kaynak = Path(tmp) / "ornek foto.png"
        ornek_resim(kaynak)

        rel1 = images.import_image(kaynak, destinasyon_adi="Sümela Manastırı")
        kopyalananlar.append(rel1)
        kontrol("resim images/ altina kopyalandi", (paths.root / rel1).is_file(), rel1)
        kontrol("dosya adi sadelestirildi", rel1.startswith("images/sumela"), rel1)

        rel2 = images.import_image(kaynak, destinasyon_adi="Sümela Manastırı")
        kopyalananlar.append(rel2)
        kontrol("isim cakismasi cozuldu", rel2 != rel1 and (paths.root / rel2).is_file(), rel2)

        gecersiz = Path(tmp) / "dosya.txt"
        gecersiz.write_text("x", encoding="utf-8")
        try:
            images.import_image(gecersiz)
            kontrol("desteklenmeyen uzanti reddedildi", False)
        except ImageError:
            kontrol("desteklenmeyen uzanti reddedildi", True)

        dis_dosya = Path(tmp) / "dis.png"
        ornek_resim(dis_dosya)
        kontrol(
            "images/ disindaki dosya silinmiyor",
            images.delete_image(str(dis_dosya)) is False and dis_dosya.exists(),
        )
        kontrol(
            "resim silme calisiyor",
            images.delete_image(rel1) and not (paths.root / rel1).is_file(),
        )
        kopyalananlar.remove(rel1)

    print("\n4) Ana pencere")
    from app.ui import main_window as mw  # gec import: Tk baslatmasi icin
    from app.ui.main_window import MainWindow

    # Modal diyaloglar testi kilitlemesin; cagrilar kaydedilir
    diyaloglar: list[tuple[str, str]] = []

    class DiyalogYakalayici:
        onay_yaniti = True

        @staticmethod
        def showerror(title, message, **_):
            diyaloglar.append(("error", f"{title}: {message}"))

        @staticmethod
        def showwarning(title, message, **_):
            diyaloglar.append(("warning", f"{title}: {message}"))

        @staticmethod
        def showinfo(title, message, **_):
            diyaloglar.append(("info", f"{title}: {message}"))

        @staticmethod
        def askyesno(title, message, **_):
            diyaloglar.append(("onay", f"{title}: {message}"))
            return DiyalogYakalayici.onay_yaniti

    mw.messagebox = DiyalogYakalayici  # type: ignore[assignment]

    db = DatabaseManager(config.database)
    window = MainWindow(
        paths=paths, config=config, config_manager=ConfigManager(paths), db=db
    )
    window.geometry("1360x820+40+40")
    pump(window, 900)  # otomatik baglanti denemesi bu sirada calisir

    kontrol("pencere olustu", bool(window.winfo_exists()))
    baglanti_metni = window.connection_label.cget("text")
    if db.is_connected:
        kontrol("veritabani baglantisi kuruldu", baglanti_metni == "Baglanti aktif", baglanti_metni)
        kontrol("yazma butonu aktif", str(window.form_panel.save_button.cget("state")) == "normal")
        kayit_sayisi = len(window.table_panel.tree.get_children())
        kontrol("kayitlar listelendi", kayit_sayisi > 0, f"{kayit_sayisi} satir")
        kontrol("hata diyalogu cikmadi", not diyaloglar, str(diyaloglar[:1]))
        kontrol(
            "durum cubugu kayit sayisini bildirdi",
            "kayit listelendi" in window.status_label.cget("text"),
            window.status_label.cget("text"),
        )
        kontrol("PostGIS tespit edildi", db.postgis_enabled)

        # Arama: sunucu tarafi ILIKE filtresi
        window.table_panel.search_var.set("uzungol")
        pump(window, 700)
        kontrol(
            "arama filtreledi",
            len(window.table_panel.tree.get_children()) == 1,
            f"{len(window.table_panel.tree.get_children())} satir",
        )
        window.table_panel.search_var.set("")
        pump(window, 700)
        kontrol("arama temizlenince liste doldu", len(window.table_panel.tree.get_children()) > 1)

        # Repository dogrudan: sayim ve tek kayit okuma
        kontrol("repository count", window._repo.count() == len(window._items))
        ilk = window._items[0]
        kontrol("repository get", window._repo.get(ilk.id).ad == ilk.ad)
    else:
        kontrol("baglanti yok durumu bildirildi", baglanti_metni == "Baglanti yok", baglanti_metni)
        kontrol(
            "yazma butonlari kapali",
            str(window.form_panel.save_button.cget("state")) == "disabled",
        )
        kontrol(
            "baglanti hatasi diyalogla bildirildi",
            any(seviye == "error" for seviye, _ in diyaloglar),
            str(diyaloglar[:1]),
        )

    # Arayuz akisini veritabanindan bagimsiz dogrulamak icin ornek veri
    onizleme_rel = kopyalananlar[0]
    ornekler = [
        Destinasyon(
            id=901,
            ad="Sumela Manastiri",
            aciklama="Altindere Vadisi'nda kayaliga oyulmus 4. yuzyil manastiri.",
            enlem=Decimal("40.690278"),
            boylam=Decimal("39.658611"),
            resim_yolu=onizleme_rel,
        ),
        Destinasyon(
            id=902,
            ad="Uzungol",
            aciklama="Caykara'da heyelan golu ve yayla turizmi merkezi.",
            enlem=Decimal("40.620833"),
            boylam=Decimal("40.297222"),
            resim_yolu=None,
        ),
        Destinasyon(
            id=903,
            ad="Eksik Resimli Kayit",
            aciklama="Resim yolu veritabaninda var ama dosya yok.",
            enlem=Decimal("41.0"),
            boylam=Decimal("39.72"),
            resim_yolu="images/olmayan_dosya.jpg",
        ),
    ]
    window.table_panel.load_items(ornekler)
    pump(window, 200)
    kontrol("tablo uc satir gosterdi", len(window.table_panel.tree.get_children()) == 3)

    window.table_panel.select_by_id(901)
    pump(window, 300)
    kontrol("secim forma yansidi", window.form_panel.ad_entry.get() == "Sumela Manastiri")
    kontrol("kayit id etiketi", window.form_panel.id_label.cget("text") == "Kayit #901")
    kontrol("enlem alani dolu", window.form_panel.enlem_entry.get() == "40.690278")
    kontrol("detay basligi", window.detail_panel.name_label.cget("text") == "Sumela Manastiri")
    kontrol("onizleme resmi yuklendi", window.detail_panel._ctk_image is not None)
    kontrol("onizleme metni temizlendi", window.detail_panel.preview_label.cget("text") == "")

    window.table_panel.select_by_id(902)
    pump(window, 250)
    kontrol(
        "resimsiz kayitta 'Resim yok'",
        window.detail_panel.preview_label.cget("text") == "Resim yok",
        window.detail_panel.preview_label.cget("text"),
    )
    kontrol("resim yolu alani bos", window.form_panel.image_path_var.get() == "")

    window.table_panel.select_by_id(903)
    pump(window, 250)
    kontrol(
        "eksik dosya uyarisi gosterildi",
        "images/olmayan_dosya.jpg" in window.form_panel.message_label.cget("text"),
        window.form_panel.message_label.cget("text"),
    )
    kontrol(
        "eksik dosyada 'Resim yok'",
        window.detail_panel.preview_label.cget("text") == "Resim yok",
    )

    # Siralama: ad basligina tiklayinca ters sirala
    window.table_panel._sort_by("ad")
    pump(window, 150)
    ilk_satir = window.table_panel.tree.get_children()[0]
    kontrol("siralama tersine cevrildi", ilk_satir == "902", ilk_satir)

    window.table_panel.select_by_id(901)
    pump(window, 200)
    window.clear_form()
    pump(window, 200)
    kontrol("temizle formu sifirladi", window.form_panel.current_id is None)
    kontrol("temizle ad alanini bosaltti", window.form_panel.ad_entry.get() == "")
    kontrol("temizle secimi kaldirdi", window.table_panel.selected_item() is None)

    if db.is_connected:
        crud_testleri(window, db, paths, images, diyaloglar, DiyalogYakalayici)
    else:
        print("\n5) CRUD akislari  [ATLA] veritabani baglantisi yok")

    # Ekran goruntusu
    window.refresh_records()
    pump(window, 300)
    ilk = window.table_panel.tree.get_children()
    if ilk:
        window.table_panel.select_by_id(int(ilk[0]))
    pump(window, 400)
    cikti = paths.root / "tools" / "smoke_screenshot.png"
    try:
        from PIL import ImageGrab

        x, y = window.winfo_rootx(), window.winfo_rooty()
        bbox = (x, y, x + window.winfo_width(), y + window.winfo_height())
        ImageGrab.grab(bbox=bbox).save(cikti)
        kontrol("ekran goruntusu alindi", cikti.is_file(), str(cikti))
    except Exception as exc:  # ekran yakalama ortama baglidir
        print(f"  [ATLA] ekran goruntusu alinamadi: {exc}")

    window.on_close()

    print(f"\nSonuc: {basarili} basarili, {len(basarisiz)} basarisiz")
    for ad in basarisiz:
        print(f"  - {ad}")
    return 1 if basarisiz else 0


def temizle(paths: AppPaths) -> None:
    """Test sirasinda olusan gecici dosyalari siler."""
    hedefler = [
        *paths.images_dir.glob("sumela_manastiri*"),
        *paths.images_dir.glob("test_resim*"),
        *paths.images_dir.glob("test_destinasyonu*"),
        *(paths.root / "tools").glob("_test_resim*"),
    ]
    for dosya in hedefler:
        try:
            dosya.unlink()
        except OSError:
            pass


if __name__ == "__main__":
    try:
        cikis = main()
    finally:
        temizle(AppPaths())
    sys.exit(cikis)
