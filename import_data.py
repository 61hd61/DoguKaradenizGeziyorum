#!/usr/bin/env python3
"""
Veri İçe Aktarma Scripti
ödev/ klasöründeki tüm destinasyon verilerini PostgreSQL veritabanına aktarır.
"""

import os
import re
import sys
from pathlib import Path
from decimal import Decimal
from typing import Optional, List, Tuple, Dict, Any

import pg8000.dbapi as pgdb
from docx import Document
import openpyxl
import pandas as pd

# Veritabanı yapılandırması (config.ini'den alınan değerler)
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "trabzon_turizm",
    "user": "postgres",
    "password": "1234",
}

# İllerin listesi
ILLER = [
    "Trabzon", "Giresun", "Ordu", "Gümüşhane", "Rize", "Artvin"
]

# Klasör adından destinasyon türü eşleştirmesi
KLASOR_TUR_ESLESTIRME = {
    # Trabzon
    "camiler-türbeler": "Cami",
    "türbeler": "Türbe",
    "kilise-manastır-şapel": "Kilise",
    "kale": "Kale",
    "göl": "Göl",
    "şelale": "Şelale",
    "müzeler": "Müze",
    "milli park": "Milli park",
    "kanyon": "Kanyon",
    "mağara": "Mağara",
    "köprüler": "Köprü",
    "han-hamam": "Hamam",
    "sivil mimari": "Sivil mimari",
    "yerleşim": "Tarihi bina",
    "şenlikler": "Şenlikler",
    "yemek listesi": None,  # Yemek listesi destinasyon değil
    
    # Gümüşhane
    "camii": "Cami",
    "değirmen": "Tarihi bina",
    "göller": "Göl",
    "hamam": "Hamam",
    "kale": "Kale",
    "kanyonlar": "Kanyon",
    "kilise-manastır-şapel": "Kilise",
    "köprü": "Köprü",
    "mağara": "Mağara",
    "milli park": "Milli park",
    "sivil mimari": "Sivil mimari",
    "türbe": "Türbe",
    "yerleşim": "Tarihi bina",
    "şelale": "Şelale",
    "şenlikler": "Şenlikler",
    
    # Rize
    "camii": "Cami",
    "göl": "Göl",
    "kale": "Kale",
    "köprü": "Köprü",
    "mağara": "Mağara",
    "milli park": "Milli park",
    "sivil mimari": "Sivil mimari",
    "türbe - mezarlık": "Türbe",
    "yerleşim": "Tarihi bina",
    "şelale": "Şelale",
    
    # Ordu
    "cami - türbe": "Cami",
    "göl": "Göl",
    "hamam": "Hamam",
    "kale": "Kale",
    "kanyon": "Kanyon",
    "kilise": "Kilise",
    "köprü": "Köprü",
    "sivil mimari": "Sivil mimari",
    "tarih": "Tarihi bina",
    "yerleşim": "Tarihi bina",
    "çeşme - su kuyusu": "Tarihi bina",
    
    # Artvin (doğrudan destinasyon klasörleri var, alt klasör yok)
    "göl": "Göl",
    "şelale": "Şelale",
    "milli park": "Milli park",
}

# Artvin için özel tür eşleştirme (klasör adından)
ARTVIN_TUR_IPUCLARI = {
    "cami": "Cami",
    "türbe": "Türbe",
    "kalesi": "Kale",
    "kilise": "Kilise",
    "manastır": "Kilise",
    "şelale": "Şelale",
    "mezarlık": "Tarihi bina",
    "hamam": "Hamam",
    "köprü": "Köprü",
    "konut": "Sivil mimari",
    "müze": "Müze",
    "kültür evi": "Müze",
    "medrese": "Tarihi bina",
    "kaymakamlık": "Tarihi bina",
    "lohman": "Tarihi bina",
    "lohman": "Tarihi bina",
    "okul": "Tarihi bina",
    "anıtı": "Tarihi bina",
    "bahçe kapısı": "Tarihi bina",
    "kaya mezarı": "Tarihi bina",
    "kayaüstü": "Tarihi bina",
    "kayalık": "Tarihi bina",
    "toprak altı": "Tarihi bina",
    "antik": "Tarihi bina",
    "yerleşim": "Tarihi bina",
    "arkeolojik": "Tarihi bina",
    "yamaç": "Tarihi bina",
}


def get_db_connection():
    """Veritabanı bağlantısı oluşturur."""
    return pgdb.connect(
        user=DB_CONFIG["user"],
        password=DB_CONFIG["password"] or None,
        host=DB_CONFIG["host"],
        port=int(DB_CONFIG["port"]),
        database=DB_CONFIG["database"],
        timeout=10,
        application_name="TurizmVeriImport",
    )


def ensure_schema(conn):
    """Gerekli tabloların varlığını kontrol eder, yoksa oluşturur."""
    cur = conn.cursor()
    try:
        # iller tablosu
        cur.execute("""
            CREATE TABLE IF NOT EXISTS iller (
                id SERIAL PRIMARY KEY,
                ad VARCHAR(40) NOT NULL
            );
        """)
        cur.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_il_ad
            ON iller (lower(btrim(ad)));
        """)
        for il in ILLER:
            cur.execute(
                "INSERT INTO iller (ad) VALUES (%s) ON CONFLICT DO NOTHING;",
                (il,)
            )
        
        # destinasyon_turleri tablosu
        cur.execute("""
            CREATE TABLE IF NOT EXISTS destinasyon_turleri (
                id SERIAL PRIMARY KEY,
                ad VARCHAR(80) NOT NULL,
                olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT chk_tur_ad_bos CHECK (length(btrim(ad)) > 0)
            );
        """)
        cur.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_tur_ad
            ON destinasyon_turleri (lower(btrim(ad)));
        """)
        
        varsayilan_turler = [
            "Cami", "Türbe", "Kilise", "Şapel", "Kale", "Tarihi bina",
            "Han", "Hamam", "Şelale", "Köprü", "Sivil mimari",
            "Mağara", "Milli park", "Müze", "Şenlikler", "Göl", "Kanyon"
        ]
        for tur in varsayilan_turler:
            cur.execute(
                "INSERT INTO destinasyon_turleri (ad) VALUES (%s) ON CONFLICT DO NOTHING;",
                (tur,)
            )
        
        # Ana destinasyon tablosu
        cur.execute("""
            CREATE TABLE IF NOT EXISTS trabzon_destinasyonlar (
                id SERIAL PRIMARY KEY,
                ad VARCHAR(150) NOT NULL,
                aciklama TEXT,
                il_id INTEGER NOT NULL,
                tur_id INTEGER NOT NULL,
                enlem NUMERIC(9, 6) NOT NULL,
                boylam NUMERIC(9, 6) NOT NULL,
                resim_yolu VARCHAR(512),
                olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                guncelleme_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT chk_enlem CHECK (enlem BETWEEN -90 AND 90),
                CONSTRAINT chk_boylam CHECK (boylam BETWEEN -180 AND 180),
                CONSTRAINT chk_ad_bos CHECK (length(btrim(ad)) > 0)
            );
        """)
        
        # Foreign keys
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_destinasyon_il') THEN
                    ALTER TABLE trabzon_destinasyonlar
                        ADD CONSTRAINT fk_destinasyon_il
                        FOREIGN KEY (il_id) REFERENCES iller (id);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_destinasyon_tur') THEN
                    ALTER TABLE trabzon_destinasyonlar
                        ADD CONSTRAINT fk_destinasyon_tur
                        FOREIGN KEY (tur_id) REFERENCES destinasyon_turleri (id);
                END IF;
            END $$;
        """)
        
        # Unique index
        cur.execute("DROP INDEX IF EXISTS uq_destinasyon_ad;")
        cur.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_destinasyon_il_ad
            ON trabzon_destinasyonlar (il_id, lower(btrim(ad)));
        """)
        
        # Indexes
        cur.execute("CREATE INDEX IF NOT EXISTS idx_destinasyon_koordinat ON trabzon_destinasyonlar (enlem, boylam);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_destinasyon_il ON trabzon_destinasyonlar (il_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_destinasyon_tur ON trabzon_destinasyonlar (tur_id);")
        
        conn.commit()
        print("[OK] Veritabani semasi hazir.")
    finally:
        cur.close()


def get_il_id(conn, il_adi: str) -> int:
    """İl ID'sini getirir."""
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM iller WHERE lower(btrim(ad)) = lower(%s);", (il_adi.strip(),))
        row = cur.fetchone()
        if row:
            return row[0]
        raise ValueError(f"Il bulunamadi: {il_adi}")
    finally:
        cur.close()


def get_tur_id(conn, tur_adi: str) -> int:
    """Destinasyon türü ID'sini getirir."""
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM destinasyon_turleri WHERE lower(btrim(ad)) = lower(%s);", (tur_adi.strip(),))
        row = cur.fetchone()
        if row:
            return row[0]
        raise ValueError(f"Tur bulunamadi: {tur_adi}")
    finally:
        cur.close()


def parse_coordinates(text: str) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    """Koordinat metninden enlem ve boylam çıkarır."""
    # "40.619 , 40.298" veya "40.9583;40.0284" formatları
    text = text.strip().replace(",", ".").replace(";", ",")
    # Sayıları bul
    numbers = re.findall(r'-?\d+\.?\d*', text)
    if len(numbers) >= 2:
        lat = Decimal(numbers[0])
        lon = Decimal(numbers[1])
        # Enlem -90 ile 90, boylam -180 ile 180 arası olmalı
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            return lat.quantize(Decimal("0.000001")), lon.quantize(Decimal("0.000001"))
    return None, None


def read_docx_text(filepath: Path) -> str:
    """DOCX dosyasından metin okur."""
    try:
        doc = Document(filepath)
        texts = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        return "\n".join(texts)
    except Exception as e:
        print(f"  [UYARI] DOCX okuma hatasi ({filepath.name}): {e}")
        return ""


def read_coordinates_from_docx(filepath: Path) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    """Koordinat DOCX dosyasından koordinatları okur."""
    text = read_docx_text(filepath)
    return parse_coordinates(text)


def read_coordinates_from_k_docx(filepath: Path) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    """k.docx dosyasından koordinatları okur (ORDU formatında)."""
    text = read_docx_text(filepath)
    # k.docx genellikle sadece koordinat içerir
    return parse_coordinates(text)


def read_description_from_m_docx(filepath: Path) -> str:
    """m.docx dosyasından açıklama okur (ORDU formatında)."""
    return read_docx_text(filepath)


def find_image_file(dest_folder: Path) -> Optional[str]:
    """Destinasyon klasöründeki ilk görsel dosyasını bulur."""
    for ext in ['.jpg', '.jpeg', '.png', '.jfif']:
        images = list(dest_folder.glob(f'*{ext}'))
        if images:
            # Göreceli yol döndür (images/ klasörüne kopyalanacak)
            return images[0].name
    return None


def normalize_name(name: str) -> str:
    """Destinasyon adını normalize eder."""
    # Parantez içindeki ilçe/mahalle bilgilerini temizle ama ana adı koru
    # Örn: "ÇEŞME 1 (AYRILIK MAHALLESİ)" -> "ÇEŞME 1"
    name = re.sub(r'\s*\([^)]+\)\s*$', '', name).strip()
    # Çoklu boşlukları tek boşluğa indir
    name = re.sub(r'\s+', ' ', name)
    return name.strip()


def determine_type_from_folder(folder_name: str, province: str) -> Optional[str]:
    """Klasör adından destinasyon türünü belirler."""
    folder_lower = folder_name.lower().strip()
    
    # Doğrudan eşleşme
    if folder_lower in KLASOR_TUR_ESLESTIRME:
        return KLASOR_TUR_ESLESTIRME[folder_lower]
    
    # Artvin için özel mantık
    if province == "Artvin":
        for keyword, tur in ARTVIN_TUR_IPUCLARI.items():
            if keyword in folder_lower:
                return tur
    
    # Kısmi eşleşme
    for keyword, tur in KLASOR_TUR_ESLESTIRME.items():
        if keyword and keyword in folder_lower:
            return tur
    
    return None


def process_csv_file(conn, csv_path: Path, province: str, default_type: str) -> int:
    """CSV dosyasından destinasyonları içe aktarır."""
    count = 0
    # Farklı encoding'leri dene
    encodings = ['utf-8', 'windows-1254', 'iso-8859-9', 'cp1254']
    df = None
    for enc in encodings:
        try:
            df = pd.read_csv(csv_path, sep=';', encoding=enc)
            break
        except UnicodeDecodeError:
            continue
        except Exception as e:
            if 'codec' not in str(e).lower():
                raise
    
    if df is None:
        print(f"  [UYARI] CSV okunamadi (encoding hatasi): {csv_path.name}")
        return 0
    
    try:
        # Sütun adlarını normalize et
        df.columns = [c.strip().lower() for c in df.columns]
        
        il_id = get_il_id(conn, province)
        tur_id = get_tur_id(conn, default_type)
        
        for _, row in df.iterrows():
            ad = str(row.get('adı', '') or row.get('ad', '') or '').strip()
            if not ad or ad.lower() == 'nan':
                continue
            
            # Koordinatları al
            enlem = row.get('enlem', row.get('lat', None))
            boylam = row.get('boylam', row.get('lon', row.get('boylam', None)))
            
            if pd.isna(enlem) or pd.isna(boylam):
                continue
            
            enlem = Decimal(str(enlem)).quantize(Decimal("0.000001"))
            boylam = Decimal(str(boylam)).quantize(Decimal("0.000001"))
            
            # Açıklama yok
            aciklama = ""
            resim_yolu = None
            
            cur = conn.cursor()
            try:
                cur.execute("""
                    INSERT INTO trabzon_destinasyonlar (ad, aciklama, il_id, tur_id, enlem, boylam, resim_yolu)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (il_id, lower(btrim(ad))) DO NOTHING
                    RETURNING id;
                """, (ad, aciklama, il_id, tur_id, enlem, boylam, resim_yolu))
                if cur.fetchone():
                    count += 1
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"  [UYARI] Kayit hatasi ({ad}): {e}")
            finally:
                cur.close()
    except Exception as e:
        print(f"  [UYARI] CSV isleme hatasi ({csv_path.name}): {e}")
    return count


def process_excel_file(conn, excel_path: Path, province: str, default_type: str) -> int:
    """Excel dosyasından destinasyonları içe aktarır."""
    count = 0
    try:
        wb = openpyxl.load_workbook(excel_path)
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            rows = list(ws.iter_rows(values_only=True))
            if not rows:
                continue
            
            # Başlık satırını atla
            headers = [str(h).strip().lower() if h else '' for h in rows[0]]
            
            il_id = get_il_id(conn, province)
            tur_id = get_tur_id(conn, default_type)
            
            for row_data in rows[1:]:
                if not any(row_data):
                    continue
                
                # Sütunları eşleştir
                ad = str(row_data[0] or '').strip() if len(row_data) > 0 else ''
                if not ad or ad.lower() == 'none':
                    continue
                
                enlem = row_data[1] if len(row_data) > 1 else None
                boylam = row_data[2] if len(row_data) > 2 else None
                
                if enlem is None or boylam is None:
                    continue
                
                try:
                    enlem = Decimal(str(enlem)).quantize(Decimal("0.000001"))
                    boylam = Decimal(str(boylam)).quantize(Decimal("0.000001"))
                except:
                    continue
                
                aciklama = ""
                resim_yolu = None
                
                cur = conn.cursor()
                try:
                    cur.execute("""
                        INSERT INTO trabzon_destinasyonlar (ad, aciklama, il_id, tur_id, enlem, boylam, resim_yolu)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (il_id, lower(btrim(ad))) DO NOTHING
                        RETURNING id;
                    """, (ad, aciklama, il_id, tur_id, enlem, boylam, resim_yolu))
                    if cur.fetchone():
                        count += 1
                    conn.commit()
                except Exception as e:
                    conn.rollback()
                finally:
                    cur.close()
    except Exception as e:
        print(f"  [UYARI] Excel isleme hatasi ({excel_path.name}): {e}")
    return count


def process_destination_folder(conn, dest_folder: Path, province: str, folder_type: str) -> int:
    """Tek bir destinasyon klasörünü işler."""
    count = 0
    folder_name = dest_folder.name
    
    # Dosyaları bul
    metin_file = None
    koordinat_file = None
    k_file = None
    m_file = None
    
    for f in dest_folder.iterdir():
        fname_lower = f.name.lower()
        if fname_lower == 'metin.docx':
            metin_file = f
        elif fname_lower == 'koordinat.docx':
            koordinat_file = f
        elif fname_lower == 'k.docx':
            k_file = f
        elif fname_lower == 'm.docx':
            m_file = f
    
    # Adı belirle (klasör adından)
    ad = normalize_name(folder_name)
    
    # Açıklamayı oku
    aciklama = ""
    if metin_file and metin_file.exists():
        aciklama = read_docx_text(metin_file)
    elif m_file and m_file.exists():
        aciklama = read_description_from_m_docx(m_file)
    
    # Koordinatları oku
    enlem, boylam = None, None
    if koordinat_file and koordinat_file.exists():
        enlem, boylam = read_coordinates_from_docx(koordinat_file)
    elif k_file and k_file.exists():
        enlem, boylam = read_coordinates_from_k_docx(k_file)
    
    if enlem is None or boylam is None:
        print(f"  [UYARI] Koordinat bulunamadi: {ad}")
        return 0
    
    # Türü belirle
    tur_adi = folder_type
    if not tur_adi:
        tur_adi = determine_type_from_folder(dest_folder.parent.name, province)
    if not tur_adi:
        tur_adi = "Tarihi bina"  # Varsayılan
    
    # Görsel
    resim_yolu = find_image_file(dest_folder)
    
    # Veritabanına ekle
    cur = conn.cursor()
    try:
        il_id = get_il_id(conn, province)
        tur_id = get_tur_id(conn, tur_adi)
        
        cur.execute("""
            INSERT INTO trabzon_destinasyonlar (ad, aciklama, il_id, tur_id, enlem, boylam, resim_yolu)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (il_id, lower(btrim(ad))) DO NOTHING
            RETURNING id;
        """, (ad, aciklama, il_id, tur_id, enlem, boylam, resim_yolu))
        if cur.fetchone():
            count = 1
            print(f"  [OK] Eklendi: {ad} ({tur_adi}) - [{float(enlem):.6f}, {float(boylam):.6f}]")
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"  [UYARI] Kayit hatasi ({ad}): {e}")
    finally:
        cur.close()
    
    return count


def process_province(conn, province_path: Path, province_name: str) -> int:
    """Bir ildeki tüm verileri işler."""
    total = 0
    print(f"\n{'='*60}")
    print(f"Isleniyor: {province_name}")
    print(f"{'='*60}")
    
    # Önce alt klasörleri kontrol et (tür klasörleri mi yoksa doğrudan destinasyon mu?)
    subdirs = [d for d in province_path.iterdir() if d.is_dir() and not d.name.startswith('~$')]
    
    # CSV/Excel dosyalarını province kökünde ara
    csv_files_root = list(province_path.glob('*.csv'))
    excel_files_root = list(province_path.glob('*.xlsx'))
    
    has_type_folders = False
    for d in subdirs:
        # Altında CSV/Excel veya başka klasörler varsa tür klasörüdür
        if list(d.glob('*.csv')) or list(d.glob('*.xlsx')) or any(sd.is_dir() for sd in d.iterdir()):
            has_type_folders = True
            break
    
    if has_type_folders:
        # Yapı: il/tür/destinasyon
        for type_folder in subdirs:
            if not type_folder.is_dir():
                continue
            
            folder_name = type_folder.name.lower()
            
            # CSV/Excel dosyalarını kontrol et
            csv_files = list(type_folder.glob('*.csv'))
            excel_files = list(type_folder.glob('*.xlsx'))
            
            tur_adi = determine_type_from_folder(folder_name, province_name)
            
            if csv_files:
                for csv_file in csv_files:
                    print(f"  CSV: {csv_file.name} -> {tur_adi}")
                    total += process_csv_file(conn, csv_file, province_name, tur_adi or "Tarihi bina")
            
            if excel_files:
                for excel_file in excel_files:
                    print(f"  Excel: {excel_file.name} -> {tur_adi}")
                    total += process_excel_file(conn, excel_file, province_name, tur_adi or "Tarihi bina")
            
            # Alt klasörlerdeki destinasyonları tara
            for dest_folder in type_folder.iterdir():
                if not dest_folder.is_dir():
                    continue
                if dest_folder.name.startswith('~$'):
                    continue
                total += process_destination_folder(conn, dest_folder, province_name, tur_adi)
    else:
        # Yapı: il/destinasyon (Giresun, Artvin gibi)
        # Province kökündeki CSV/Excel'i işle
        if csv_files_root:
            for csv_file in csv_files_root:
                print(f"  CSV: {csv_file.name} -> (province root)")
                total += process_csv_file(conn, csv_file, province_name, "Tarihi bina")
        
        if excel_files_root:
            for excel_file in excel_files_root:
                print(f"  Excel: {excel_file.name} -> (province root)")
                total += process_excel_file(conn, excel_file, province_name, "Tarihi bina")
        
        # Doğrudan destinasyon klasörlerini işle
        for dest_folder in subdirs:
            if dest_folder.name.startswith('~$'):
                continue
            total += process_destination_folder(conn, dest_folder, province_name, None)
    
    # Artvin için özel: bazı destinasyonların altında alt klasörler olabilir
    if province_name == "Artvin":
        for dest_folder in subdirs:
            if dest_folder.name.startswith('~$'):
                continue
            has_subdirs = any(d.is_dir() for d in dest_folder.iterdir())
            if has_subdirs:
                for sub_folder in dest_folder.iterdir():
                    if sub_folder.is_dir() and not sub_folder.name.startswith('~$'):
                        total += process_destination_folder(conn, sub_folder, province_name, None)
    
    print(f"\n{province_name} toplam: {total} kayit")
    return total


def copy_images_to_images_folder(source_root: Path, dest_images: Path):
    """Tüm görselleri images/ klasörüne kopyalar."""
    import shutil
    dest_images.mkdir(parents=True, exist_ok=True)
    copied = 0
    
    for province_dir in source_root.iterdir():
        if not province_dir.is_dir() or province_dir.name in ['destinasyon', '__pycache__']:
            continue
        for ext in ['.jpg', '.jpeg', '.png', '.jfif']:
            for img_file in province_dir.rglob(f'*{ext}'):
                if img_file.name.startswith('~$'):
                    continue
                dest_file = dest_images / img_file.name
                if not dest_file.exists():
                    try:
                        shutil.copy2(img_file, dest_file)
                        copied += 1
                    except Exception as e:
                        print(f"  [UYARI] Gorsel kopyalama hatasi: {e}")
    
    print(f"\n[OK] {copied} gorsel images/ klasorune kopyalandi.")


def main():
    print("=" * 60)
    print("TURIZM DESTINASYON VERI ICE AKTARMA")
    print("=" * 60)
    
    # Kaynak kök dizin
    source_root = Path(r"C:\Users\hakan\OneDrive\Masaüstü\ödev")
    
    # Veritabanına bağlan
    try:
        conn = get_db_connection()
        print("[OK] Veritabanina baglanildi.")
    except Exception as e:
        print(f"[HATA] Veritabani baglanti hatasi: {e}")
        print("  PostgreSQL calisiyor mu? config.ini ayarlari dogru mu?")
        return 1
    
    try:
        # Semayi hazirla
        ensure_schema(conn)
        
        # Gorselleri kopyala
        images_dest = Path(r"C:\Users\hakan\OneDrive\Masaüstü\ödev\destinasyon\images")
        copy_images_to_images_folder(source_root, images_dest)
        
        # Her ili isle
        total_count = 0
        for il in ILLER:
            # Klasor adini bul (buyuk/kucuk harf duyarsiz)
            il_folder = None
            for d in source_root.iterdir():
                if d.is_dir() and d.name.lower() == il.lower():
                    il_folder = d
                    break
            
            if il_folder and il_folder.name != 'destinasyon':
                total_count += process_province(conn, il_folder, il)
            else:
                print(f"\n[UYARI] {il} klasoru bulunamadi.")
        
        print(f"\n{'='*60}")
        print(f"TOPLAM: {total_count} destinasyon ice aktarildi.")
        print(f"{'='*60}")
        
        # Istatistik
        cur = conn.cursor()
        try:
            cur.execute("SELECT i.ad, COUNT(d.id) FROM iller i LEFT JOIN trabzon_destinasyonlar d ON d.il_id = i.id GROUP BY i.ad ORDER BY i.ad;")
            for row in cur.fetchall():
                print(f"  {row[0]}: {row[1]} destinasyon")
            
            cur.execute("SELECT t.ad, COUNT(d.id) FROM destinasyon_turleri t LEFT JOIN trabzon_destinasyonlar d ON d.tur_id = t.id GROUP BY t.ad ORDER BY COUNT(d.id) DESC;")
            print("\nTur dagilimi:")
            for row in cur.fetchall():
                print(f"  {row[0]}: {row[1]}")
        finally:
            cur.close()
        
    finally:
        conn.close()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())