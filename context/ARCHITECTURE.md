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
       -> Public docs: /privacy, /terms, /community-guidelines, /safety, /help
         (legacy /privasi, /ketentuan, /pedoman-komunitas, /bantuan, /keamanan redirect)
       -> Public SEO: /sitemap.xml, /robots.txt
       -> Public handler: /api/early-access
       -> Auth: /login, /staff/login, /auth/callback, /auth/confirm
       -> Protected student: /onboarding, /app, /app/people, /app/people/[alias], /app/introductions,
          /app/messages, /app/messages/[publicId], /app/circles, /app/circles/create,
          /app/circles/[publicSlug], /app/events, /app/events/create, /app/events/[publicSlug]
       -> Protected staff: /owner/**, /admin/**
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
- `STUDYDATE_EMAIL_FROM` plus either `STUDYDATE_RESEND_API_KEY` or SMTP
  (`STUDYDATE_SMTP_*`) for StudyDate-branded magic-link delivery (never Supabase Auth mailer)
- `STUDENT_VERIFICATION_ENCRYPTION_KEY`
- `STUDENT_VERIFICATION_HMAC_KEY`
- `CONTACT_REVEAL_ENCRYPTION_KEY` (AES-256-GCM; see `docs/operations/contact-reveal-key-recovery.md`)
- optional `CONTACT_REVEAL_KEY_VERSION` and `CONTACT_REVEAL_ENCRYPTION_KEY_V{n}` during rotation
- optional campus-email delivery webhook URL dan token.

Jangan mengimpor service-role client ke Client Component.

## 5. Authentication flow

```text
/login
 -> A) Google OAuth (Supabase provider) -> /auth/callback?code=…
 -> B) POST /api/auth/magic-link
      -> service-role generateLink (token only; no Supabase mailer)
      -> StudyDate SMTP/Resend email (branded StudyDate ID)
      -> /auth/confirm?token_hash=… (first-party)
 -> session cookie
 -> student email domain allowlist enforced (gmail.com, vk.com, *.ac.id, *.sch.id)
 -> incomplete: /onboarding
 -> complete: /app
```

Local app listen port and `NEXT_PUBLIC_SITE_URL` must match (default `http://localhost:3010`).
Production sets `NEXT_PUBLIC_SITE_URL` to the public HTTPS origin (domain), independent of
internal process port.

Google provider setup: `docs/operations/google-oauth-setup.md`.

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
RPC v2 menerima alias tersebut, mengambil target user dari `auth.uid()`, menyimpan profile, optional encrypted NIM
claim, preferences, dan tiga consent secara atomik, lalu rollback bila gagal. NIM tidak masuk `profiles`; Route Handler
lebih dulu mengenkripsinya dengan AES-256-GCM dan membuat keyed HMAC fingerprint.

## 8. Early Access architecture

```text
CTA source
 -> accessible dialog
 -> POST /api/early-access
 -> payload limit + honeypot + rate limit
 -> validation + normalization
 -> server-only Supabase insert
```

Duplicate memakai friendly success-like state. Rate limit memakai tabel
`api_rate_limits` + RPC `consume_api_rate_limit` (service-role) agar tahan multi-instance
Vercel; fallback in-memory hanya di non-production bila RPC belum tersedia.

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
- screenshot PDDikti memakai object path dan deletion lifecycle terpisah dari kartu mahasiswa;
- keputusan review dan update `profiles.verification_status` dilakukan dalam satu RPC service-role dengan audit event
  tersanitasi.

`StudentRegistryVerifier` memisahkan result model dari sumber registry. Implementasi saat ini manual dan mengembalikan
`unavailable` sampai reviewer memasukkan hasil. Adapter API resmi adalah Future dan tidak boleh memakai scraping,
endpoint tidak terdokumentasi, atau kredensial palsu.

Operasional manual memerlukan reviewer dengan `app_metadata.verification_reviewer = true`, domain kampus berstatus
`approved`, delivery webhook email server-to-server, dan job terjadwal yang memanggil evidence cleanup service. Tidak
ada public admin route atau dashboard pada fase ini.

## 11. People Discovery v1 architecture

People discovery tidak melakukan broad select pada `profiles`. Server Component memvalidasi query parameter dengan
Zod lalu memanggil authenticated Supabase server client.

`list_people_discovery_profiles` dan `get_people_discovery_profile` adalah `SECURITY DEFINER` RPC dengan explicit
projection, fixed `search_path`, session/onboarding guard, discovery eligibility, self-exclusion, bounded result, serta
execute grant hanya untuk `authenticated`. Detail memakai public alias dan tidak mengembalikan internal user ID.

`set_people_discovery_visibility` mengambil target hanya dari `auth.uid()` dan mengubah satu protected field milik
sendiri. Direct column update atas `is_discoverable` tetap tidak diberikan kepada client.

Belum ada block model pada repository saat ini; cross-user block exclusion menjadi syarat sebelum fitur block atau
Introduction ditambahkan.

## 12. Introduction Requests v1 architecture

```text
/app/people/[alias]
 -> eligibility RPC (alias-based)
 -> send_introduction_request(alias, message)
 -> /app/introductions (Masuk / Terkirim)
 -> accept | decline | cancel | block | report RPCs
 -> accepted -> conversation_shells(awaiting_chat, public_id)
 -> /app/messages/[publicId] Anonymous Chat v1
```

Semua mutasi memakai SECURITY DEFINER RPC dengan `search_path = ''`, target dari `auth.uid()`, dan lookup penerima
melalui `public_alias` — bukan UUID mentah dari browser. Projection list hanya mengembalikan alias counterpart,
ringkasan akademik, badge verifikasi boolean, pesan, status, dan timestamp.

Fondasi `user_blocks` dan `user_reports` privat. Block dua arah mencegah introduction baru dan menutup pending.
People Discovery di-refresh agar mengecualikan pasangan yang saling memblokir.

Kebijakan visibilitas: bila penerima menonaktifkan People setelah request masuk, peserta tetap dapat melihat request
yang sudah ada; pengiriman baru tetap membutuhkan discoverability.

## 12b. Anonymous Chat v1 architecture

```text
accepted introduction
 -> conversation_shells (public_id opaque)
 -> /app/messages list + /app/messages/[publicId]
 -> send_anonymous_message / list_conversation_messages RPCs
 -> authenticated poll /api/messages/[publicId] (~4s)
 -> end | block | report
```

Lifecycle shell: `awaiting_chat` → `active` (pesan pertama) → `ended` | `blocked`.
Pesan disimpan di `anonymous_messages` (plain text, idempotency key, read_at recipient-only).
Tidak ada grant SELECT tabel ke `authenticated` agar UUID pengirim tidak bocor lewat PostgREST; delivery v1
menggunakan polling RPC. Realtime dapat dipertimbangkan kemudian dengan projection aman.

## 12c. Mutual Interest v1 architecture

```text
active conversation (both participants have messaged)
 -> get_mutual_interest_state / select_mutual_interest / withdraw_mutual_interest
 -> conversation_mutual_interests (private per participant)
 -> mutual_interest_at set atomically on second active consent
 -> sanitized conversation_events.mutual_interest_reached
 -> UI: Kenal Lebih Jauh (no one-sided leak; no Identity Reveal)
```

Safe client projection: `eligible`, `selected_by_me`, `mutual`, `mutual_at`, `can_withdraw`.
One-sided consent is never returned to the counterpart. Withdrawal is allowed only before mutual
completion. Mutual Interest is deployed (migration `202608060004`). Identity Reveal is a separate
consent stage that may begin only after `mutual_interest_at` is set (migration `202608060005`,
applied remotely).

Migration `202608060004` is applied remotely after controlled preflight.

## 12d. Identity Reveal v1 architecture

```text
mutual_interest_at set + active conversation
 -> prepare conversation-scoped reveal profile (first name + private photo, server re-encode)
 -> get_identity_reveal_state / select_identity_reveal / withdraw_identity_reveal
 -> conversation_identity_reveal_consents (private per participant; version must match conversation)
 -> identity_revealed_at + conversation_identity_reveals snapshot atomically
 -> sanitized conversation_events.identity_revealed
 -> media proxy (no Storage path exposure)
```

Reveal profiles are conversation-scoped (`identity_reveal_profile_versions.conversation_id`),
not a reusable global identity. Preparing or replacing a profile in conversation X never
authorizes consent or media in conversation Y. Replacement invalidates only the caller's
pending consent for that conversation; the counterpart receives no prepare/replace signal.

Safe pre-completion projection: `eligible`, `has_profile`, `selected_by_me`,
`completed`, `completed_at`, `can_withdraw`.
One-sided prepare/consent is never returned to the counterpart.
Completed name projection exposes consented first names; photos stream through the
authenticated media proxy.

Post-completion access:
- `ended`: both participants retain completed first-name and photo access (conversation retention).
- `blocked` (or block row): counterpart name/photo are withheld on subsequent requests;
  own name/photo may remain; internal snapshot/audit retained; UI must not claim prior
  views or screenshots were erased.
- No new profile/consent mutation after completion.

Migration `202608060005` is applied remotely after controlled preflight.
Student Verification remains globally disabled.

## 12e. Contact Reveal v1 architecture

```text
Identity Reveal completed + active conversation
 -> prepare: Next API encrypts contact (AES-256-GCM) via service_role register_contact_reveal_version
 -> get_contact_reveal_state / select_contact_reveal / withdraw_contact_reveal
 -> conversation_contact_reveal_consents (private per participant + channel; version must match conversation + channel)
 -> conversation_contact_reveals snapshot atomically per channel
 -> sanitized conversation_events.contact_revealed (+ event_channel only)
```

Contact values are conversation-scoped (`conversation_contact_versions`), encrypted at rest,
and decrypted only in the Next.js server after service_role cipher RPCs. Pre-completion poll
exposes only safe `ContactRevealChannelState` (no counterpart prepare/consent, no ciphertext).
Channels (telegram | instagram | linkedin) complete independently.

Post-completion access:
- `ended`: both participants retain completed contacts for that channel.
- `blocked` (or block row): counterpart contact ciphertext withheld; own contact may remain;
  UI must not claim prior views were erased.
- No new prepare/consent for a completed channel; no prepare/consent after end/block.

Migration `202608060006` is applied remotely after controlled preflight.
Migration `202608060007` fixes PL/pgSQL OUT-parameter `channel` ambiguity in consent
RPCs (`#variable_conflict use_column` + constraint-based `ON CONFLICT`).

## 12f. Notifications v1 architecture

```text
trusted product transition
 -> same-transaction trigger on introduction/message/completed conversation event
 -> user_notifications (recipient + constrained type + safe path + channel only)
 -> list/count/mark RPCs derive actor from auth.uid()
 -> /api/notifications authenticated projection
 -> student bell + /app/notifications
```

Migration `202608070013` sudah diterapkan remote setelah exact dry-run hanya menampilkan
migration tersebut; migration history kemudian sinkron dan post-push dry-run kosong.
Live A/B/C audit mengonfirmasi RLS, recipient isolation, dedupe, read-state, one-sided
silence, seluruh channel Contact Reveal, blocked-history privacy, dan cleanup sintetis.
Tabel tidak memiliki direct grant untuk `anon` atau `authenticated`.
`emit_user_notification` dan seluruh trigger helper tidak executable oleh student;
dedupe key deterministik memiliki unique constraint dan tidak pernah diproyeksikan.

Perkenalan dan pesan dipicu langsung setelah row source-of-truth berhasil dimasukkan.
Mutual, Identity, dan Contact hanya dipicu dari sanitized `conversation_events` completion
yang memverifikasi timestamp/snapshot completion. Tidak ada trigger pada tabel consent,
profile preparation, contact version, withdrawal, block reason, report detail, atau
moderation notes sehingga state satu sisi tidak dapat menghasilkan notifikasi.

MESSAGE_RECEIVED v1 memakai satu row per pesan karena insert pesan sudah idempotent dan
dedupe notification mengacu pada message row. List dibatasi 20 item per halaman dengan
keyset cursor; retention cleanup lama tetap future ops sampai kebijakan durasi disetujui.
Unread count global dipoll setiap 25 detik, tidak overlap, dan polling dilewati ketika
document hidden. Chat tetap memakai polling percakapan ~4 detik yang sudah ada.

## 12g. Study Circle v1 architecture (deployed)

```text
/app/circles
 -> authenticated discovery RPC (open atau campus yang sama)
 -> /app/circles/[opaque-public-slug]
 -> direct join / leave
 -> active-member-only safe member + discussion projections
 -> optional member Introduction memakai sistem Introduction existing
```

Migration `202608090001` dan forward fix `202608090002` sudah diterapkan remote melalui
exact dry-run. Fix kedua mengganti tiga RPC yang terkena ambiguitas PL/pgSQL `circle_id`
yang ditemukan pada live audit pertama. Core tables (`study_circles`,
`study_circle_memberships`, `study_circle_messages`, `study_circle_events`, dan atomic
`study_circle_rate_limits`) RLS-enabled tanpa direct grant bagi `anon` maupun
`authenticated`. Semua projection dan mutation melalui `SECURITY DEFINER`,
`search_path = ''`, actor dari `auth.uid()`, dan opaque public slug.

V1 memakai direct join untuk Circle `open` atau `campus`; tidak ada join approval,
waitlist, private/invite Circle, atau moderator role. Owner adalah role Circle-scoped dan
bukan staff. Membership `active | left | removed`; anggota yang dikeluarkan tidak dapat
join ulang pada v1. Owner tidak dapat meninggalkan Circle, tetapi dapat mengarsipkannya.

Member projection hanya mengembalikan alias, campus, study program, semester,
interests/goals, genuine verification boolean, role Circle, dan joined timestamp. Diskusi
plain text maksimal 800 karakter hanya tersedia bagi anggota aktif, memakai idempotency key,
rate limit atomik, dan filter kontak best-effort existing. Riwayat group tetap terlihat bagi
anggota aktif yang saling memblokir; block mematikan Introduction melalui eligibility
existing dan tidak menghapus riwayat publik/grup secara diam-diam.

Report Circle/member/message memperluas `user_reports` dan Owner triage existing. Bukti
pesan berupa snapshot maksimal 280 karakter dari pesan yang benar-benar terikat ke Circle;
Owner tidak memperoleh broad member/chat access. Membership tidak pernah menulis
`conversation_shells`, Mutual Interest, Identity Reveal, atau Contact Reveal.

Notifications tidak diperluas pada v1 untuk menghindari notifikasi join/leave/message yang
bising. Student Verification tetap dinonaktifkan dan bukan syarat Circle.

Live A/B/C/D audit mengonfirmasi safe projection, direct-grant denial, owner/staff
isolation, open/campus eligibility, discussion dan report scope, block tanpa menghapus
group history, archive retention, zero automatic private-flow/Notification side effects,
authenticated UI smoke, dan cleanup sintetis lengkap. Post-deploy migration dry-run kosong.

## 12h. Campus Events v1 architecture (deployed)

```text
/app/events
 -> authenticated upcoming discovery RPC (open atau kampus yang sama)
 -> /app/events/[opaque-public-slug]
 -> atomic RSVP / cancel RSVP
 -> organizer atau RSVP going: safe attendee projection
 -> optional attendee Introduction memakai sistem Introduction existing
```

Migration `202608090003` dan forward fix `202608090004` telah diterapkan remote.
Migration tersebut menambahkan `campus_events`, `campus_event_rsvps`,
`campus_event_audit_events`, dan `campus_event_rate_limits`, serta referensi report-scoped
ke `user_reports`; forward fix menyelaraskan urutan projection RPC detail yang ditemukan
oleh audit live pertama. Seluruh tabel RLS-enabled tanpa direct grant bagi `anon` atau
`authenticated`; operasi client hanya melalui `SECURITY DEFINER`, `search_path = ''`,
actor `auth.uid()`, dan opaque public slug.

Event memakai lifecycle `scheduled | cancelled | archived`; kondisi selesai diturunkan
dari `end_at`. Input waktu lokal wajib membawa timezone allowlisted
`Asia/Jakarta | Asia/Makassar | Asia/Jayapura`, lalu PostgreSQL mengubahnya ke
`timestamptz`. Durasi dibatasi 30 menit–12 jam, mulai minimal dua jam dan maksimal 180
hari ke depan.

Venue hanya dapat memakai kategori tempat publik. Empat afirmasi keselamatan wajib true
di RPC dan disimpan sebagai satu `safety_confirmed_at`; filter teks lokasi privat menjadi
kontrol best-effort tambahan. V1 tidak memiliki venue pribadi, live location, link bebas,
file, event chat, ticketing, pembayaran, waitlist, atau check-in.

RSVP `going | cancelled` mengambil user dari sesi. Organizer otomatis menjadi RSVP
pertama. RPC RSVP mengunci row Event sebelum menghitung peserta aktif dan melakukan
upsert, sehingga percobaan bersamaan pada slot terakhir tetap tidak dapat melebihi
kapasitas. Re-RSVP setelah pembatalan sukarela diizinkan selama eligibility dan kapasitas
masih terpenuhi.

Discovery/detail hanya memproyeksikan jumlah peserta. Daftar peserta penuh hanya untuk
organizer atau RSVP `going`, memakai allowlist field People dan mengecualikan pasangan
yang saling memblokir. Introduction tetap melalui RPC eligibility existing; RSVP tidak
menulis conversation, Mutual, Identity Reveal, Contact Reveal, atau Notifications.

Organizer adalah role Event-scoped, bukan staff. Edit hanya untuk Event `scheduled` yang
masih lebih dari dua jam sebelum mulai; scope immutable dan kapasitas tidak dapat turun
di bawah RSVP aktif. Waktu, timezone, dan venue dikunci setelah RSVP `going`
non-organizer pertama karena v1 tidak mengirim notifikasi perubahan. Cancel tidak dapat
dipulihkan, mempertahankan RSVP/evidence, dan
archive hanya tersedia setelah cancel atau Event berakhir. Circle association dan
notification perubahan/cancel ditunda agar authorization dan schema v1 tetap sempit.

Live audit A/B/C/D mengonfirmasi public-place filtering, waktu/timezone, open/campus
eligibility, RSVP idempotency dan exact final-slot concurrency, safe detail/attendee
projection, block/Introduction integration, report scope, organizer/staff isolation,
cancel/archive retention, direct-table denial, zero automatic private-flow/Event
Notification side effects, authenticated UI smoke, dan cleanup sintetis lengkap.
Post-deploy migration dry-run kosong.

## 13. Staff authorization v1

StudyDate memakai satu Supabase Auth untuk Student, Admin, dan Owner. `auth.users.app_metadata` memberi coarse trusted
claim, sedangkan `staff_members` menjadi authoritative active membership. Server dan database gagal tertutup bila role,
reviewer flag, atau active state tidak sama. `user_metadata` tidak pernah memberi staff access.

```text
/staff/login
 -> passwordless PKCE, shouldCreateUser=false
 -> /auth/callback?next=/staff
 -> server resolves app_metadata + staff_members
 -> Owner: /owner
 -> Admin reviewer: /admin/verifications
 -> Non-staff: /app
```

Setiap `/owner/**` memakai `requireOwner`; setiap verification admin page/action/API memakai
`requireVerificationReviewer`. Middleware hanya memberi redirect awal dan bukan authorization utama. Student navigation
dan staff navigation dirender terpisah dari server-derived role.

Role management menggunakan controlled RPC yang mengecek owner pada claim dan database, memvalidasi target Auth UUID,
memperbarui `auth.users.raw_app_meta_data`, `staff_members`, People visibility, serta audit event dalam satu transaksi.
Inactive row segera menggagalkan access meski browser masih memegang token lama. Promosi/reactivation membutuhkan
refresh session atau login ulang agar claim baru tersedia.

Owner pertama disiapkan melalui `npm run staff:bootstrap-owner`. Trusted operator memasukkan email secara interaktif;
script mencari tepat satu existing Auth user, menampilkan hanya masked email dan UUID suffix, meminta confirmation, lalu
memanggil service-role-only UUID RPC. Email tidak disimpan pada source atau authorization check. Jalankan hanya setelah
migration diterapkan dan jangan gunakan endpoint publik.

## 14. Future conversations

Entities lanjutan: reveal requests. Anonymous Chat v1 sudah menyediakan `anonymous_messages`,
`conversation_events`, lifecycle shell, serta RPC pesan.

## 15. Future Telegram architecture

Bot adalah companion untuk notification, short reply, reminder, check-in, safety action, dan Mini App deep link.
Website/Mini App tetap source of truth untuk discovery, full profile, group/event management, privacy settings, dan
report detail.

Bot harus mengirim message baru dari server, bukan forward message user.

## 16. Logging

Jangan log email, PII body, token, OTP, magic link, cookie, service-role key, atau private profile content.

Gunakan request ID, sanitized result category, status code, duration, dan non-identifying metrics.

## 17. Failure handling

- Jangan tampilkan raw Supabase error.
- Jangan fake success saat database gagal.
- Onboarding tidak boleh partial.
- Auth failure memakai generic message.
- Missing environment menghasilkan generic unavailable response.

## 18. Production gates

Sebelum production:
- dedicated Supabase project verified;
- migrations applied in order;
- live magic-link dan PKCE test;
- RLS two-account test;
- RPC rollback test;
- refresh/sign-out cookie test;
- waitlist insert/duplicate test;
- durable rate limiting (`api_rate_limits` + magic-link / Early Access);
- production Site URL dan callback allowlist;
- baseline security headers (`next.config.ts`); monitoring tanpa PII tetap P2;
- Vercel root = `studydate-web` (lihat `docs/operations/vercel-deploy.md`).
