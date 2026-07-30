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
