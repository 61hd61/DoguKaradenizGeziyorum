-- =====================================================================
-- OPSIYONEL: Arayuzu bos veritabani olmadan denemek icin ornek kayitlar.
-- sql/04_il_ve_tur.sql bu dosyadan ONCE calistirilmalidir.
-- resim_yolu alanlari NULL birakildi; resimler GUI uzerinden eklenecek.
-- =====================================================================

INSERT INTO trabzon_destinasyonlar (ad, aciklama, il_id, tur_id, enlem, boylam, resim_yolu)
SELECT v.ad, v.aciklama, i.id, t.id, v.enlem, v.boylam, NULL
FROM (VALUES
    ('Sumela Manastiri', 'Altindere Vadisi''nda, kayaliga oyulmus 4. yuzyil manastiri.', 'Trabzon', 'Kilise', 40.690278, 39.658611),
    ('Uzungol',          'Caykara ilcesinde heyelan sonucu olusmus goller ve yayla turizmi merkezi.', 'Trabzon', 'Göl', 40.620833, 40.297222),
    ('Ayasofya Muzesi',  '13. yuzyil Trabzon Rum Imparatorlugu doneminden kalma kilise/cami yapisi.', 'Trabzon', 'Müze', 40.999722, 39.703889),
    ('Ataturk Kosku',    '1903 yapimi, Ataturk''un 1924''te konakladigi tarihi kosk ve bahcesi.', 'Trabzon', 'Tarihi bina', 40.999167, 39.694167)
) AS v(ad, aciklama, il_ad, tur_ad, enlem, boylam)
JOIN iller i ON i.ad = v.il_ad
JOIN destinasyon_turleri t ON t.ad = v.tur_ad
ON CONFLICT DO NOTHING;
