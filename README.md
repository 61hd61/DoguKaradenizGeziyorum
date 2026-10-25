# Karadeniz Turizm Platformu (GitHub paketi)

Bu klasör, projeyi GitHub’a yükleyip başka bir bilgisayarda çalıştırmak için hazırlanmış **tam kaynak paketidir**.

## İçerik

| Klasör / dosya | Açıklama |
|----------------|----------|
| `turizm-platformu/` | Web (React), API (Fastify), mobil (Expo) monorepo |
| `destinasyon/` | Masaüstü veri yönetim paneli (Python) |
| `veritabani/` | Taşınabilir JSON/SQLite + görseller paketi |
| `trabzon`, `giresun`, … | İl kaynak verileri (import için) |
| `TUMUNU-BASLAT.bat` | API + web + panel birlikte |
| `docker-compose.yml` | İsteğe bağlı PostgreSQL |

## Gereksinimler

- **Node.js 20+**
- **PostgreSQL 14+** (veya `docker compose up -d`)
- **Python 3.10+** (masaüstü panel ve `--import` için)
- Windows: `.bat` dosyaları; macOS/Linux: komutları README altından uyarlayın

## Hızlı başlangıç (Windows)

1. PostgreSQL’de veritabanları:
   - `trabzon_turizm`
   - `trabzon_turizm_users`  
   → `KULLANICI-VERITABANI-OLUSTUR.bat` veya Docker `scripts/init-databases.sql`

2. Ortam dosyası ( **siz oluşturursunuz** — bkz. `GITHUB-EKSTRA-DOSYALAR.md` ):
   ```text
   copy turizm-platformu\.env.example turizm-platformu\.env
   copy turizm-platformu\apps\api\.env.example turizm-platformu\apps\api\.env
   ```
   `JWT_SECRET` ve `PII_ENCRYPTION_KEY` değerlerini mutlaka değiştirin.

3. Bağımlılıklar:
   ```bat
   cd turizm-platformu
   npm install
   cd apps\web
   npm install
   cd ..\api
   npm install
   ```

4. Veritabanı şeması: Prisma push (ilk kurulum):
   ```bat
   cd turizm-platformu\packages\database
   npx prisma db push
   ```

5. Veri aktarımı (isteğe bağlı, 6 il):
   ```bat
   cd destinasyon
   baslat.bat --import
   ```

6. Çalıştır:
   ```bat
   TUMUNU-BASLAT.bat
   ```
   - Harita: http://localhost:5173  
   - Admin: http://localhost:5173/admin (`admin@turizm.local` / `admin123`)  
   - API: http://localhost:3000/health  

## GitHub’a yükleme

Depo **kökü** bu `github` klasörünün içeriği olmalı (klasörün kendisi değil, içindekiler):

```bat
cd C:\...\ödev\github
git init
git add .
git commit -m "Karadeniz turizm platformu"
git branch -M main
git remote add origin https://github.com/KULLANICI/REPO.git
git push -u origin main
```

> **Not:** `.env` dosyaları `.gitignore` ile yüklenmez. GitHub Secrets veya sunucuda elle oluşturulur.

## Mobil (Expo)

```bat
cd turizm-platformu\apps\mobile
npm install
baslat-mobil.bat
```

## Docker ile sadece PostgreSQL

```bat
docker compose up -d
```

Ardından şema + import adımlarını yapın.

## Dokümantasyon

- `ödev.txt`, `master-prompt.md` — proje şartnamesi
- `GITHUB-EKSTRA-DOSYALAR.md` — GitHub’da **sizin yazmanız gereken** dosyalar
