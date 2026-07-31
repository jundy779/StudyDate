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

### `student_verification_requests`

Menyimpan claim verifikasi, status review, consent version, dan lifecycle evidence. NIM serta nama legal memakai
AES-256-GCM application encryption; duplicate detection memakai keyed HMAC fingerprint. Authenticated user hanya
mendapat projection status yang tersanitasi melalui column grants dan owner-scoped RLS.

Request status: pending, under_review, needs_action, verified, rejected, expired, cancelled.
PDDikti result: not_checked, matched, not_found, mismatch, unavailable.
Ownership result: not_checked, campus_email_verified, document_verified, failed.

Constraint database menolak status `verified` kecuali PDDikti `matched` dan ownership telah diverifikasi.

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

## 5. Planned privacy-safe People output

Jangan expose full `profiles`. Gunakan dedicated view/RPC yang hanya mengembalikan:
```text
public_alias
blurred_avatar
campus
study_program
semester
short_intro
interests
connection_goals
verification_status
```

Jangan return first_name, email, auth metadata, contact, precise location, atau internal user ID bila tidak diperlukan.

## 6. Planned introductions

### `introductions`
```text
id uuid primary key
sender_id uuid
recipient_id uuid
message text
status text
created_at timestamptz
replied_at timestamptz null
expired_at timestamptz null
```

Statuses: pending, replied, skipped, reported, expired.

Rules: one active per pair, no resend after skipped, bounded message, no links/contact before reveal, report available.

## 7. Planned conversations

### `conversations`
```text
id uuid primary key
introduction_id uuid unique
participant_a_id uuid
participant_b_id uuid
status text
created_at timestamptz
ended_at timestamptz null
```

Statuses: anonymous_active, ended, blocked, under_review.

### `messages`
```text
id uuid primary key
conversation_id uuid
sender_id uuid
body text
moderation_status text
created_at timestamptz
```

Jangan simpan/expose Telegram forwarding metadata.

## 8. Planned reveal

### `connection_interests`
```text
connection_id
user_id
interested_at
withdrawn_at null
```

### `reveal_requests`
```text
id uuid primary key
connection_id uuid
reveal_type text
requester_id uuid
recipient_id uuid
requester_consented_at timestamptz
recipient_consented_at timestamptz null
revealed_at timestamptz null
revoked_at timestamptz null
```

Reveal types: identity_basic, telegram, instagram, whatsapp, email, full_name.

Setiap contact type terpisah. Jangan pakai global reveal flag.

## 9. Planned blocks and reports

`user_blocks` mencegah discovery, introduction, message, dan invitation.

`reports` dapat mereferensikan user, introduction, conversation, group, atau event. Report detail bersifat privat.

## 10. Planned Groups

Possible tables: groups, group_memberships, group_join_requests, group_sessions, group_reports.

Membership: requested, approved, waitlisted, declined, left, removed.

Visibility: public, unlisted, campus_only, invite_only.

Contact list peserta privat.

## 11. Planned Events

Possible tables: events, event_registrations, event_waitlist, event_checkins, event_reports, organizer_profiles.

Registration: registered, waitlisted, approved, checked_in, cancelled, attended, no_show.

Attendee list privat secara default.

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
