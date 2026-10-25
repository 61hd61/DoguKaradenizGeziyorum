-- =====================================================================
-- Trabzon Turizm Destinasyonlari - Veritabani Semasi (Asama 1)
-- PostgreSQL 13+
--
-- Kullanim:
--   psql -U postgres -d trabzon_turizm -f sql/01_schema.sql
--
-- Veritabani henuz yoksa once olusturun:
--   CREATE DATABASE trabzon_turizm WITH ENCODING 'UTF8';
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Ana tablo
--   enlem / boylam  : NUMERIC olarak tutulur (GUI tarafinda dogrulanir)
--   resim_yolu      : images/ klasorune GORECELI yol (or. images/ayasofya.jpg)
--                     Binary veri veritabaninda saklanmaz.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trabzon_destinasyonlar (
    id              SERIAL PRIMARY KEY,
    ad              VARCHAR(150)    NOT NULL,
    aciklama        TEXT,
    enlem           NUMERIC(9, 6)   NOT NULL,
    boylam          NUMERIC(9, 6)   NOT NULL,
    resim_yolu      VARCHAR(512),
    olusturma_tarihi TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    guncelleme_tarihi TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    -- Koordinat sinirlari: dunya geneli + bos isim engeli
    CONSTRAINT chk_enlem  CHECK (enlem  BETWEEN  -90 AND  90),
    CONSTRAINT chk_boylam CHECK (boylam BETWEEN -180 AND 180),
    CONSTRAINT chk_ad_bos CHECK (length(btrim(ad)) > 0)
);

COMMENT ON TABLE  trabzon_destinasyonlar             IS 'Trabzon bolgesi turizm destinasyonlari';
COMMENT ON COLUMN trabzon_destinasyonlar.resim_yolu  IS 'images/ klasorune goreceli dosya yolu';

-- Ayni ada sahip mukerrer kayit girisini engelle (buyuk/kucuk harf duyarsiz)
CREATE UNIQUE INDEX IF NOT EXISTS uq_destinasyon_ad
    ON trabzon_destinasyonlar (lower(btrim(ad)));

-- Harita sinirlarina gore sorgular (bounding box) icin
CREATE INDEX IF NOT EXISTS idx_destinasyon_koordinat
    ON trabzon_destinasyonlar (enlem, boylam);

-- ---------------------------------------------------------------------
-- guncelleme_tarihi otomatik guncellemesi
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_guncelleme_tarihi()
RETURNS TRIGGER AS $$
BEGIN
    NEW.guncelleme_tarihi := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_guncelleme_tarihi ON trabzon_destinasyonlar;
CREATE TRIGGER set_guncelleme_tarihi
    BEFORE UPDATE ON trabzon_destinasyonlar
    FOR EACH ROW EXECUTE FUNCTION trg_set_guncelleme_tarihi();

COMMIT;
