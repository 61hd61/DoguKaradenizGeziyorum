# Doğu Karadeniz Geziyorum

**Canlı site:** https://61hd61.github.io/DoguKaradenizGeziyorum/

Haritayı, destinasyon sayfalarını ve tur listesini bu adreste gezebilirsiniz. Giriş, yorum ve yönetim bilgisayarınızdaki sunucuda çalışır (`TUMUNU-BASLAT.bat`).

Karadeniz turizm platformu: **harita (web)**, **API**, **masaüstü veri paneli**, isteğe bağlı **mobil (Expo)**.

## Ne nerede?

| Adres | Ne? |
|--------|-----|
| **http://localhost:5173** | **Asıl uygulama** — harita, giriş, tur, profil, admin |
| **http://localhost:3000/health** | **API** — JSON; tarayıcıda `{ "status": "ok" }` görürsünüz. Site değil, arka uç. |
| **Masaüstü panel** | `destinasyon\baslat-panel.bat` — destinasyon CRUD, paket, çift kayıt |

GitHub’daki `localhost` linkleri **sadece bilgisayarınızda sunucu çalışırken** açılır; repoya tıklayınca otomatik çalışmaz.

## İlk kurulum (Windows)

1. **Node.js 20+** ve **PostgreSQL** (şifre örnek: `1234`)
2. Veritabanları: `KULLANICI-VERITABANI-OLUSTUR.bat`  
   veya `docker compose up -d` (kök `docker-compose.yml`)
3. Tek komut kurulum:
   ```bat
   KURULUM.bat
   ```
4. Çalıştır:
   ```bat
   TUMUNU-BASLAT.bat
   ```

**Yönetim (ayrı sayfa):** http://localhost:5173/yonetim — `admin@turizm.local` / `admin123`  
(Kullanıcı menüsünde yönetim linki yok.)  
(API ilk açılışta bu hesabı oluşturur.)

## Veri

- **`veritabani/`** — hazır paket (~1200 destinasyon + görseller). `KURULUM.bat` veya `scripts\VERITABANI-YUKLE.bat` ile yüklenir.
- Eski **6 il klasörü** repoda yok; gerekirse panelden **Paket Yükle** veya kendi `import_from_odev.py` akışınız.

## Manuel adımlar

```bat
cd turizm-platformu
npm install
copy .env.example .env
copy apps\api\.env.example apps\api\.env
cd packages\database
npx prisma db push
cd ..\..\destinasyon
python tools\import_veritabani_paket.py
```

## Mobil

```bat
cd turizm-platformu\apps\mobile
npm install
baslat-mobil.bat
```

## Ortam değişkenleri

`.env` dosyalarını **siz** oluşturursunuz (repoda yok). Şablon: `turizm-platformu\.env.example`  
Üretimde `JWT_SECRET`, `PII_ENCRYPTION_KEY` mutlaka değiştirin. Geliştirmede `SKIP_EMAIL_VERIFY=true` kullanılabilir.

## API ne işe yarar?

Web ve mobil, PostgreSQL’e doğrudan bağlanmaz. Giriş, destinasyon listesi, yorum, hava durumu, admin istatistikleri vb. **`/api/v1/...`** üzerinden `map-server.ts` ile sunulur. Vite (5173), istekleri geliştirmede 3000’e proxy eder.

## Lisans / şartname

`ödev.txt`, `master-prompt.md` — proje gereksinimleri.
