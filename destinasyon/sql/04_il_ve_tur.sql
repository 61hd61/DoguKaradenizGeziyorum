-- =====================================================================
-- Il ve destinasyon turu destegi (mevcut veritabanlarina migrasyon)
--
--   psql -U postgres -d trabzon_turizm -f sql/04_il_ve_tur.sql
--
-- Uygulama acilista bu semayi kendisi de uygular (ensure_extended_schema).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS iller (
    id  SERIAL PRIMARY KEY,
    ad  VARCHAR(40) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_il_ad
    ON iller (lower(btrim(ad)));

INSERT INTO iller (ad) VALUES
    ('Trabzon'),
    ('Giresun'),
    ('Ordu'),
    ('Gümüşhane'),
    ('Rize'),
    ('Artvin')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS destinasyon_turleri (
    id              SERIAL PRIMARY KEY,
    ad              VARCHAR(80) NOT NULL,
    olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_tur_ad_bos CHECK (length(btrim(ad)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tur_ad
    ON destinasyon_turleri (lower(btrim(ad)));

INSERT INTO destinasyon_turleri (ad) VALUES
    ('Cami'),
    ('Türbe'),
    ('Kilise'),
    ('Şapel'),
    ('Kale'),
    ('Tarihi bina'),
    ('Han'),
    ('Hamam'),
    ('Şelale'),
    ('Köprü'),
    ('Sivil mimari'),
    ('Mağara'),
    ('Milli park'),
    ('Müze'),
    ('Şenlikler'),
    ('Göl'),
    ('Kanyon')
ON CONFLICT DO NOTHING;

ALTER TABLE trabzon_destinasyonlar
    ADD COLUMN IF NOT EXISTS il_id  INTEGER,
    ADD COLUMN IF NOT EXISTS tur_id INTEGER;

UPDATE trabzon_destinasyonlar d
   SET il_id = (SELECT id FROM iller WHERE ad = 'Trabzon' LIMIT 1)
 WHERE d.il_id IS NULL;

UPDATE trabzon_destinasyonlar d
   SET tur_id = (SELECT id FROM destinasyon_turleri WHERE ad = 'Tarihi bina' LIMIT 1)
 WHERE d.tur_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_destinasyon_il'
    ) THEN
        ALTER TABLE trabzon_destinasyonlar
            ADD CONSTRAINT fk_destinasyon_il
            FOREIGN KEY (il_id) REFERENCES iller (id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_destinasyon_tur'
    ) THEN
        ALTER TABLE trabzon_destinasyonlar
            ADD CONSTRAINT fk_destinasyon_tur
            FOREIGN KEY (tur_id) REFERENCES destinasyon_turleri (id);
    END IF;
END $$;

ALTER TABLE trabzon_destinasyonlar
    ALTER COLUMN il_id SET NOT NULL,
    ALTER COLUMN tur_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_destinasyon_il  ON trabzon_destinasyonlar (il_id);
CREATE INDEX IF NOT EXISTS idx_destinasyon_tur ON trabzon_destinasyonlar (tur_id);

-- Ayni il icinde ayni ad tekrar edilemez; farkli illerde ayni ad serbesttir
DROP INDEX IF EXISTS uq_destinasyon_ad;
CREATE UNIQUE INDEX IF NOT EXISTS uq_destinasyon_il_ad
    ON trabzon_destinasyonlar (il_id, lower(btrim(ad)));

COMMENT ON COLUMN trabzon_destinasyonlar.il_id  IS 'iller tablosuna FK';
COMMENT ON COLUMN trabzon_destinasyonlar.tur_id IS 'destinasyon_turleri tablosuna FK';

COMMIT;
