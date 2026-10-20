# StudyDate ID — Architecture

## 1. Current stack

Periksa `package.json` sebelum bekerja. Arsitektur saat ini menggunakan Next.js 16.3.0 App Router, React 19.2.8,
TypeScript, Tailwind CSS 3.4.1, `@supabase/ssr` 0.12.4, `@supabase/supabase-js` 2.111.0, Zod 4.4.3,
existing accessible UI primitives, Route Handlers, dan Server Actions.

Jangan menambahkan framework auth lain.

## 2. High-level architecture

```text
Browser
  -> Next.js App Router
       -> Public UI: landing page + Early Access dialog
       -> Public docs: /about, /privacy, /terms, /community-guidelines, /safety, /help,
          /events, /events/[publicSlug], /events/[publicSlug]/calendar.ics
         (legacy /privasi, /ketentuan, /pedoman-komunitas, /bantuan, /keamanan redirect)
       -> Public knowledge: /insight, /insight/[publishedSlug]
       -> Public search discovery: /sitemap.xml, /robots.txt, canonical metadata,
          public-only Web Analytics, dan JSON-LD Organization/WebSite/Article/Breadcrumb
       -> Public handlers: /api/early-access, /api/early-access/revise
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
- `PDDIKTI_LOOKUP_PROVIDER_ENABLED` (default OFF)
- `PDDIKTI_PROVIDER_BASE_URL`
- `PDDIKTI_PROVIDER_ACCESS_KEY`
- `LINKEDIN_VERIFICATION_ENABLED` (default OFF)
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, dan exact HTTPS
  `LINKEDIN_REDIRECT_URI`
- `LINKEDIN_IDENTITY_API_VERSION` dan
  `LINKEDIN_VERIFICATION_API_VERSION`
- `LINKEDIN_MEMBER_HASH_KEY` (32-byte HMAC key terpisah)
- `CONTACT_REVEAL_ENCRYPTION_KEY` (AES-256-GCM; see `docs/operations/contact-reveal-key-recovery.md`)
- optional `CONTACT_REVEAL_KEY_VERSION` and `CONTACT_REVEAL_ENCRYPTION_KEY_V{n}` during rotation
- StudyDate-branded SMTP atau Resend untuk email verifikasi kampus.
- `AUTOGOPAY_ENABLED` (default OFF) dan `AUTOGOPAY_API_KEY` untuk GoPay QRIS
  server-side; key yang pernah dibagikan di chat wajib dirotasi.

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

### 8.1 Early Access Moderation, Invitation, dan Claim

```text
Waitlist entry (waiting; bukan akun)
 -> shared moderation queue
    -> Owner: full access
    -> Staff: read/review hanya jika capability diberikan Owner
 -> approve | request revision | reject
 -> needs_revision: kirim alasan publik + tautan koreksi sekali pakai
 -> koreksi valid: status kembali ke waiting dan masuk queue lagi
 -> approved: StudyDate mengirim branded one-time magic link
 -> Auth callback dengan email yang sama
 -> RPC claim_early_access_for_me() (auth.uid + auth.users.email)
 -> approved-only atomic claim (FOR UPDATE + unique claimed_user_id)
 -> status claimed
 -> onboarding prefill terbatas (campus + soft hints)
 -> user tetap menyelesaikan field wajib + Terms/Privacy/Community
```

Prinsip:

- Waitlist ≠ account dan approval Early Access ≠ Student/Alumni Verification.
- Status lifecycle: `waiting | needs_revision | approved | rejected | claimed`.
- Owner selalu memiliki `early_access.read` dan `early_access.review` melalui role. Admin default deny; capability review diberikan secara eksplisit oleh Owner dan tidak memberi capability staff lain.
- Claim idempotent dan server-authoritative; tidak menerima email/user_id dari client. Hanya row `approved` dengan email Auth yang sama yang dapat diklaim.
- Login akun yang onboarding-nya sudah selesai tetap dapat berlangsung. Pembuatan/login akun Beta baru tidak menghasilkan akses onboarding sebelum Early Access disetujui; public magic-link endpoint menjaga respons enumeration-safe.
- Invitation dikirim dari server melalui email StudyDate branded dan mengarah ke `/onboarding`; link sekali pakai/expiry mengikuti Supabase Auth token.
- Jika pengiriman email gagal setelah approve, keputusan approval tetap tersimpan dan reviewer dapat `Kirim ulang undangan`.
- Early Access consent bukan pengganti product/legal consent.
- Prefill tidak menyalin CTA interests (`people`/`groups`/`events`) ke `profiles.interests`.
- Tidak ada badge publik “Early Access Member” otomatis.
- Account deletion melepaskan claim menjadi `waiting` dan membersihkan metadata review/invitation lama agar membutuhkan review ulang.

Implementasi queue dipakai bersama oleh `/owner/early-access` dan `/staff/early-access`; authorization tetap server-side melalui `staff_members`/app metadata, bukan hard-coded email Owner.

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

PDDIKTI lookup v1 menambahkan `AcademicLookupProvider` dan adapter pihak ketiga
server-only yang dapat diganti. Adapter menerima current-user claim saja,
memeriksa seluruh candidate, dan auto-match hanya pada NIM + nama legal +
kampus + program exact setelah normalisasi. Response mentah dan candidate lain
tidak melewati server boundary. Timeout provider 25 detik, satu attempt per
lookup, route budget 40 detik, response 256 KB, serta rate limit durable 3/jam
dan 6/hari per akun.

Provider match membuat request `academic_pending` dengan ownership
`not_checked`, tidak membuat badge. Request yang sama kemudian dilengkapi
ownership email kampus atau kartu mahasiswa. Konfirmasi email hanya menyelesaikan
ownership; badge selalu difinalisasi reviewer aktif. Manual fallback memakai screenshot
PDDIKTI private/re-encoded sebagai academic supporting evidence dan reviewer
hanya menyetujui academic match. Badge tetap diturunkan atomik setelah academic
dan ownership sama-sama approved. Migration `202608110003` sudah deployed dan
live-verified dengan akun sintetis; kedua feature flag tetap default OFF,
controlled rollout belum dimulai, dan provider nyata belum diuji.

Verified on LinkedIn berjalan sebagai OAuth account-linking yang terpisah dari
login utama StudyDate. Route `/api/verification/linkedin/start` memerlukan
session aktif dan membuat state acak dalam cookie HttpOnly berumur sepuluh
menit. Callback memvalidasi state dan session, menukar authorization code hanya
di server, lalu membaca `/identityMe` dan `/verificationReport`. Access
token serta response mentah tidak disimpan. Database hanya menerima HMAC
fingerprint member ID, kategori `IDENTITY`/`WORKPLACE`, dan timestamp.
Status ini tidak pernah memperbarui `profiles.verification_status`.

Operasional manual memerlukan reviewer dengan `app_metadata.verification_reviewer = true`, domain kampus berstatus
`approved`, delivery email StudyDate SMTP/Resend, dan Vercel Cron evidence
cleanup dengan heartbeat sukses dalam 36 jam. Readiness dipisah menjadi manual
kartu, email kampus, dan provider. Tidak ada public admin route atau dashboard
pada fase ini.

## 11. People Discovery v1 architecture

People discovery tidak melakukan broad select pada `profiles`. Server Component memvalidasi query parameter dengan
Zod lalu memanggil authenticated Supabase server client.

`list_people_discovery_profiles` dan `get_people_discovery_profile` adalah `SECURITY DEFINER` RPC dengan explicit
projection, fixed `search_path`, session/onboarding guard, discovery eligibility, self-exclusion, bounded result, serta
execute grant hanya untuk `authenticated`. Detail memakai public alias dan tidak mengembalikan internal user ID.
List RPC Phase 1 juga menolak kuota People harian dan mengabaikan filter lanjutan untuk paket Free.

`set_people_discovery_visibility` mengambil target hanya dari `auth.uid()` dan mengubah satu protected field milik
sendiri. Direct column update atas `is_discoverable` tetap tidak diberikan kepada client.

Migration `202610020003` menambahkan `set_my_study_status` dan `get_my_study_status` untuk status sosial yang
berumur 24 jam. Nilai dibatasi pada teman belajar, teman diskusi, dan teman proyek. Projection People mengembalikan status
hanya selama `study_status_expires_at` masih berlaku; tidak ada job penghapusan yang diperlukan untuk kebenaran tampilan.
Client menyembunyikan kontrol bila RPC belum tersedia, sehingga deploy kode dapat mendahului rollout database dengan aman.

Fondasi block/report berada pada Introduction Requests. Block berlaku dua arah untuk discovery dan introduction,
menutup request pending yang relevan, serta menjadi gate pada chat, reveal, circle, event, dan proyeksi privat.

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
Kuota produk (pending keluar + kiriman harian) terpisah dari security rate limit 5/jam dan 15/hari.

Fondasi `user_blocks` dan `user_reports` privat. Block dua arah mencegah introduction baru dan menutup pending.
People Discovery di-refresh agar mengecualikan pasangan yang saling memblokir.

Kebijakan visibilitas: bila penerima menonaktifkan People setelah request masuk, peserta tetap dapat melihat request
yang sudah ada; pengiriman baru tetap membutuhkan discoverability.

## 12b. Anonymous Chat v1 architecture

```text
accepted introduction
 -> conversation_shells (public_id opaque)
 -> /app/messages list + /app/messages/[publicId]
 -> send_anonymous_message / send_anonymous_sticker
 -> versioned reply send RPCs + bounded reaction toggle
 -> list_conversation_messages_v3 (reply preview + reaction aggregates)
 -> v2/v1 projection fallback selama rolling deploy
 -> private Realtime Broadcast signal -> authenticated safe refetch
 -> adaptive authenticated polling tetap menjadi fallback
 -> end | block | report
```

Lifecycle shell: `awaiting_chat` → `active` (pesan pertama) → `ended` | `blocked`.
Pesan disimpan di `anonymous_messages` dengan `message_type = text | sticker`, body fallback text, optional allowlisted
`sticker_id`, idempotency key, dan `read_at` recipient-only. Emoji tetap Unicode di body teks dan tidak memerlukan media
storage. Sticker v1 hanya memakai aset mascot resmi yang sudah dibundel; tidak ada URL/storage path yang dikirim user.
Body fallback mempertahankan kompatibilitas Telegram Companion v1 dan client lama. Tidak ada grant SELECT tabel ke
`authenticated` agar UUID pengirim tidak bocor lewat PostgREST. Migration `202610020002` menambahkan private
Realtime Broadcast yang hanya mengirim sinyal tanpa isi pesan; client lalu mengambil ulang projection aman lewat route
authenticated. Indikator mengetik memakai event sementara tanpa user ID, alias, atau isi draft. Adaptive polling tetap
aktif sebagai fallback saat channel belum tersambung atau migration remote belum diterapkan. Status rollout remote harus
diverifikasi sebelum Realtime disebut aktif di production.

Migration `202610020004` menambahkan balasan yang hanya boleh menunjuk pesan visible dalam conversation yang sama.
Reaksi dibatasi pada lima nilai, satu pilihan per peserta per pesan, dan client hanya menerima jumlah per reaksi serta
`reacted_by_me`, bukan UUID pemberi reaksi. Tabel reaksi memakai RLS tanpa direct table grant; seluruh mutasi melalui
RPC yang memeriksa participant, status conversation, block, dan target pesan. RPC v3 serta send v2 bersifat versioned
agar chat lama, stiker, Telegram Companion, dan polling tetap berjalan sebelum rollout database selesai.

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

Identity Reveal photo preparation consumes durable per-account upload limits
before decoding. Failed registration removes the new object immediately; a
durable queue retries failed orphan removal and superseded-version cleanup
through the existing protected daily cleanup route. Queue claims exclude profile
versions referenced by completed reveal snapshots or active consents.
Image decoding enforces a 4096² input-pixel ceiling and strict warning failure.
Because reveal media is conversation-scoped, account deletion inventories and
purges both participants' reveal versions only in conversations involving the
deleted account.

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
    or Circle/Event membership and material field changes
 -> user_notifications (recipient + constrained type + safe path + bounded labels)
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
Unread count global dipoll setiap 45 detik, tidak overlap, dan polling dilewati ketika
document hidden. Chat tetap memakai polling percakapan ~4 detik yang sudah ada.
Preference per tipe tidak ada; Circle/Event memakai inbox dan badge yang sama.

Migration deployed `202608170006` memperluas constraint type/path/metadata untuk Circle dan
Campus Event. Fan-out memakai `INSERT … SELECT` terbatas pada membership/RSVP aktif,
mengecualikan actor/organizer, dan `ON CONFLICT (dedupe_key) DO NOTHING`. Projection
list menambahkan `headline` / `when_label` / `venue_label` terikat panjang, bukan objek
metadata mentah, email, NIM, atau UUID. Delivery in-app only. Fungsi scheduler Event
sudah deployed, tetapi cron production tetap OFF sampai live QA dan approval aktivasi.
Pengiriman tidak memanggil kuota membership.

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

Notifications Circle tidak men-fan-out join/leave/message ke seluruh anggota. Owner
menerima anggota baru; anggota aktif menerima arsip dan perubahan nama/topik; anggota
yang dikeluarkan menerima satu notifikasi keanggotaan. Join approval tidak ada.

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
file, atau pembayaran Event. Fase lanjutan menambah Event chat, ticketing/check-in,
waitlist, association Circle, dan reminder tanpa mengubah private reveal.

RSVP `going | cancelled` mengambil user dari sesi. Organizer otomatis menjadi RSVP
pertama. RPC RSVP mengunci row Event sebelum menghitung peserta aktif dan melakukan
upsert, sehingga percobaan bersamaan pada slot terakhir tetap tidak dapat melebihi
kapasitas. Re-RSVP setelah pembatalan sukarela diizinkan selama eligibility dan kapasitas
masih terpenuhi.

Discovery/detail hanya memproyeksikan jumlah peserta. Daftar peserta penuh hanya untuk
organizer atau RSVP `going`, memakai allowlist field People dan mengecualikan pasangan
yang saling memblokir. Introduction tetap melalui RPC eligibility existing; RSVP tidak
menulis conversation, Mutual Interest, Identity Reveal, atau Contact Reveal.

Organizer adalah role Event-scoped, bukan staff. Edit hanya untuk Event `scheduled` yang
masih lebih dari dua jam sebelum mulai; scope immutable dan kapasitas tidak dapat turun
di bawah RSVP aktif. Waktu, timezone, dan venue dikunci setelah RSVP `going`
non-organizer pertama. Cancel tidak dapat dipulihkan, mempertahankan RSVP/evidence, dan
archive hanya tersedia setelah cancel atau Event berakhir. Circle association tetap di
luar Event v1 awal tetapi tersedia pada fase berikutnya. Notifikasi RSVP, perubahan
jadwal/lokasi, pembatalan, waitlist promotion, dan reminder memakai tabel
`user_notifications` existing.

Live audit A/B/C/D mengonfirmasi public-place filtering, waktu/timezone, open/campus
eligibility, RSVP idempotency dan exact final-slot concurrency, safe detail/attendee
projection, block/Introduction integration, report scope, organizer/staff isolation,
cancel/archive retention, direct-table denial, zero automatic private-flow/Event
Notification side effects, authenticated UI smoke, dan cleanup sintetis lengkap.
Post-deploy migration dry-run kosong.

Halaman detail untuk acara `open + official` menyediakan share URL kanonis, Google
Calendar, dan endpoint `.ics`. Endpoint kalender memvalidasi opaque public slug lalu
mengambil ulang projection acara publik; acara privat, tidak resmi, dibatalkan, atau
sudah berakhir menghasilkan 404 dan tidak pernah masuk ekspor.

### Campus Events v2 architecture (REPOSITORY IMPLEMENTED / REMOTE STATE MUST BE VERIFIED)

```text
/app/events/[event]
 -> instant atau approval registration RPC
 -> pending | going | waitlisted | declined | cancelled
 -> going: app derives opaque SDT1 token; database stores SHA-256 hash only
 -> /manage: safe registration projection + scoped team authorization
 -> /manage/check-in/scan: browser camera -> Server Action -> atomic check-in RPC
```

Organizer eligibility adalah trust rule server-side (student aktif, onboarding lengkap,
tidak staff, verified atau explicit Owner grant, serta bukan explicit revoke).
`event_team_members` hanya memberi role `cohost | checkin_staff` pada satu Event.
Membership resolver existing menentukan limit Event Free/Plus; membership tidak menentukan
trust, official badge, check-in authorization, atau moderation.

Kapasitas, approval, FIFO waitlist promotion, ticket issuance/regeneration, dan check-in
berjalan dalam RPC/transaction lock. Scanner tidak menulis tabel langsung. Check-in staff
hanya menerima projection minimum, cohost dapat mengelola registrasi/check-in, dan hanya
creator Event dapat mengelola team/settings. Regular attendee tidak dapat enumerate peserta.
`EVENT_TICKET_SECRET` adalah server-only key 32 byte untuk derivasi token deterministik;
raw token tidak masuk database, URL, log, atau analytics.

## 12i. Account & Privacy Controls v1 (DEPLOYED / LIVE-VERIFIED)

`/app/settings` memakai satu Server Component dengan empat section dan server
actions/RPC sempit. Profil settings tidak menerima target user, nama privat,
verification, staff, alias, atau reveal data. Perubahan kampus/program harus
memilih katalog approved; nilai legacy saat ini boleh tetap tampil tetapi
tidak dapat disimpan sebagai nilai baru tanpa approval katalog.

Block management memakai `list_my_blocked_students` dan
`unblock_my_blocked_student(alias)`. Projection hanya alias, konteks akademik,
maskot, dan waktu block milik actor. Tidak ada counterpart block state.

`account_deletion_requests` adalah antrean internal idempotent
`pending | processing | completed | failed`. Request student hanya membuat
privacy lock (`is_discoverable=false`, `deactivated_at`), lalu
`is_eligible_introduction_student` menjadi shared database gate untuk
Introduction, Chat, Mutual, Identity, Contact, Circle, dan Event. Route guard
mengarahkan akun request ke `/account/deletion-pending`.

Migration forward-only `202608100002_finalize_account_deletion_lifecycle.sql`
menambahkan lease/retry service-only, shared-history FK tombstone-safe,
Identity/Contact suppression, central 180-day limited-rollout retention,
Circle archive, Event cancellation, dan Auth-last finalization. Executor
`scripts/process-account-deletions.mjs` berjalan dari trusted scheduler/runner,
bukan browser, dan memakai object refs Storage yang diturunkan server-side.

Migration `202608100003_harden_account_deletion_runtime.sql` menutup mutation
bypass setelah privacy lock, menjaga membership/RSVP aktif sebagai tombstone,
menolak Auth deletion sebelum database cleanup, memberi claim by-request-id
untuk operasi terkontrol, dan membatasi retention metadata deletion. Ketiga
migration telah sinkron dengan project `ctbqudtvrfezuoqcecyj`; audit live A/B/D,
worker exact-request, cleanup, dan browser lima viewport lulus pada 10 Agustus 2026.
Mahasiswa tetap hanya dapat request self dan membaca status sendiri.

## 12j. Membership, AutoGoPay, dan Safety Meeting

```text
get_my_membership / effective_membership_plan
 -> Free fallback if no active Plus window
 -> MEMBERSHIP_LIMITS (TS) + membership_plan_limit (SQL)
 -> product quota checks inside People / Introduction / Circle RPCs
 -> security rate limits remain independent
```

Free adalah default produk. Plus disimpan di `user_entitlements` (plan `plus` saja) dengan
`timestamptz`, status `active|expired|revoked`, dan source
`system|owner_grant|promo|early_access_promo|future_payment`. Resolver memilih paling
lama `ends_at` (NULL first) di antara window aktif; unique partial index mencegah dua
Plus `active` bersamaan. Grant Owner memakai `greatest(existing ends_at, now+duration)`
dan tidak memendekkan grant tanpa batas (`ends_at` NULL).

Pembayaran Plus bukan subscription auto-renew. Catalog checkout hanya terdiri dari
`plus_7` (7 hari, Rp9.000), `plus_30` (30 hari, Rp19.000), dan `plus_90`
(90 hari, Rp49.000). Order menyimpan snapshot harga/durasi. Finalisasi pembayaran
menambah durasi dari `max(now, ends_at)` sehingga pembelian berulang tidak membuang
sisa masa aktif.

Kuota People harian memakai `membership_quota_usage` (satu consume per list RPC, jendela
UTC day). Variabel PL/pgSQL hotfix adalah `v_quota_window_start` agar tidak bentrok
dengan kolom `window_start`. Kuota introduction/circle dihitung dari row aktual (pending outgoing, created
today UTC, owned active circles, joined `role=member`). Kuota Event memakai row
scheduled mendatang. Campus Events v2 memakai owned active Free/Plus `1/3`,
joined active `5/10`, participant capacity `50/200`, cohost `1/3`, dan custom
questions `3/10`. UI `/app/membership` menampilkan
perbandingan Free/Plus dan tiga pilihan durasi GoPay hanya saat kill switch/package
aktif. Owner `/owner/memberships` mengatur harga/status setiap durasi serta
lookup/grant by email. RPC UUID `manage_user_membership` dicabut dari `authenticated`.

Jangan cache otorisasi membership lintas request setelah grant/revoke. `getMyMembership`
memakai React `cache()` per request. Client, `localStorage`, `user_metadata`, dan boolean
profil bukan sumber membership.

Migration `202608210001` menambah offer awal Owner, private payment ledger,
service-role finalization, dan adapter GoPay QRIS Next.js. Migration
`202608220001` menggantinya dengan tiga fixed-duration package. Webhook memverifikasi
HMAC-SHA256 atas exact raw bytes sebelum strict payload validation. Amount, provider
order, dan transaction harus cocok; duplicate callback tidak menambah entitlement.

Migration `202608210002` menambah satu meeting plan aktif per `conversation_shells`
setelah Mutual Interest + Identity Reveal. Projection actor hanya memuat detail plan
dan own pre/post-check. End/block membatalkan plan mendatang; detail tempat/waktu
dibersihkan setelah 90 hari kecuali report moderasi aktif.

Migration repository `202608210003`–`009` memisahkan Event roadmap menjadi kuota membership,
scheduler reminder idempoten, preferensi in-app, association Circle milik organizer,
FIFO waitlist, chat teks untuk RSVP aktif, serta tiket opaque dengan check-in organizer.
Forward migration repository `202608210010` memperbaiki konflik record/alias waitlist.
Scheduler tetap OFF sampai live QA dan aktivasi cron terpisah.

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

## 15. Controlled Telegram architecture

### Repository implemented — remote rollout must be verified

```text
eligible Anonymous Chat
 -> authenticated create link session (opaque token; HMAC hash stored)
 -> /start token in private @StudyDateBot chat
 -> telegram_pending (encrypted route + keyed identity fingerprint)
 -> authenticated StudyDate confirmation
 -> one active conversation relay per user

anonymous_messages insert
 -> same-transaction durable outbox reference
 -> trusted server-only executor claims lease
 -> eligibility recheck
 -> decrypt route with Telegram-only AES-256-GCM key
 -> Telegram sendMessage with link preview disabled
 -> delivered | bounded retry | cancelled
```

Migration `202608110001` tersedia di repository. Status remote migration harus diverifikasi sebelum capability disebut aktif. Webhook route adalah
`/api/integrations/telegram/webhook`, POST-only, bounded JSON, verified dengan
official `X-Telegram-Bot-Api-Secret-Token`, dan update dedupe memakai
`update_id`. Bot menerima private chat, teks, `/start`, `/help`, dan `/unlink`
saja. Ingress service-role menurunkan actor dari binding privat lalu memanggil
shared database insertion policy yang juga dipakai web.

Binding tidak menyimpan username/nama/foto/language. Routing chat ID dienkripsi
AES-256-GCM, lookup identity memakai HMAC key terpisah, dan key/version/cipher
tidak keluar ke browser. Mutual Interest, Identity Reveal, Contact Reveal,
block reason, report status, serta seluruh one-sided state tetap web-only.
Privacy lock mencabut relay/session langsung; final profile cleanup menghapus
semua data routing Telegram.

`TELEGRAM_COMPANION_ENABLED` hanya aktif saat exact `true` dan default OFF.
Delivery runner server-only `/api/internal/telegram/delivery` diautentikasi
bearer `CRON_SECRET` dan memproses batch maksimal 25 claim memakai lease/retry
database existing. Vercel Hobby tidak menjadwalkannya karena sub-daily Cron
memerlukan Pro; Telegram tetap OFF sampai scheduler eksternal disetujui atau
plan di-upgrade. Endpoint hanya mengembalikan aggregate counts tersanitasi.
BotFather, webhook production, dan real Bot API test belum dilakukan.

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

### Staff authorized operations

Capability tipis di atas role Owner/Admin + `verification_reviewer`. Guard: `requireStaffCapability`. Waitlist ≠ akun. User ops projection aman (tanpa NIM/evidence/chat/reveal). Staff invite: resolve email → Auth user yang sudah ada; fallback jika belum ada akun (tanpa fabricate magic link).

## Anonymous chat social sharing v1 (2026-10-07)

- Message types are bounded to `text`, `sticker`, `circle_invite`, and `event_invite`.
- Share messages store an opaque internal slug and server-authored snapshots. Clients construct only allowlisted `/app/circles/:slug` or `/app/events/:slug` routes.
- `list_chat_shareables` filters by sender participation, recipient visibility, block state, campus scope, capacity, and existing recipient membership.
- `send_anonymous_share_v1` repeats every authorization check at mutation time, applies existing chat rate limits, and never creates Circle membership or Event registration.
- `list_conversation_messages_v4` is additive. The application rolls back through v3, v2, and v1 RPC projections while the database migration is pending.
- The composer is capability-gated through `anonymous_chat_sharing_available`, so production chat remains usable before rollout.

## 19. Pembaruan Oktober 2026 (repository implemented)

### Gerbang akses per jenis akun
`lib/account/student-access.ts` membaca `get_my_student_access()` lalu `requireSocialFeatureAccess()` dan
`requireEventFeatureAccess()` mengarahkan pengguna di halaman server. Keputusan akhir tetap di database lewat
`is_eligible_introduction_student`, `is_study_circle_student`, dan `is_campus_event_student`. Saklar Owner
`platform_settings.require_student_verification` default mati. Akun `.sch.id` hanya mendapat acara edukatif
dan menu sosial disembunyikan lewat `hiddenItemKeys` di app shell.

### Kontak resmi
Owner mengisi tautan di `/owner/contact` (RPC Owner). Footer publik membaca dengan service role lewat
`lib/marketing/contact-links.ts` dan hanya merender host yang diizinkan. Ikon dari simple-icons (CC0).

### Kalender Circle
Halaman Circle memuat bagian kalender (`components/circles/circle-calendar.tsx`) dan halaman Acara memuat
strip "Dari kalender yang kamu ikuti". Notifikasi dibuat oleh trigger database, bukan oleh server Next.js.

### Foto sampul acara
Unggah lewat `POST /api/events/[publicSlug]/cover` (route handler, bukan server action, karena batas body
server action 1 MB). Alurnya: sesi dan izin acara dicek, ukuran body dibatasi, `lib/events/cover.ts` memakai
sharp untuk memotong ke 1600x900 WebP tanpa EXIF, file diunggah service role ke `event-covers` dengan nama
acak, lalu `set_campus_event_cover` dipanggil dengan klien pengguna supaya otorisasi tetap di database. Bila
RPC gagal, file baru dihapus; bila berhasil, file lama dihapus. `DELETE` menghapus sampul.

### Acara online dan hybrid
Form mengirim `attendanceMode` dan `onlineUrl`. Untuk mode online, server mengganti isian tempat dengan
platform, keterangan tetap, dan kota `Online`. Link disimpan lewat `set_campus_event_online_link` setelah
acara dibuat atau diubah. Batas data:
- halaman publik, `.ics`, gambar pratinjau, dan sitemap tidak pernah membaca link rapat;
- `lib/events/public-service.ts` hanya membaca ada tidaknya link untuk menentukan mode hybrid;
- `lib/events/media.ts` memperlakukan RPC yang belum ada sebagai "belum tersedia", supaya kode bisa dideploy
  sebelum migration.

### Pratinjau saat dibagikan
`app/(public-docs)/events/[publicSlug]/opengraph-image.tsx` membuat gambar 1200x630 per acara resmi publik.
Sampul WebP diubah ke JPEG di server sebelum dirender. Tanpa sampul, gambar memakai stiker maskot. JSON-LD
memakai `OnlineEventAttendanceMode`, `MixedEventAttendanceMode`, atau `OfflineEventAttendanceMode`, dan
`VirtualLocation` menunjuk halaman acara, bukan link rapat. `app/sitemap.ts` memuat acara resmi publik.
