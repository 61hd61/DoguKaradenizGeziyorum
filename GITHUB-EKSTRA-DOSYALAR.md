# GitHub’da sizin oluşturmanız gereken dosyalar

Aşağıdakiler repoya **commit edilmez** (güvenlik) veya GitHub arayüzünden **Secrets** olarak tanımlanır.

---

## 1. Zorunlu — yerel `.env` dosyaları

Şablonlar repoda hazır; siz **kopyalayıp doldurursunuz**:

| Oluşturacağınız dosya | Kaynak şablon |
|----------------------|---------------|
| `turizm-platformu/.env` | `turizm-platformu/.env.example` |
| `turizm-platformu/apps/api/.env` | `turizm-platformu/apps/api/.env.example` |

Minimum değiştirmeniz gereken alanlar:

```env
JWT_SECRET=...          # en az 32 karakter, rastgele
PII_ENCRYPTION_KEY=...  # profil şifreleme, rastgele 32+ byte
DATABASE_URL=...        # PostgreSQL bağlantınız
USER_DATABASE_URL=...   # ayrı kullanıcı DB
```

Geliştirme için:

```env
SKIP_EMAIL_VERIFY=true
```

Üretimde `SKIP_EMAIL_VERIFY` **kaldırın** ve SMTP doldurun.

---

## 2. İsteğe bağlı — SMTP (e-posta doğrulama / şifre sıfırlama)

`.env` içine:

```env
SMTP_HOST=smtp.ornek.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=noreply@alanadiniz.com
WEB_PUBLIC_URL=https://siteniz.com
```

SMTP yoksa API loglarında doğrulama linki görünür (sadece geliştirme).

---

## 3. GitHub Actions Secrets (CI/CD veya cloud deploy)

Repoda `.github/workflows/ci.yml` var; **secret zorunlu değil** (sadece build/typecheck).

Cloud’a deploy ederseniz GitHub → **Settings → Secrets and variables → Actions**:

| Secret adı | Açıklama |
|------------|----------|
| `DATABASE_URL` | Production PostgreSQL |
| `USER_DATABASE_URL` | Kullanıcı DB |
| `JWT_SECRET` | JWT anahtarı |
| `PII_ENCRYPTION_KEY` | PII şifreleme |

---

## 4. İsteğe bağlı — Python panel `.env`

Masaüstü panel için `destinasyon/.env` (yoksa varsayılanlar kullanılır):

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trabzon_turizm
DB_USER=postgres
DB_PASSWORD=1234
```

---

## 5. Repoda zaten olan dosyalar (tekrar yazmayın)

- `.gitignore`
- `docker-compose.yml`
- `scripts/init-databases.sql`
- `.env.example` dosyaları
- `README.md`
- Kaynak kod (`turizm-platformu`, `destinasyon`, …)

---

## 6. GitHub web arayüzünde oluşturabileceğiniz ekler

| Dosya | Ne zaman |
|-------|----------|
| `LICENSE` | Açık kaynak lisansı seçmek isterseniz |
| `CONTRIBUTING.md` | Ekip çalışması |
| `.github/dependabot.yml` | Otomatik npm güncelleme |

Örnek `LICENSE`: GitHub “Add file → Choose a license template” → MIT.

---

## 7. İlk clone sonrası kontrol listesi

- [ ] `npm install` (turizm-platformu kök)
- [ ] `.env` dosyalarını şablondan oluştur
- [ ] PostgreSQL + iki veritabanı
- [ ] `npx prisma db push` (packages/database)
- [ ] `baslat.bat --import` veya `veritabani` paketini içe aktar
- [ ] `TUMUNU-BASLAT.bat` veya `turizm-platformu/start_all.bat`
