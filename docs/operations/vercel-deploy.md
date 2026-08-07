# Deploy StudyDate ID ke Vercel (demo stabil)

Root aplikasi: folder **`studydate-web`** (bukan monorepo root).

## 1. Prasyarat kode

- [ ] Migration `202608070001_create_api_rate_limits_v1` applied ke Supabase `ctbqudtvrfezuoqcecyj`
- [ ] `STUDENT_VERIFICATION_ENABLED` tetap **bukan** `true`
- [ ] Contact Reveal key di-backup offline (lihat `owner-p1-confirmation.md`)

## 2. Buat project Vercel

1. Import repo GitHub `StudyDate`
2. **Root Directory:** `studydate-web`
3. Framework: Next.js (otomatis)
4. Build Command: `npm run build` (default)
5. Install Command: `npm install`
6. Node: 22.x jika tersedia

## 3. Environment variables (Production)

Salin ke Vercel → Settings → Environment Variables. **Jangan** commit nilai rahasia.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=https://studydate.id
# Preview/demo sementara boleh: https://YOUR-PROJECT.vercel.app

SUPABASE_SERVICE_ROLE_KEY=
CONTACT_REVEAL_ENCRYPTION_KEY=
CONTACT_REVEAL_KEY_VERSION=1

STUDYDATE_EMAIL_FROM="StudyDate ID <studydateid@gmail.com>"
STUDYDATE_SMTP_HOST=smtp.gmail.com
STUDYDATE_SMTP_PORT=587
STUDYDATE_SMTP_SECURE=false
STUDYDATE_SMTP_USER=studydateid@gmail.com
STUDYDATE_SMTP_PASSWORD=
# ATAU ganti SMTP dengan:
# STUDYDATE_RESEND_API_KEY=

STUDENT_VERIFICATION_ENABLED=false
```

Optional verification keys may remain set while Verification stays disabled.

## 4. Supabase Auth (wajib)

Authentication → URL configuration:

- **Site URL** = nilai `NEXT_PUBLIC_SITE_URL` (production)
- **Redirect URLs** include:
  - `https://studydate.id/auth/callback`
  - `https://studydate.id/auth/confirm`
  - (jika pakai preview) `https://*.vercel.app/auth/callback` dan `.../auth/confirm`

Jangan andalkan Supabase Auth mailer untuk magic link produk.

## 5. Domain

1. Vercel → Domains → `studydate.id` (+ `www` redirect jika perlu)
2. DNS sesuai instruksi Vercel
3. Setelah HTTPS hidup, pastikan `NEXT_PUBLIC_SITE_URL` = `https://studydate.id` lalu redeploy

## 6. Smoke setelah deploy

1. `https://YOUR_ORIGIN/` landing + footer legal
2. `/privacy` publik (tanpa login)
3. Early Access submit (honeypot kosong)
4. `/login` → email StudyDate ID masuk → `/auth/confirm` → `/app` atau onboarding
5. Owner: `/staff/login` → `/owner/moderation`
6. Response headers berisi `X-Content-Type-Options: nosniff` dan `X-Frame-Options: DENY`

## 7. Stabilitas demo (sudah di kode)

| Kontrol | Perilaku |
|---------|----------|
| Early Access RL | 5 / 10 menit per IP (Postgres) |
| Magic link student | 8 / 15 menit per IP + 3 / jam per email |
| Magic link staff | 5 / 15 menit per IP + 3 / jam per email |
| Intro / chat | Rate limit RPC existing |
| Security headers | nosniff, frame deny, referrer, permissions-policy |
| `X-Powered-By` | dimatikan |

**Cohort demo:** tetap undang terbatas. Jangan blast marketing massal sebelum minggu-1 ops review.

## 8. Yang Owner masih isi manual

1. `STUDYDATE_SMTP_PASSWORD` (Gmail App Password) di Vercel
2. Semua secret Supabase + Contact Reveal key di Vercel
3. Domain DNS + Auth redirect
4. Deploy production dari branch `main`

Upstash Redis **tidak** wajib; rate limit memakai tabel Supabase.
