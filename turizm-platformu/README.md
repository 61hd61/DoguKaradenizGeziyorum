# Turizm Platformu - Karadeniz Turizm Destinasyonları Platformu

Karadeniz bölgesi (Trabzon, Giresun, Ordu, Gümüşhane, Rize, Artvin) turizm destinasyonları için geliştirilmiş full-stack web ve mobil uygulaması.

## 🚀 Teknoloji Stack

### Backend (API)
- **Runtime**: Node.js 20+ (Fastify)
- **Language**: TypeScript
- **Database**: PostgreSQL 16 + PostGIS
- **ORM**: Prisma
- **Auth**: JWT + Argon2id + Refresh Tokens (httpOnly cookies)
- **Email**: Nodemailer (SMTP)
- **Validation**: Zod
- **Rate Limiting**: @fastify/rate-limit
- **Docs**: Swagger/OpenAPI

### Frontend (Web) - Phase 2
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS + Shadcn/UI
- **State**: Zustand
- **Routing**: TanStack Router
- **Maps**: Leaflet + React-Leaflet
- **i18n**: i18next
- **PWA**: Vite PWA Plugin

### Infrastructure
- **Container**: Docker + Docker Compose
- **Cache**: Redis
- **Email Dev**: Mailhog
- **Translation**: LibreTranslate (optional)

## 📁 Proje Yapısı

```
turizm-platformu/
├── apps/
│   ├── api/                 # Backend API (Fastify)
│   └── web/                 # Frontend (React) - Phase 2
├── packages/
│   ├── shared/              # Shared types, schemas, utils
│   └── database/            # Prisma schema + migrations
├── docker-compose.yml       # Development services
├── init.sql                 # PostgreSQL init script
├── .env.example             # Environment template
├── package.json             # Root workspace config
└── turbo.json               # Turborepo config
```

## 🛠️ Kurulum

### 1. Ön Koşullar
- Node.js 20+
- Docker & Docker Compose
- pnpm (veya npm/yarn)

### 2. Bağımlılıkları Yükle
```bash
# Root
npm install

# Veya pnpm ile (önerilen)
pnpm install
```

### 3. Environment Dosyası
```bash
cp .env.example .env
# .env dosyasını düzenleyin
```

### 4. Veritabanını Başlat
```bash
# Docker ile PostgreSQL + Redis + Mailhog
docker-compose up -d

# Veritabanı hazır olana kadar bekleyin (5-10 sn)
```

### 5. Prisma Kurulum
```bash
# Prisma client generate
npm run db:generate

# Veritabanı şemasını push et (development)
npm run db:push

# Veya migration ile
npm run db:migrate

# Seed data ekle
npm run db:seed
```

### 6. Geliştirme Sunucusunu Başlat
```bash
# Tüm servisleri başlat (api + web - Phase 2'de)
npm run dev

# Sadece API
npm run dev --filter=@turizm/api
```

## 📚 API Endpoints

### Auth
- `POST /api/v1/auth/register` - Kayıt ol
- `POST /api/v1/auth/login` - Giriş yap
- `POST /api/v1/auth/refresh` - Token yenile
- `POST /api/v1/auth/logout` - Çıkış yap
- `POST /api/v1/auth/verify-email` - E-posta doğrula
- `POST /api/v1/auth/forgot-password` - Şifre unuttum
- `POST /api/v1/auth/reset-password` - Şifre sıfırla
- `GET /api/v1/auth/me` - Mevcut kullanıcı
- `PATCH /api/v1/auth/me` - Profil güncelle
- `POST /api/v1/auth/change-password` - Şifre değiştir

### Destinations
- `GET /api/v1/destinations` - Listele (filtreler: search, provinceId, typeId, lat/lon/radius)
- `GET /api/v1/destinations/featured` - Öne çıkanlar
- `GET /api/v1/destinations/nearby` - Yakınımdakiler
- `GET /api/v1/destinations/slug/:slug` - Slug ile getir
- `GET /api/v1/destinations/:id` - ID ile getir
- `POST /api/v1/destinations/:id/click` - Tıklama kaydet

**Admin:**
- `POST /api/v1/destinations` - Oluştur
- `PATCH /api/v1/destinations/:id` - Güncelle
- `DELETE /api/v1/destinations/:id` - Sil

### Reviews
- `POST /api/v1/reviews` - Yorum yap
- `GET /api/v1/reviews/destination/:destinationId` - Destinasyon yorumları
- `POST /api/v1/reviews/:id/like` - Beğen/beğenme
- `GET /api/v1/reviews/my` - Kendi yorumlarım

**Admin:**
- `GET /api/v1/reviews` - Tüm yorumlar
- `POST /api/v1/reviews/:id/moderate` - Onayla/reddet

### Tours
- `POST /api/v1/tours` - Tur oluştur
- `GET /api/v1/tours` - Turlarım
- `POST /api/v1/tours/suggest` - Akıllı tur önerisi
- `GET /api/v1/tours/popular` - Popüler rotalar
- `GET /api/v1/tours/:id` - Tur detayı
- `POST /api/v1/tours/:id/destinations` - Destinasyon ekle
- `DELETE /api/v1/tours/:id/destinations/:tid` - Destinasyon çıkar
- `PATCH /api/v1/tours/:id/destinations/reorder` - Sırala
- `GET /api/v1/tours/:id/route` - Rota hesapla

### Favorites
- `POST /api/v1/favorites/:destinationId/toggle` - Favori ekle/çıkar
- `GET /api/v1/favorites` - Favori listem
- `GET /api/v1/favorites/:destinationId/status` - Favori mi?
- `GET /api/v1/favorites/:destinationId/count` - Favori sayısı

### Blog/Social
- `POST /api/v1/blog/posts` - Yazı yaz
- `GET /api/v1/blog/posts` - Yazıları listele
- `GET /api/v1/blog/posts/:id` - Yazı detayı
- `POST /api/v1/blog/posts/:id/like` - Beğen
- `POST /api/v1/blog/posts/:postId/comments` - Yorum yap
- `POST /api/v1/blog/users/:userId/follow` - Takip et
- `DELETE /api/v1/blog/users/:userId/follow` - Takipten çık
- `GET /api/v1/blog/notifications` - Bildirimler

### Admin
- `GET /api/v1/admin/stats` - Dashboard istatistikleri
- `GET /api/v1/admin/users` - Kullanıcı listesi
- `GET /api/v1/admin/destinations` - Destinasyon listesi
- `GET /api/v1/admin/reviews` - Yorum moderasyonu
- `POST /api/v1/admin/reviews/:id/moderate` - Onayla/reddet
- `GET /api/v1/admin/analytics/clicks` - Tıklama analitiği
- `GET /api/v1/admin/audit-logs` - Denetim logları

## 🔐 Varsayılan Hesaplar

| Rol | E-posta | Şifre |
|-----|---------|-------|
| Super Admin | admin@turizm.local | admin123 |
| Test User | test@turizm.local | test1234 |

## 🛠️ Geliştirme Komutları

```bash
# Veritabanı
npm run db:generate    # Prisma client generate
npm run db:push        # Schema push (dev)
npm run db:migrate     # Migration oluştur
npm run db:studio      # Prisma Studio aç
npm run db:seed        # Seed data

# Build
npm run build          # Tüm workspace build

# Lint/Test
npm run lint           # ESLint
npm run test           # Vitest
```

## 📖 API Dokümantasyonu

Swagger UI: http://localhost:3000/docs (development)

## 🗺️ Veri İçe Aktarma

Mevcut `ödev/` klasöründeki verileri içe aktarmak için:

```bash
cd ../ödev
python import_data.py
```

Bu script PostgreSQL'e bağlanıp verileri `trabzon_destinasyonlar` tablosuna aktarır.

## 📝 Lisans

MIT License - Ödev projesi için geliştirilmiştir.

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın