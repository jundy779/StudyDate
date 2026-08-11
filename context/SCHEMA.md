# StudyDate ID — Data Schema

## 1. Status

- **Implemented**: ada di migration/code saat ini.
- **Planned**: desain produk; jangan dibuat tanpa task eksplisit.
- **Future**: prinsip atau arah jangka panjang; belum menjadi scope implementasi.

Selalu periksa migration aktual sebelum mengubah dokumen ini.

## 2. Implemented tables

Sumber migration:

1. `supabase/migrations/202607300001_create_early_access_waitlist.sql`
2. `supabase/migrations/202607300002_create_auth_onboarding_foundation.sql`
3. `supabase/migrations/202607310001_create_student_verification_center.sql`
4. `supabase/migrations/202607310002_refine_academic_verification.sql`
5. `supabase/migrations/202607310003_harden_verification_cleanup.sql`
6. `supabase/migrations/202607310004_create_people_discovery.sql` — local-only sampai preflight dan approval terpisah
7. `supabase/migrations/202607310005_create_staff_roles_and_admin_shell.sql` — local-only; belum diterapkan remote
8. `supabase/migrations/202608060001_create_introduction_requests_v1.sql` — Introduction Requests v1 +
   block/report foundation (synced remote through controlled apply)
9. `supabase/migrations/202608060002_fix_introduction_rpc_volatility.sql` — list/eligibility RPCs VOLATILE
10. `supabase/migrations/202608060003_create_anonymous_chat_v1.sql` — Anonymous Chat v1;
    applied remotely after preflight (uses `extensions.gen_random_bytes` for public IDs)
11. `supabase/migrations/202608060004_create_mutual_interest_v1.sql` — Mutual Interest v1;
    applied remotely after controlled preflight
12. `supabase/migrations/202608060005_create_identity_reveal_v1.sql` — Identity Reveal v1;
    applied remotely after controlled preflight
13. `supabase/migrations/202608060006_create_contact_reveal_v1.sql` — Contact Reveal v1;
    applied remotely after controlled preflight
14. `supabase/migrations/202608060007_fix_contact_reveal_channel_ambiguity.sql` —
    fix PL/pgSQL OUT `channel` ambiguity; applied remotely after live audit
15. `supabase/migrations/202608060008_create_moderation_triage_v1.sql` —
    Owner-only Moderation Triage; deployed through actual repository state
16. migrations `202608070001`–`202608070012` — durable rate limits, DB-backed
    campus/study-program catalogs, profile/account lifecycle, dan social contacts
17. `supabase/migrations/202608070013_create_notifications_v1.sql` —
    Notifications v1; diterapkan remote setelah controlled preflight dan live A/B/C audit
18. `supabase/migrations/202608090001_create_study_circles_v1.sql` —
    Study Circle v1; diterapkan remote setelah exact dry-run
19. `supabase/migrations/202608090002_fix_study_circle_rpc_ambiguity.sql` —
    forward fix untuk ambiguitas PL/pgSQL pada member/message/report RPC; diterapkan
    remote lalu diverifikasi melalui live A/B/C/D audit
20. `supabase/migrations/202608090003_create_campus_events_v1.sql` —
    Campus Events v1; diterapkan remote setelah exact dry-run
21. `supabase/migrations/202608090004_fix_campus_event_detail_projection.sql` —
    forward fix urutan projection RPC detail; diterapkan remote setelah live defect
    terkonfirmasi
22. `supabase/migrations/202608100001_account_privacy_controls_v1.sql` —
    Account & Privacy Controls v1; **deployed**
23. `supabase/migrations/202608100002_finalize_account_deletion_lifecycle.sql` —
    final deletion worker contracts, tombstone-safe shared history, dan
    centralized retention; **deployed**
24. `supabase/migrations/202608100003_harden_account_deletion_runtime.sql` —
    deletion-lock mutation guard, durable membership/RSVP tombstone,
    cleanup-before-Auth enforcement, scoped job claim, dan bounded request
    retention; **deployed**
25. `supabase/migrations/202608110001_create_telegram_anonymous_chat_companion_v1.sql` —
    private two-step Telegram binding, one-conversation relay, update dedupe,
    shared Anonymous Chat ingress, durable delivery outbox, dan deletion
    integration; **LOCAL-ONLY / NOT APPLIED**
26. `supabase/migrations/202608110002_fix_telegram_delivery_claim_ambiguity.sql` —
    forward-only qualification fix untuk worker claim Telegram yang sudah deployed;
    **LOCAL-ONLY / NOT APPLIED**
27. `supabase/migrations/202608110003_extend_student_verification_pddikti_lookup_v1.sql` —
    provider-assisted academic match, manual fallback, minimal provider
    metadata, ownership completion, dan reviewer academic-only action;
    **LOCAL-ONLY / NOT APPLIED**

### `early_access_waitlist`

Purpose: menyimpan Early Access registration.

Core fields:
```text
id uuid primary key
email text not null
campus text null
interests text[] not null default '{}'
source text null
status text not null default 'waiting'
consent_version text not null
consented_at timestamptz not null
created_at timestamptz not null
```

Security: case-insensitive unique email, normalized email, approved interests/source, no public select/update/delete,
insert melalui server handler.

### `profiles`

```text
user_id uuid primary key -> auth.users(id)
public_alias text not null unique
first_name text not null
campus text not null
study_program text not null
degree_level text null
semester smallint null
city_region text null
short_intro text null
interests text[] not null default '{}'
connection_goals text[] not null default '{}'
verification_status text not null default 'unverified'
is_discoverable boolean not null default false
onboarding_completed_at timestamptz null
created_at timestamptz not null
updated_at timestamptz not null
```

Protected: user_id, public_alias, verification_status, is_discoverable, onboarding_completed_at, timestamps.

### `onboarding_academic_claims`

Optional private NIM claim dari onboarding. Menyimpan AES-256-GCM ciphertext/IV/auth tag, NIM last four, dan keyed HMAC
fingerprint. Tidak ada direct grant untuk anon atau authenticated dan NIM tidak disimpan di `profiles`.

### `privacy_preferences`

```text
user_id uuid primary key -> auth.users(id)
online_first boolean not null default true
group_first boolean not null default false
verified_users_only boolean not null default false
same_campus_preferred boolean not null default false
cross_campus_allowed boolean not null default true
created_at timestamptz not null
updated_at timestamptz not null
```

Public-place-only meeting adalah platform rule, bukan preference.

### `user_consents`

```text
id uuid primary key
user_id uuid not null -> auth.users(id)
consent_type text not null
policy_version text not null
consented_at timestamptz not null
revoked_at timestamptz null
```

Consent types: terms, privacy, community_guidelines. Normal client tidak boleh menulis ulang consent timestamp.

### `account_deletion_requests`

Antrean internal idempotent per user dengan status `pending | processing |
completed | failed`, timestamp lifecycle, retry count, dan sanitized
`failure_code`. Table RLS-enabled tanpa direct grant ke student. Student hanya
dapat memanggil request/status wrapper miliknya; processing/cleanup worker tidak
diberikan kepada `authenticated`. Forward migration menambahkan lease 15 menit,
database/Auth cleanup checkpoints, dan audit operasi tersanitasi.

### `account_privacy_policy` / `account_deletion_audit_events`

Policy singleton menjadi satu sumber durasi retensi moderation/security
limited-rollout (180 hari). Audit deletion hanya menyimpan request reference,
event category, dan waktu—tanpa user ID, email, object path, isi privat, atau
raw error. Shared history memakai nullable Auth FK agar Auth dapat dihapus
terakhir tanpa menghapus pesan, Circle, Event, RSVP, atau report.

### Telegram Companion v1 (LOCAL-ONLY)

- `telegram_link_sessions` — sesi 10 menit
  `created | telegram_pending | confirmed | expired | revoked`; token plaintext
  tidak disimpan, hanya keyed HMAC hash. Pending route dienkripsi sampai web
  confirmation.
- `telegram_account_bindings` — satu row per StudyDate user; keyed Telegram
  identity fingerprint unik untuk binding aktif, AES-256-GCM route ciphertext,
  key version, linked/revoked timestamp. Tidak ada username/nama/foto/language.
- `telegram_conversation_relays` — satu primary-key row per user sehingga hanya
  satu percakapan relay aktif pada v1. Switch mengganti target atomik.
- `telegram_update_receipts` — Telegram `update_id` sebagai idempotency boundary,
  dengan cleanup bounded tujuh hari.
- `telegram_delivery_outbox` — referensi message/recipient/conversation,
  lease/retry/delivery state; tidak menduplikasi message body.
- `telegram_companion_rate_limits` dan `telegram_companion_audit_events` —
  bounded counters serta event category tersanitasi tanpa token, route,
  identifier Telegram, atau isi pesan.

Seluruh tabel RLS-enabled dan direct access `public`/`anon`/`authenticated`
dicabut. Safe Student RPC hanya create/state/confirm/cancel/switch/unlink.
Webhook/outbox RPC service-role only. `send_anonymous_message` web dan ingress
Telegram berbagi `insert_anonymous_message_for_actor`, sehingga normalisasi,
panjang 1–1000, filter kontak, rate limit 20/menit + 300/hari, duplicate
window, lifecycle, block, staff, dan deletion gate sama.

### `staff_members`

Protected staff membership keyed by existing `auth.users.id`. Role dibatasi `owner` atau `admin`; status dibatasi
`active` atau `inactive`; reviewer permission tersimpan terpisah. Email/password tidak diduplikasi. Satu unique partial
index mencegah lebih dari satu owner. Direct access dicabut dari anon dan authenticated; operasi lewat controlled RPC.

### `staff_role_events`

Append-only sanitized audit untuk owner bootstrap, admin grant/deactivate/reactivate, serta reviewer grant/removal.
Tidak menyimpan email, token, payload, verification claim, atau evidence path. Owner UI hanya menerima UUID suffix.

### `student_verification_requests`

Menyimpan claim verifikasi, status review, consent version, dan lifecycle evidence. NIM serta nama legal memakai
AES-256-GCM application encryption; duplicate detection memakai keyed HMAC fingerprint. Authenticated user hanya
mendapat projection status yang tersanitasi melalui column grants dan owner-scoped RLS.

Request status: pending, under_review, needs_action, verified, rejected, expired, cancelled.
PDDikti result: not_checked, matched, not_found, mismatch, unavailable.
Ownership result: not_checked, campus_email_verified, document_verified, failed.

Constraint database menolak status `verified` kecuali PDDikti `matched` dan ownership telah diverifikasi.

Extension `202608110003` menambahkan `academic_match_source` (`provider |
manual`), provider identifier generik, checked timestamp, outcome, dan keyed
academic claim fingerprint. Response provider/candidate tidak disimpan.
`academic_pending` menandai provider match yang belum memilih ownership method;
status request tetap `under_review`, ownership `not_checked`, dan profile tidak
verified.

Academic refinement menambahkan optional `semester_claim` serta `pddikti_evidence_path`,
`pddikti_evidence_deletion_at`, dan `pddikti_evidence_deleted_at`. Screenshot PDDikti merupakan evidence akademik,
bukan pengganti ownership proof.

### `campus_email_domains`

Registry domain email kampus dengan status pending_review, approved, atau rejected. Tidak ada asumsi bahwa semua
alamat `.ac.id` otomatis valid.

### `campus_email_verifications`

Challenge email privat dengan normalized email, keyed code hash, expiry, attempt count, resend cooldown, dan
verified timestamp. Kode plaintext tidak disimpan.

### `verification_events`

Audit trail append-only berisi event type yang dikontrol serta actor ID. Tidak menyimpan NIM, nama legal, email,
document path, reviewer note, atau respons mentah PDDikti.

### Private Storage

Bucket `student-verification-evidence` bersifat private, membatasi JPG/PNG/WebP sampai 5 MB, memakai path milik user,
signed URL review lima menit, serta lifecycle `evidence_deletion_at` dan `evidence_deleted_at`.

Next server kini decode input evidence, menolak format/dimensi tidak valid,
auto-orient, re-encode JPEG, dan strip metadata sebelum upload. Reviewer browser
memakai no-store authenticated media proxy sehingga object path dan signed URL
tidak diproyeksikan.

## 3. Implemented RPC

### `complete_student_onboarding`

Requirements:
- SECURITY DEFINER;
- explicit safe search_path;
- target dari auth.uid();
- reject unauthenticated;
- tidak menerima target user ID, verification, atau discoverability;
- alias dibuat oleh `lib/onboarding/service.ts` dengan cryptographically secure randomness dan collision retry,
  lalu dikirim sebagai `p_public_alias`;
- profile/preferences/consents atomik;
- execute dicabut dari public/anon dan diberikan hanya kepada role yang dimaksud.

### Verification RPC

- `create_student_verification_request`: service-role only; membuat request, mengubah profile menjadi pending, dan
  menulis audit event dalam satu transaksi.
- `create_student_verification_request_v2`: mewajibkan private PDDikti evidence path dan menyimpan optional semester
  claim tanpa mengubah combined verification rule.
- `confirm_student_campus_email_code`: service-role only; mengecek hash/expiry/attempt secara atomik dan mengubah
  ownership status.
- `finalize_student_verification_review`: service-role only; menegakkan combined verification rule, memperbarui
  request dan profile, menjadwalkan penghapusan evidence, serta menulis audit event dalam satu transaksi.
- `cancel_student_verification_request`: authenticated owner only; target berasal dari `auth.uid()` dan hanya request
  pending/needs_action yang dapat dibatalkan.

### People Discovery RPC

- `list_people_discovery_profiles`: authenticated/onboarded only; explicit safe projection, filter tervalidasi,
  self-exclusion, opt-in eligibility, urutan alias stabil, dan page limit maksimum 13 row untuk pagination 12 item.
- `get_people_discovery_profile`: mengambil satu eligible profile berdasarkan `public_alias`, bukan UUID.
- `set_people_discovery_visibility`: mengubah hanya `is_discoverable` milik `auth.uid()` setelah onboarding selesai.

Ketiga RPC memakai `SECURITY DEFINER`, fixed empty `search_path`, revoke dari `public`/`anon`, dan execute grant hanya
untuk `authenticated`. Migration menambahkan partial alias index dan GIN indexes untuk interest serta connection goal.

### Account & Privacy Controls RPC

- `update_my_student_profile_settings`: actor `auth.uid()`, hanya field profil
  belajar yang diizinkan, katalog campus/program approved, tanpa nama privat,
  alias, NIM, verification, staff, atau reveal data.
- `list_my_blocked_students`: blokir yang dibuat actor saja, safe anonymous
  projection tanpa UUID/counterpart state.
- `unblock_my_blocked_student`: alias-based, hanya menghapus row
  `(blocker_id=auth.uid(), blocked_id=target)`.
- `request_my_student_account_deletion`: idempotent, membuat privacy lock dan
  tidak memberi student kontrol atas cleanup.
- `get_my_account_deletion_status`: hanya status/timestamp milik actor.
- `is_eligible_introduction_student`: ditambahkan deactivation/deletion gate
  yang digunakan kembali oleh private flow, Circle, dan Event.
- `claim_account_deletion_job`, `list_account_deletion_storage_objects`,
  `cleanup_account_deletion_database`, `complete_account_deletion_job`,
  `fail_account_deletion_job`, dan `purge_expired_account_deletion_retention`:
  service-role only, leased, bounded, retryable, dan tidak granted ke student.

Migration Staff v1 mengganti projection RPC secara kompatibel untuk mengecualikan `staff_members.status = 'active'`
dan menolak active staff mengaktifkan discoverability. Grant/reactivation juga memaksa profile yang sudah ada menjadi
tidak discoverable. Inactive staff tidak otomatis muncul kembali; user harus opt-in ulang bila kembali menjadi student.

### Staff RPC

- `get_current_staff_membership`: hanya mengembalikan active membership bila app metadata claim cocok.
- `bootstrap_initial_owner`: service-role-only, UUID-based, exactly-one existing Auth user, single-owner, idempotent,
  memperbarui trusted metadata, staff row, People visibility, dan audit dalam satu transaksi.
- `manage_staff_member`: owner-only; action enum tetap, tidak menerima role bebas, tidak dapat mengubah owner sendiri.
- `list_staff_members` dan `list_staff_role_events`: owner-only controlled projections.
- `list_staff_verification_requests`: active owner/admin reviewer only, sanitized queue projection.
- `finalize_staff_verification_review`: active reviewer only, actor dari `auth.uid()`, menolak self-review, mempertahankan
  combined academic-match plus ownership requirement, dan menulis verification audit atomik.

### Introduction Requests RPC

- `send_introduction_request`: alias-based send; eligibility, contact filter, duplicate, cooldown, dan rate limit
  database-enforced.
- `accept_introduction_request` / `decline_introduction_request` / `cancel_introduction_request`: participant-gated
  status transitions; accept membuat `conversation_shells` unik.
- `list_received_introduction_requests` / `list_sent_introduction_requests`: projection aman tanpa UUID peserta.
- `get_introduction_send_eligibility` / `count_pending_received_introductions`: state CTA dan badge.
- `block_student_by_alias` / `report_introduction_request`: fondasi safety; block menutup pending pair.

Helper internal (`is_active_staff_user`, `users_are_blocked`, `introduction_message_has_contact`, dll.) dicabut dari
anon/authenticated.

## 4. Approved values

Verification:
```text
unverified
pending
verified
rejected
```

Connection goals:
```text
study
friendship
networking
collaboration
campus_activities
meaningful_connection
```

Starter interests:
```text
technology
design
business
languages
books
film
music
sports
organizations
career
research
volunteering
```

## 5. Implemented privacy-safe People output

Jangan expose full `profiles`. Gunakan dedicated view/RPC yang hanya mengembalikan:
```text
public_alias
campus
study_program
semester
city_region
short_intro
interests
connection_goals
is_verified
```

Avatar identifier diturunkan secara deterministik dari public alias pada server/UI untuk memilih mascot lokal dan tidak
disimpan sebagai identitas baru. Jangan return first_name, email, auth metadata, contact, precise location, raw
verification status, atau internal user ID.

## 6. Implemented introductions

### `introduction_requests`
```text
id uuid primary key
sender_id uuid
recipient_id uuid
opening_message text
status text
created_at timestamptz
updated_at timestamptz
responded_at timestamptz null
cancelled_at timestamptz null
expires_at timestamptz
```

Statuses: pending, accepted, declined, cancelled, expired.

Rules: one pending per unordered pair, 7-day cooldown after decline/cancel, durable rate limits, bounded plain-text
message with best-effort contact rejection, staff exclusion, block exclusion, no NIM/legal name/contacts stored.

### `conversation_shells`

Created atomically on accept. Unique `introduction_request_id`. Opaque `public_id` (32-hex) for routes.
Statuses: `awaiting_chat`, `active`, `ended`, `blocked`.

### `anonymous_messages`

```text
id uuid primary key
conversation_id uuid
sender_id uuid
body text (1–1000, normalized plain text)
created_at timestamptz
read_at timestamptz null
moderation_status text (visible|removed)
client_idempotency_key text null
```

Rules: sender = `auth.uid()` participant only; immutable body; best-effort contact rejection; rate limits
20/minute and 300/day; duplicate window; no attachments; no table SELECT grants to clients.

### `conversation_events`

Sanitized audit: activated, message_sent, ended, blocked, reported, messages_read,
mutual_interest_reached, identity_revealed, contact_revealed. Never stores one-sided interest/consent,
message bodies, contacts, or Storage paths.

### `user_notifications` (migration `202608070013`, applied remotely)

```text
id uuid internal primary key
public_id text unique opaque 32-hex
recipient_user_id uuid -> auth.users
notification_type constrained text
target_path constrained safe app path
metadata jsonb (empty, except completed contact channel)
dedupe_key text unique internal
created_at timestamptz server default
read_at timestamptz server controlled
```

Allowed types: `INTRODUCTION_RECEIVED`, `INTRODUCTION_ACCEPTED`,
`MESSAGE_RECEIVED`, `MUTUAL_INTEREST_COMPLETED`, `IDENTITY_REVEAL_COMPLETED`,
dan `CONTACT_REVEAL_COMPLETED`. `REPORT_STATUS_UPDATED` tidak dibuat karena kebijakan
aktual tidak memproyeksikan hasil moderasi kepada student.

Tidak menyimpan copy, message body, alias/nama, contact value, email, NIM, participant
UUID dalam projection, ciphertext, atau Storage path. Target hanya
`/app/introductions` atau `/app/messages/<opaque-public-id>`. Table RLS-enabled tanpa
direct grants; read dan read-state melalui RPC yang mengambil actor dari `auth.uid()`.
Dedupe key tidak dikembalikan kepada client.

### `conversation_mutual_interests`

Private Mutual Interest v1 consent rows (migration `202608060004`, applied remotely):

```text
id uuid primary key
conversation_id uuid not null -> conversation_shells
participant_id uuid not null -> auth.users
selected_at timestamptz not null
withdrawn_at timestamptz null
created_at / updated_at timestamptz
unique (conversation_id, participant_id)
```

Active consent = `withdrawn_at is null`. Counterpart consent is never exposed via RPC.
`conversation_shells.mutual_interest_at` is set atomically when both participants have an
active consent. Before mutual completion, a participant may withdraw privately. After
mutual completion, the timestamp remains; Identity Reveal is a separate feature and is
not triggered automatically.

Safe client projection only:

```text
eligible, selected_by_me, mutual, mutual_at, can_withdraw
```

### Identity Reveal v1 (migration `202608060005`, applied remotely)

Tables:
- `identity_reveal_profile_versions` — conversation-scoped immutable first name + private
  photo object key per `(conversation_id, owner_user_id, version_number)`; one active
  version per participant per conversation
- `conversation_identity_reveal_consents` — private per-participant consent; version must
  belong to the same conversation and caller
- `conversation_identity_reveals` — immutable completion snapshot of both approved versions
  from that conversation
- `conversation_shells.identity_revealed_at` — server-controlled completion timestamp
- Storage bucket `identity-reveal-photos` (private; service-role upload/download only)

Not a global reusable identity profile. A version prepared for conversation X cannot be
consented or streamed in conversation Y.

Safe pre-completion projection only:

```text
eligible, has_profile, selected_by_me, completed, completed_at, can_withdraw
```

Completed name projection: `mine_first_name`, `counterpart_first_name` (no photo paths).
After `ended`, both names/photos remain available per retention policy.
After `blocked`, counterpart name/photo are withheld on subsequent requests; own access
may remain; snapshot/audit retained.
Photos are served through authenticated media proxy (`private, no-store`).
Profile first name is user-provided for reveal and is not derived from legal name, NIM,
email, or People Discovery.
### `user_blocks` / `user_reports` / `introduction_events`

Minimal private safety foundation. Reports may reference `conversation_id` / `anonymous_message_id`.

## 7. Contact Reveal v1 (migration `202608060006`, applied remotely)

Identity Reveal v1 sudah diimplementasikan sebagai model percakapan-scoped
(`conversation_identity_reveal_*`, migration `202608060005` applied remotely).

Contact Reveal v1 (migration `202608060006`, applied remotely):

- `conversation_contact_versions` — conversation-scoped immutable encrypted contact
  values per channel (`telegram` | `instagram` | `linkedin`); AES-256-GCM ciphertext + IV
  + auth tag + key version; one active version per owner/conversation/channel.
- `conversation_contact_reveal_consents` — private per-participant consent per channel;
  version must belong to the same conversation, participant, and channel.
- `conversation_contact_reveals` — immutable completion snapshot per `(conversation_id, channel)`.
- `conversation_events.contact_revealed` + `event_channel` — sanitized completion event
  (channel id only; no plaintext contact).

Eligible only after `identity_revealed_at`, active shell, mutual done, both non-staff
students, not blocked. One-sided prepare/consent never projected. No WhatsApp / phone /
email / arbitrary URLs. Jangan pakai global reveal flag.

## 9. Implemented blocks and reports (Introduction foundation)

`user_blocks` mencegah discovery interaction baru dan introduction dua arah.

`user_reports` mereferensikan introduction (dan conversation/message). Report detail
bersifat privat. Owner triage (migration `202608060008`) menambah
`moderation_status` / catatan internal / `moderation_report_events` dan RPC Owner-only
di `/owner/moderation`. Mahasiswa tidak melihat hasil moderasi otomatis.

## 10. Study Circle v1 (migrations `202608090001`–`202608090002`, deployed)

Tables:

- `study_circles` — internal UUID, opaque `circle-` public slug, owner, bounded name
  (4–80), description (20–600), topic, `open | campus` scope, member limit 3–30,
  `active | archived` lifecycle.
- `study_circle_memberships` — private `(circle_id, user_id)` rows dengan role
  `owner | member` dan status `active | left | removed`.
- `study_circle_messages` — private group text 1–800 karakter, opaque public ID,
  per-author idempotency key, `visible | removed`, tanpa attachment atau rich content.
- `study_circle_events` — sanitized lifecycle audit tanpa message body, contact, atau
  private connection state.
- `study_circle_rate_limits` — atomic actor/window counters untuk create, membership,
  message, dan report.

Direct table grants dicabut dari `anon` dan `authenticated`; semua table RLS-enabled.
RPC authenticated:

```text
list_study_circles
get_study_circle
create_study_circle
update_study_circle
join_study_circle
leave_study_circle
remove_study_circle_member
archive_study_circle
list_study_circle_members
list_study_circle_messages
send_study_circle_message
report_study_circle
report_study_circle_member
```

Member projection hanya: `public_alias`, campus, study program, semester, interests,
connection goals, genuine verification boolean, Circle role, dan joined timestamp.
Message projection hanya: opaque message ID, author alias, genuine verification boolean,
body, timestamp, dan `is_mine`. Tidak ada UUID, nama, email, NIM, clear photo, contact,
reveal state, atau private conversation state.

`user_reports` memperoleh `study_circle_id`, optional Circle message reference, dan
immutable report-scoped excerpt maksimal 280 karakter. Composite FK memastikan message
evidence berasal dari Circle yang dilaporkan. Existing Owner moderation queue menampilkan
target kind `circle` / `circle_message` tanpa broad SELECT atas diskusi.

Archive menolak join dan pesan baru; anggota aktif tetap dapat membaca riwayat. V1 tidak
memiliki approval, waitlist, moderator, attachment, session/event, atau Circle notification.

Migration `202608090002` mengganti `list_study_circle_members`,
`list_study_circle_messages`, dan `report_study_circle_member` dengan nama variabel lokal
yang tidak ambigu. Signature, safe projection, `search_path = ''`, actor `auth.uid()`,
revoke `public`/`anon`, dan grant authenticated tetap dipertahankan. Live audit
mengonfirmasi ketiga RPC, report excerpt 280 karakter, direct-table denial, serta cleanup.

## 11. Campus Events v1 (migrations `202608090003`–`202608090004`, deployed)

Tables:

- `campus_events` — internal UUID, opaque `event-` public slug, organizer, title 5–100,
  description 20–1000, constrained category, `open | campus` scope, derived campus,
  `timestamptz` start/end, allowlisted display timezone, constrained public venue,
  capacity 3–30, `scheduled | cancelled | archived`, dan safety confirmation timestamp.
- `campus_event_rsvps` — private unique `(event_id, user_id)` row dengan status
  `going | cancelled`; organizer mendapat RSVP `going` saat create.
- `campus_event_audit_events` — sanitized lifecycle audit untuk create, edit, RSVP,
  cancel RSVP, cancel Event, archive, dan report tanpa data kontak/private-flow.
- `campus_event_rate_limits` — atomic actor/window counters untuk create, RSVP/cancel,
  edit, dan report.

RPC authenticated:

```text
list_campus_events
get_campus_event
create_campus_event
update_campus_event
rsvp_campus_event
cancel_campus_event_rsvp
cancel_campus_event
archive_campus_event
list_campus_event_attendees
report_campus_event
report_campus_event_organizer
```

Forward fix `202608090004` mempertahankan signature, grants, dan privacy projection
`get_campus_event`, tetapi menyelaraskan kolom `status` pada urutan `RETURN QUERY`.
Live audit A/B/C/D mengonfirmasi detail organizer/non-attendee/attendee, safe projection,
venue dan waktu, campus scope, exact final-slot concurrency, cancel/rejoin, block dan
Introduction, report evidence, cancel/archive, direct-table denial, zero automatic
private-flow/Event Notification writes, authenticated UI smoke, serta cleanup tanpa sisa.
Post-deploy migration dry-run kosong.

Semua table RLS-enabled dan direct grant dicabut dari `public`, `anon`, serta
`authenticated`. Capacity authoritative memakai row lock pada `campus_events` sebelum
menghitung RSVP `going`, sehingga upsert RSVP paralel diserialisasi. Scope kampus,
organizer, target RSVP, dan report context selalu diturunkan server-side.

Projection discovery/detail memuat metadata Event publik dan jumlah peserta nyata, bukan
daftar peserta. Projection attendee terbatas pada organizer atau RSVP `going` dan hanya
memuat `public_alias`, campus, study program, semester, interests/goals, genuine
verification boolean, organizer boolean, dan waktu RSVP. Pair yang diblokir tidak
diproyeksikan. Tidak ada nama, email, NIM, clear photo, kontak, UUID, atau private
connection/reveal state.

`user_reports` memperoleh reference Event, target kind `event | event_organizer`, serta
snapshot bounded title, description excerpt maksimal 280 karakter, dan venue publik.
Moderation Triage existing membaca hanya evidence report-scoped tersebut; tidak mendapat
broad attendee, Anonymous Chat, Identity Reveal, atau Contact Reveal access.

Cancellation mempertahankan RSVP dan evidence serta menolak RSVP baru. Archive hanya
setelah cancellation atau `end_at`; tidak ada restore. Selesai diturunkan dari waktu,
bukan status/cron. Waktu/timezone/venue tidak dapat berubah setelah RSVP aktif
non-organizer pertama; kapasitas tidak dapat turun di bawah RSVP aktif. Tidak ada
waitlist, approval, check-in, reminder, Event chat,
ticketing, pembayaran, arbitrary link, Circle association, atau Event notification pada
v1.

## 12. Planned meeting plans

```text
id
connection_id
created_by
meeting_type
public_location_name
public_location_category
starts_at
expected_end_at
status
created_at
```

Statuses: draft, public_location_pending, confirmed, checked_in, completed, cancelled, reported.

Jangan simpan precise personal location.

## 13. Future RLS principles

- pair-based rows hanya untuk participants;
- block enforced sebelum discovery/message;
- report hanya untuk reporter dan authorized moderation;
- attendee/participant data minimum;
- organizer tidak dapat export private contact;
- reveal output hanya setelah mutual consent;
- tidak ada broad authenticated SELECT atas private user data.

## 14. Migration discipline

Saat planned entity diimplementasikan:
1. update PRD scope;
2. create migration;
3. add constraints;
4. add RLS and grants;
5. add server validation;
6. add tests;
7. ubah status schema menjadi Implemented;
8. dokumentasikan live verification.
