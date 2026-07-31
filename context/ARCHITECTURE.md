# StudyDate ID — Architecture

## 1. Current stack

Periksa `package.json` sebelum bekerja. Arsitektur saat ini menggunakan Next.js 16.2.12 App Router, React 19.2.8,
TypeScript, Tailwind CSS 3.4.1, `@supabase/ssr` 0.12.4, `@supabase/supabase-js` 2.111.0, Zod 4.4.3,
existing accessible UI primitives, Route Handlers, dan Server Actions.

Jangan menambahkan framework auth lain.

## 2. High-level architecture

```text
Browser
  -> Next.js App Router
       -> Public UI: landing page + Early Access dialog
       -> Public handler: /api/early-access
       -> Auth: /login, /auth/callback
       -> Protected: /onboarding, /app
       -> Server handlers/actions
  -> Supabase Auth + PostgreSQL + RLS + RPC
```

## 3. Trust boundaries

Browser tidak dipercaya untuk authorization, protected fields, target user ID, verification status, discoverability,
alias, consent timestamp, atau database role.

Next.js server bertanggung jawab untuk route protection, safe redirect, session verification, validation, generic
errors, payload limits, dan service-role operation yang terbatas.

Supabase bertanggung jawab untuk session, RLS, constraints, uniqueness, grants, dan atomic onboarding transaction.

## 4. Environment variables

Browser-visible:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

Server-only:
- `SUPABASE_SERVICE_ROLE_KEY`
- `STUDENT_VERIFICATION_ENCRYPTION_KEY`
- `STUDENT_VERIFICATION_HMAC_KEY`
- optional campus-email delivery webhook URL dan token.

Jangan mengimpor service-role client ke Client Component.

## 5. Authentication flow

```text
/login
 -> POST /api/auth/magic-link
 -> Supabase signInWithOtp
 -> email link
 -> /auth/callback
 -> exchange PKCE code
 -> verified session
 -> incomplete: /onboarding
 -> complete: /app
```

Redirect target harus masuk allowlist internal.

## 6. Route protection

Middleware/proxy menyegarkan session dan melakukan redirect dasar. Protected Server Components wajib memanggil server
auth kembali dan mengecek onboarding state.

Expected:
- unauthenticated `/app` -> `/login`;
- unauthenticated `/onboarding` -> `/login`;
- onboarded `/login` -> `/app`;
- onboarded `/onboarding` -> `/app`;
- incomplete `/app` -> `/onboarding`.

## 7. Onboarding architecture

Client menampilkan multi-step form dan mengirim final payload.

Server mengautentikasi, melakukan strict validation, menolak protected fields, memanggil atomic RPC, dan redirect
setelah commit.

`lib/onboarding/service.ts` membuat alias secara server-side dengan `crypto.randomInt()` dan collision retry.
RPC menerima alias tersebut, mengambil target user dari `auth.uid()`, menyimpan profile, preferences, dan tiga consent
secara atomik, lalu rollback bila gagal.

## 8. Early Access architecture

```text
CTA source
 -> accessible dialog
 -> POST /api/early-access
 -> payload limit + honeypot + rate limit
 -> validation + normalization
 -> server-only Supabase insert
```

Duplicate memakai friendly success-like state. Current rate limit per-instance harus diganti durable rate limiting
sebelum traffic besar.

Implementasi berada di `components/marketing/early-access-dialog.tsx`, `app/api/early-access/route.ts`, dan
`lib/early-access/`.

## 9. Database access model

Normal authenticated client boleh membaca profile sendiri, mengubah editable fields sendiri, membaca/mengubah
preferences sendiri, dan membaca consent sendiri.

Normal client tidak boleh membaca profile privat user lain, mengubah alias, verification, discoverability, atau consent
timestamp.

Service role hanya untuk operasi server yang jelas, bukan pengganti RLS seluruh aplikasi.

## 10. Student Verification architecture

```text
/app/verification
 -> authenticated Route Handler
 -> strict validation + payload/rate limits
 -> AES-256-GCM encryption + keyed HMAC fingerprint
 -> service-only transactional RPC
 -> private request status
 -> manual PDDikti review + ownership review
 -> controlled profile verification update
```

Trust boundaries:
- browser tidak pernah memilih hasil review atau target user;
- NIM dan nama legal dienkripsi sebelum masuk database;
- fingerprint NIM memakai HMAC key terpisah;
- email kampus harus cocok dengan domain berstatus `approved`, bukan sekadar suffix `.ac.id`;
- kode email disimpan sebagai keyed hash dengan expiry, attempt limit, dan resend cooldown;
- kartu mahasiswa berada di bucket privat, diakses reviewer melalui signed URL lima menit, dan dijadwalkan dihapus;
- keputusan review dan update `profiles.verification_status` dilakukan dalam satu RPC service-role dengan audit event
  tersanitasi.

`StudentRegistryVerifier` memisahkan result model dari sumber registry. Implementasi saat ini manual dan mengembalikan
`unavailable` sampai reviewer memasukkan hasil. Adapter API resmi adalah Future dan tidak boleh memakai scraping,
endpoint tidak terdokumentasi, atau kredensial palsu.

Operasional manual memerlukan reviewer dengan `app_metadata.verification_reviewer = true`, domain kampus berstatus
`approved`, delivery webhook email server-to-server, dan job terjadwal yang memanggil evidence cleanup service. Tidak
ada public admin route atau dashboard pada fase ini.

## 11. Future People architecture

People discovery tidak boleh melakukan broad select pada `profiles`.

Gunakan dedicated privacy-safe view, RPC, atau server projection yang hanya mengeluarkan field publik yang disetujui.

## 12. Future conversations

Entities yang direncanakan: introductions, conversations, messages, reveal requests, blocks, reports.

Anonymous messages memakai internal StudyDate identity, bukan metadata Telegram atau email.

## 13. Future Telegram architecture

Bot adalah companion untuk notification, short reply, reminder, check-in, safety action, dan Mini App deep link.
Website/Mini App tetap source of truth untuk discovery, full profile, group/event management, privacy settings, dan
report detail.

Bot harus mengirim message baru dari server, bukan forward message user.

## 14. Logging

Jangan log email, PII body, token, OTP, magic link, cookie, service-role key, atau private profile content.

Gunakan request ID, sanitized result category, status code, duration, dan non-identifying metrics.

## 15. Failure handling

- Jangan tampilkan raw Supabase error.
- Jangan fake success saat database gagal.
- Onboarding tidak boleh partial.
- Auth failure memakai generic message.
- Missing environment menghasilkan generic unavailable response.

## 16. Production gates

Sebelum production:
- dedicated Supabase project verified;
- migrations applied in order;
- live magic-link dan PKCE test;
- RLS two-account test;
- RPC rollback test;
- refresh/sign-out cookie test;
- waitlist insert/duplicate test;
- durable rate limiting;
- production Site URL dan callback allowlist;
- security headers dan monitoring tanpa PII.
