-- =====================================================================
-- OPSIYONEL: PostGIS destegi (mobil/web uygulamasinda "yakinimdakiler"
-- sorgulari icin). Bu script 01_schema.sql'den SONRA calistirilir.
--
-- Mantik: enlem/boylam sutunlari kaynak veri olarak kalir; geom sutunu
-- bunlardan uretilen (GENERATED) bir geography(Point, 4326) alanidir.
-- Boylece GUI tarafinda ek bir yazma mantigi gerekmez.
--
--   psql -U postgres -d trabzon_turizm -f sql/02_postgis_opsiyonel.sql
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE trabzon_destinasyonlar
    ADD COLUMN IF NOT EXISTS geom geography(Point, 4326)
    GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(boylam::double precision, enlem::double precision), 4326)::geography
    ) STORED;

-- Mesafe / yakinlik sorgulari icin uzamsal indeks
CREATE INDEX IF NOT EXISTS idx_destinasyon_geom
    ON trabzon_destinasyonlar USING GIST (geom);

-- Ornek kullanim: verilen noktanin 5 km cevresindeki destinasyonlar
-- SELECT ad, ST_Distance(geom, ST_MakePoint(39.7168, 41.0027)::geography) AS metre
-- FROM trabzon_destinasyonlar
-- WHERE ST_DWithin(geom, ST_MakePoint(39.7168, 41.0027)::geography, 5000)
-- ORDER BY metre;
