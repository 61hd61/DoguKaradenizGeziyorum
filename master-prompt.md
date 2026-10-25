# Master Prompt: Turizm Destinasyonları Web & Mobil Uygulaması

## Proje Genel Bakış
Trabzon, Giresun, Ordu, Gümüşhane, Rize ve Artvin illerindeki turizm destinasyonları için hem web hem de mobilde çalışan, PostgreSQL veritabanı kullanan, gerçek zamanlı senkronizasyon sağlayan kapsamlı bir turizm platformu geliştirilmesi.

---

## 📁 Veri Kaynağı ve Veritabanı

### Kaynak Veriler
- **Konum**: `ödev/` klasörü altındaki destinasyon klasörleri
- **İller**: Trabzon, Giresun, Ordu, Gümüşhane, Rize, Artvin
- **Veri Formatları**: 
  - Metin dosyaları (`.docx`) - Destinasyon açıklamaları
  - Koordinat dosyaları (`.docx`) - GPS koordinatları
  - Görseller (`.jpg`) - Destinasyon fotoğrafları
  - CSV/Excel dosyaları - Yapılandırılmış veriler

### Veritabanı Gereksinimleri
- **PostgreSQL** ana veritabanı
- **Gerçek zamanlı senkronizasyon**: Veritabanında değişiklik yapıldığında sistem otomatik güncellenmeli
- **Migrasyon**: Mevcut dosya verileri veritabanına aktarılmalı
- **İndeksleme**: Hızlı arama ve filtreleme için uygun indeksler

---

## 🏗️ Sistem Mimarisi

### Backend (Yönetici Paneli)
- **RESTful API** veya **GraphQL** endpoint'leri
- **Gerçek zamanlı updates**: WebSocket / Server-Sent Events
- **Admin Dashboard** özellikleri:

#### Yönetici Paneli Modülleri
1. **Destinasyon Yönetimi**
   - CRUD işlemleri
   - Toplu içe/dışa aktarma
   - Görsel yönetimi

2. **Kullanıcı Analitiği**
   - Yeni kayıt olan kullanıcıların gösterimi
   - Kullanıcı aktivite logları
   - **Şifreler kriptolu (hashlenmiş) görüntülenmeli** - Admin asla düz metin şifre göremez

3. **Etkileşim Panelleri**
   - Yorumlar yönetimi (onay/red/sil)
   - Beğeni istatistikleri
   - Tıklama oranları (CTR) analizi
   - En çok kullanılan tur güzergahları sorguları

4. **Kullanıcı Veritabanı Erişimi**
   - Kullanıcılar **ayrı bir veritabanında** tutulmalı
   - Admin panelinden bu veritabanına erişim olmalı
   - Kişisel sayfa bilgileri şifreli (encrypted) tutulmalı - Admin göremez

---

### Frontend (Kullanıcı Uygulaması)

#### 🌍 Çoklu Dil Desteği
- **Desteklenen Diller**: Türkçe, İngilizce, Rusça, Arapça, Almanca
- **Otomatik Çeviri**: Entegrasyon (Google Translate API / LibreTranslate / vb.)
- **Otomatik Dil Algılama**: Cihaz/browser diline göre varsayılan dil seçimi
- **Manuel Dil Değiştirme**: Kullanıcı her an değiştirebilmeli

#### 🔐 Kimlik Doğrulama Sistemi

##### Kayıt Ol
| Alan | Zorunlu | Notlar |
|------|---------|--------|
| Ad | ✅ | |
| Soyad | ✅ | |
| Kullanıcı Adı | ✅ | `@` sembolü ile başlayan format (@kullaniciadi) |
| E-posta | ✅ | Benzersiz, doğrulanmalı |
| Şifre | ✅ | Güçlülük kontrolü |
| Şifre Tekrar | ✅ | Eşleşme kontrolü |
| Profil Fotoğrafı | ❌ | Kamera / Galeri seçeneği |

**Kayıt Akışı**: Form gönderimi → E-posta doğrulama linki → Link tıklanarak hesap aktivasyonu

##### Giriş Yap
- **Giriş Yöntemi**: E-posta **VEYA** Kullanıcı Adı (@ ile)
- **Şifre**: Hash doğrulama
- **Unuttum Akışı**:
  1. "Şifremi/Kullanıcı Adımı Unuttum" tıklanır
  2. Kayıtlı e-posta istenir
  3. E-posta sistemde varsa: Sıfırlama linki gönderilir
  4. E-posta yoksa: "Kullanıcı bulunamadı" mesajı

#### 🗺️ Ana Ekran - Harita Modülü (Leaflet)

##### Harita Özellikleri
- **Leaflet.js** tabanlı
- **Harita Katman Seçimi**: Kullanıcı farklı harita stilleri seçebilmeli (OSM, Satellite, Topo, vb.)
- **Konum Butonu**: Kullanıcının mevcut konumunu gösterme (GPS izni ile)

##### Filtreleme Sistemi (Harita Üst Bar)
| Filtre Türü | Açıklama |
|-------------|----------|
| Türe Göre | Kategori bazlı (Müze, Göl, Şelale, Kale, Milli Park, vb.) |
| Ada Göre | Destinasyon ismine göre arama |
| İle Göre | İl/İlçe bazlı filtreleme |
| Yakınımda | Mevcut konuma göre yarıçap filtresi (5km, 10km, 25km, 50km) |

##### Destinasyon Detay Bottom Sheet / Modal
Seçilen destinasyon için:
- **Bilgi Kartı**: Açıklama, fotoğraflar, koordinatlar, çalışma saatleri, vb.
- **Tur'a Ekle** butonu
- **Puanla** (1-5 yıldız)
- **Yorum Yap** butonu

##### Yorum Sistemi
```
Yorum Yap → Kategori Seçimi → Yorum Metni
Kategoriler: 
  - Aile ile
  - Yetişkin ile  
  - Yalnız
  - Arkadaşlarla (ek öneri)
```
- Yorumlarda **Beğen** butonu
- Yorum filtreleme (Tümü, Aile, Yetişkin, Yalnız)

#### 🧭 Tur Planlama Modülü

##### Tur Seçimi İkonu (Header/FAB)
- Sepet mantığıyla çalışır
- İkon üzerinde **seçili destinasyon sayısı** rozeti

##### Tur Oluşturma Ekranı (İkon tıklandığında)
**Liste Görünümü**: Eklenen destinasyonlar (sıralama, silme özelliği ile)

**İki Ana Aksiyon Butonu**:
1. **🗺️ Rota Çiz** - Seçilen destinasyonları harita üzerinde rota olarak çizer
2. **💡 Tur Öner** - Akıllı tur planı oluşturur

##### Tur Öneri Sihirbazı (Adım Adım)
| Adım | Soru | Seçenekler |
|------|------|------------|
| 1 | Seyahat Başlangıç Tarihi | Date picker |
| 2 | Seyahat Bitiş Tarihi | Date picker |
| 3 | Katılımcılar | Yalnız / Aile / Arkadaşlar |
| 4 | Ulaşım Aracı | Otomobil / Otobüs / Toplu Taşıma / Bisiklet / Yaya |
| 5 | Destinasyon Tercihleri | Çoklu seçim (Doğa, Tarih, Müzeler, Şelaleler, Göller, Kültür, vb.) |

**Sonuç**: "Tur Oluştur" butonuna basıldığında:
- Uygun destinasyonlar güzergah olarak planlanır
- **Birden fazla alternatif rota** sunulur
- **En çok tercih edilen güzergahlar** önerilir
- **Hava Durumuna Göre Çanta Önerisi**: Seçilen tarihler için hava durumu API'si ile kontrol → Giysi/eşya önerileri

#### 🗺️ Haritalar Sayfası
- **Tür Bazlı Simgeler**: Her kategori için özel marker ikonu
- **Marker Tıklama**: Doğrudan destinasyon detay sayfasına yönlendirme
- **Kümeleme (Clustering)**: Yoğun bölgelerde marker kümeleme

#### 👤 Kişisel Sayfa / Blog Sistemi
- **Blog Formatında**: Hatıralar, fotoğraflar, görüşler, seyahat notları
- **Takip Sistemi**: 
  - Başka kullanıcılar profili takip edebilir
  - "Bu blog **X** kişi tarafından takip ediliyor" gösterimi
  - Takipçilere yeni yayın bildirimi (Push / E-posta / In-app)

#### 🌤️ Hava Durumu Entegrasyonu
- **Sistem Rengi**: Hava durumuna göre dinamik tema değişimi
  - Güneşli → Sıcak tonlar (Turuncu/Sarı)
  - Yağmurlu → Soğuk tonlar (Mavi/Gri)
  - Karlı → Beyaz/Açık Mavi
  - Bulutlu → Nötr tonlar
- **Hava Durumu Widget'ı**: Ekranın bir köşesinde güncel hava durumu

#### 📱 PWA / Offline Desteği
- **Progressive Web App** standartlarında
- **Service Worker** ile offline çalışma
- **Install Prompt**: "Uygulamayı Ekrana Ekle" banner'ı
- **Cache Stratejisi**: 
  - Static assets (CSS, JS, Images) → Cache First
  - API verileri → Network First + Fallback
  - Harita tile'ları → Stale While Revalidate
- **IndexedDB**: Offline yorum/puan kaydetme → Online olduğunda senkronizasyon

#### ⚡ Performans & UX
- **Sayfa Geçişleri**: Hızlı, animasyonlu (View Transitions API / SPA routing)
- **Lazy Loading**: Görseller, harita bileşenleri
- **Skeleton Loaders**: Veri yüklenirken iskelet ekranlar
- **Optimistic UI**: Beğeni, yorum, tur ekleme anında UI güncellenir

---

## 🔧 Teknik Stack Önerileri

### Backend
| Bileşen | Teknoloji | Sebep |
|---------|-----------|-------|
| Runtime | Node.js (Express/Fastify) veya Go | Performans, ekosistem |
| Veritabanı | PostgreSQL + PostGIS | Coğrafi sorgular, JSONB |
| ORM | Prisma / Drizzle / TypeORM | Type safety |
| Real-time | Socket.io / Supabase Realtime | Anlık güncellemeler |
| Auth | JWT + Refresh Token + bcrypt/argon2 | Güvenlik |
| File Storage | S3 / MinIO / Supabase Storage | Görsel yönetimi |
| Cache | Redis | Session, rate limiting, cache |

### Frontend
| Bileşen | Teknoloji | Sebep |
|---------|-----------|-------|
| Framework | React (Vite) / Next.js / Vue 3 | Modern, performanslı |
| State | Zustand / Redux Toolkit / Pinia | Basit, ölçeklenebilir |
| Routing | React Router / Vue Router / TanStack Router | SPA navigasyon |
| Harita | Leaflet + React-Leaflet / MapLibre GL | Açık kaynak, esnek |
| UI Kit | Tailwind CSS + Shadcn/UI / Material 3 | Hızlı geliştirme |
| i18n | i18next / vue-i18n | Çoklu dil |
| PWA | Vite PWA Plugin / next-pwa | Offline, installable |
| Forms | React Hook Form + Zod / VeeValidate | Validasyon |

### DevOps & Deployment
- **Container**: Docker + Docker Compose
- **CI/CD**: GitHub Actions / GitLab CI
- **Hosting**: Vercel / Netlify (Frontend), Railway / Render / VPS (Backend)
- **Monitoring**: Sentry, LogRocket, Prometheus + Grafana

---

## 🗂️ Veritabanı Şeması (Özet)

```sql
-- Ana Tablolar
users (id, username, email, password_hash, avatar_url, created_at, updated_at)
user_profiles (user_id, first_name, last_name, bio, encrypted_data, preferences)
destinations (id, name, slug, description, type, province, district, lat, lon, images[], metadata, created_at, updated_at)
destination_translations (destination_id, lang_code, name, description)

-- Etkileşim
reviews (id, user_id, destination_id, category, content, rating, created_at)
review_likes (review_id, user_id)
favorites (user_id, destination_id)
clicks (destination_id, user_id, timestamp)

-- Tur Sistemi
user_tours (id, user_id, name, start_date, end_date, participants, vehicle, preferences, status)
tour_destinations (tour_id, destination_id, order_index, duration_minutes)
popular_routes (id, name, destination_ids[], usage_count, avg_rating)

-- Blog / Sosyal
posts (id, user_id, title, content, images[], visibility, created_at)
followers (follower_id, following_id)
notifications (id, user_id, type, reference_id, read, created_at)

-- Admin
admin_users (id, email, password_hash, role, permissions)
audit_logs (id, admin_id, action, entity_type, entity_id, old_data, new_data, timestamp)
```

---

## 🚀 Geliştirme Aşamaları (Roadmap)

### Phase 1: Foundation (Hafta 1-2)
- [ ] Proje iskeleti (Monorepo: apps/web, apps/admin, packages/shared)
- [ ] PostgreSQL + PostGIS kurulumu, migration'lar
- [ ] Temel Auth (Kayıt, Giriş, JWT, Email doğrulama, Şifre sıfırlama)
- [ ] Veri import scriptleri (ödev/ klasöründen → DB)

### Phase 2: Core Features (Hafta 3-5)
- [ ] Destinasyon CRUD (Admin + Public API)
- [ ] Leaflet harita entegrasyonu + filtreler
- [ ] Destinasyon detay, puanlama, yorum sistemi
- [ ] Çoklu dil (i18n) altyapısı + 6 dil çevirisi

### Phase 3: Tur Planlama (Hafta 6-8)
- [ ] Tur sepeti / seçim sistemi
- [ ] Rota çizme (Leaflet Routing Machine / OSRM)
- [ ] Akıllı tur öneri algoritması
- [ ] Hava durumu API entegrasyonu + çanta önerisi

### Phase 4: Sosyal & Blog (Hafta 9-10)
- [ ] Kullanıcı profilleri + Blog sistemi
- [ ] Takip / Bildirim sistemi
- [ ] Admin analitik dashboard

### Phase 5: Polish & PWA (Hafta 11-12)
- [ ] PWA yapılandırması + Offline destek
- [ ] Performans optimizasyonu
- [ ] Hava durumuna göre dinamik tema
- [ ] Testler (Unit, E2E, Load)
- [ ] Deploy & Dokümantasyon

---

## 🔐 Güvenlik Kontrol Listesi
- [ ] Şifreler: Argon2id ile hash, asla loglanmamalı
- [ ] JWT: Kısa ömürlü access token (15dk), uzun ömürlü refresh token (30g) httpOnly cookie'de
- [ ] Rate Limiting: Auth endpoint'lerinde (5 req/dk), API'de (100 req/dk)
- [ ] CORS: Sadece izinli origin'ler
- [ ] Input Validation: Zod / Joi ile tüm girişler doğrulanmalı
- [ ] SQL Injection: ORM/Parameterized queries
- [ ] XSS: Content Security Policy, output encoding
- [ ] File Upload: Tip/boity kontrolü, virus tarama, CDN üzerinden serve
- [ ] PII: Kullanıcı verileri şifreli (AES-256) tutulmalı, admin göremez
- [ ] Audit Log: Admin tüm hassas işlemlerde log bırakmalı

---

## 📋 Kabul Kriterleri (Definition of Done)

| Özellik | Kriter |
|---------|--------|
| Veri İçe Aktarma | ödev/ klasöründeki tüm veriler DB'ye aktarılmış, arama çalışıyor |
| Gerçek Zamanlı Sync | Admin panelinde destinasyon güncellendiğinde kullanıcı sayfasında 3sn içinde yansımış |
| Çoklu Dil | 6 dilde UI + içerik çevirisi, cihaz dili algılanıyor |
| Auth | Kayıt/Giriş/Şifre sıfırlama akışları uç ucu çalışıyor, şifreler hashlenmiş |
| Harita | Leaflet yükleniyor, filtreler çalışıyor, marker tıklama detaya gidiyor |
| Tur Planlama | Seçim → Rota çizme / Tur önerme çalışıyor, alternatif rotalar sunuluyor |
| Blog/Sosyal | Yazı yazma, takip etme, bildirim gitme çalışıyor |
| PWA | "Uygulamayı yükle" çıkıyor, offline açılıyor, cache'li veri görünüyor |
| Hava Durumu Tema | Hava durumuna göre renk paleti değişiyor, widget görünüyor |
| Admin Panel | Tüm modüller erişilebilir, şifreler kriptolu, ayrı user DB'sine erişim var |

---

## 📝 Notlar ve İpuçları

1. **Veri Temizleme**: ödev/ klasöründeki docx dosyaları parse edilirken metin temizliği (boş satırlar, özel karakterler) yapılmalı
2. **Koordinat Doğrulama**: Koordinat docx'lerden okunurken WGS84 formatında olduğundan emin olunmalı
3. **Görsel Optimizasyonu**: Yüklenen görseller WebP'e dönüştürülmeli, responsive boyutlar oluşturulmalı (thumbnail, medium, large)
4. **Arama**: PostgreSQL Full Text Search + Trigram (pg_trgm) ile fuzzy search
5. **Rota Hesaplama**: OSRM (Open Source Routing Machine) self-hosted veya Valhalla önerilir - ücretsiz, sınırsız
6. **Hava Durumu**: Open-Meteo (ücretsiz, API key'siz) veya OpenWeatherMap
7. **Çeviri**: LibreTranslate self-hosted (ücretsiz) veya Google Cloud Translate (ücretli)
8. **Bildirimler**: Web Push API (VAPID keys) + Service Worker

---

*Bu master prompt, ödev.txt içeriğinden çıkarılarak yapılandırılmış kapsamlı bir teknik spesifikasyon belgesidir. Geliştirme sürecinde bu belge referans alınmalı ve her aşamada kabul kriterleri kontrol edilmelidir.*