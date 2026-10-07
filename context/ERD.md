# StudyDate ID — Entity Relationship Diagram

> Updated: 7 October 2026

This document is a readable logical map of the StudyDate ID data model. It does not replace the exact SQL contract.

Sources of truth:

1. `supabase/migrations/` for tables, constraints, functions, RLS, and grants;
2. [SCHEMA.md](./SCHEMA.md) for detailed explanations and rollout notes;
3. this document for understanding relationships between product domains.

A table shown here may be repository-implemented without being active in production. Always verify the remote migration state before calling a capability live.

## 1. Identity, onboarding, and verification

```mermaid
erDiagram
    AUTH_USERS ||--o| PROFILES : owns
    AUTH_USERS ||--o| PRIVACY_PREFERENCES : configures
    AUTH_USERS ||--o{ USER_CONSENTS : accepts
    AUTH_USERS ||--o| ONBOARDING_ACADEMIC_CLAIMS : submits

    AUTH_USERS ||--o{ STUDENT_VERIFICATION_REQUESTS : requests
    STUDENT_VERIFICATION_REQUESTS ||--o{ CAMPUS_EMAIL_VERIFICATIONS : proves_ownership
    AUTH_USERS ||--o| LINKEDIN_VERIFICATION_LINKS : connects
    AUTH_USERS ||--o| STAFF_MEMBERS : may_be_staff

    AUTH_USERS {
        uuid id PK
        text email
    }
    PROFILES {
        uuid user_id PK
        text public_alias UK
        text first_name
        text campus
        text study_program
        text verification_status
        boolean is_discoverable
    }
    PRIVACY_PREFERENCES {
        uuid user_id PK
        boolean online_first
        boolean group_first
        boolean verified_users_only
    }
    USER_CONSENTS {
        uuid id PK
        uuid user_id FK
        text consent_type
        text policy_version
        timestamptz consented_at
    }
    ONBOARDING_ACADEMIC_CLAIMS {
        uuid user_id PK
        text nim_ciphertext
        text nim_fingerprint
        text nim_last_four
    }
    STUDENT_VERIFICATION_REQUESTS {
        uuid id PK
        uuid user_id FK
        text status
        text pddikti_result
        text ownership_result
        text academic_match_source
    }
    CAMPUS_EMAIL_VERIFICATIONS {
        uuid id PK
        uuid request_id FK
        text normalized_email
        text code_hash
        timestamptz verified_at
    }
    LINKEDIN_VERIFICATION_LINKS {
        uuid user_id PK
        text member_fingerprint
        boolean identity_verified
        boolean workplace_verified
    }
    STAFF_MEMBERS {
        uuid user_id PK
        text role
        text status
    }
```

Notes:

- `AUTH_USERS` represents Supabase `auth.users`.
- `profiles.first_name` is private application data and is not part of the People Discovery projection.
- NIM and legal-name claims use encrypted or fingerprinted storage where defined by the migrations.
- LinkedIn is an optional trust layer. It does not grant the student badge.
- Staff authorization requires trusted Auth metadata and an active `staff_members` row.
- `early_access_waitlist.claimed_user_id` may reference `auth.users.id`, but an Early Access entry is not a StudyDate account or a student verification.

## 2. Introduction and anonymous conversation

```mermaid
erDiagram
    AUTH_USERS ||--o{ INTRODUCTION_REQUESTS : sends
    AUTH_USERS ||--o{ INTRODUCTION_REQUESTS : receives
    INTRODUCTION_REQUESTS ||--o| CONVERSATION_SHELLS : opens
    CONVERSATION_SHELLS ||--o{ ANONYMOUS_MESSAGES : contains
    CONVERSATION_SHELLS ||--o{ CONVERSATION_EVENTS : records
    AUTH_USERS ||--o{ USER_BLOCKS : creates
    AUTH_USERS ||--o{ USER_REPORTS : submits

    INTRODUCTION_REQUESTS {
        uuid id PK
        uuid sender_id FK
        uuid recipient_id FK
        text opening_message
        text status
        timestamptz expires_at
    }
    CONVERSATION_SHELLS {
        uuid id PK
        uuid introduction_request_id FK
        text public_id UK
        text status
        timestamptz mutual_interest_at
        timestamptz identity_revealed_at
    }
    ANONYMOUS_MESSAGES {
        uuid id PK
        uuid conversation_id FK
        uuid sender_id FK
        text message_type
        text body
        text sticker_id
        timestamptz read_at
    }
    CONVERSATION_EVENTS {
        uuid id PK
        uuid conversation_id FK
        text event_type
        text event_channel
        timestamptz created_at
    }
    USER_BLOCKS {
        uuid blocker_id FK
        uuid blocked_id FK
        timestamptz created_at
    }
    USER_REPORTS {
        uuid id PK
        uuid reporter_id FK
        uuid conversation_id FK
        uuid anonymous_message_id FK
        text moderation_status
    }
```

Main lifecycle:

```text
pending introduction
→ accepted introduction
→ awaiting_chat conversation
→ active conversation
→ mutual interest
→ identity reveal
→ contact reveal per channel
```

The lifecycle is progressive. A completed step does not silently grant the next step.

## 3. Mutual Interest, Identity Reveal, and Contact Reveal

```mermaid
erDiagram
    CONVERSATION_SHELLS ||--o{ CONVERSATION_MUTUAL_INTERESTS : receives
    CONVERSATION_SHELLS ||--o{ IDENTITY_REVEAL_PROFILE_VERSIONS : scopes
    IDENTITY_REVEAL_PROFILE_VERSIONS ||--o{ IDENTITY_REVEAL_CONSENTS : selected_by
    CONVERSATION_SHELLS ||--o| CONVERSATION_IDENTITY_REVEALS : completes

    CONVERSATION_SHELLS ||--o{ CONVERSATION_CONTACT_VERSIONS : scopes
    CONVERSATION_CONTACT_VERSIONS ||--o{ CONTACT_REVEAL_CONSENTS : selected_by
    CONVERSATION_SHELLS ||--o{ CONVERSATION_CONTACT_REVEALS : completes

    CONVERSATION_MUTUAL_INTERESTS {
        uuid conversation_id FK
        uuid participant_id FK
        timestamptz selected_at
        timestamptz withdrawn_at
    }
    IDENTITY_REVEAL_PROFILE_VERSIONS {
        uuid id PK
        uuid conversation_id FK
        uuid owner_user_id FK
        int version_number
        text photo_object_key
    }
    IDENTITY_REVEAL_CONSENTS {
        uuid conversation_id FK
        uuid participant_id FK
        uuid profile_version_id FK
        timestamptz withdrawn_at
    }
    CONVERSATION_IDENTITY_REVEALS {
        uuid id PK
        uuid conversation_id FK
        uuid initiator_version_id FK
        uuid recipient_version_id FK
        timestamptz revealed_at
    }
    CONVERSATION_CONTACT_VERSIONS {
        uuid id PK
        uuid conversation_id FK
        uuid owner_user_id FK
        text channel
        text value_ciphertext
        int encryption_key_version
    }
    CONTACT_REVEAL_CONSENTS {
        uuid conversation_id FK
        uuid participant_id FK
        uuid contact_version_id FK
        text channel
    }
    CONVERSATION_CONTACT_REVEALS {
        uuid id PK
        uuid conversation_id FK
        text channel
        uuid initiator_contact_version_id FK
        uuid recipient_contact_version_id FK
    }
```

Privacy rules:

- Mutual Interest selections are private until both participants select them.
- Identity versions are scoped to one conversation and cannot be reused as global identity proof.
- Contact values are encrypted and scoped to one conversation and one channel.
- Telegram, Instagram, and LinkedIn complete independently.
- Blocking hides counterpart reveal data on future requests but cannot erase information already seen or captured.

## 4. Study Circles

```mermaid
erDiagram
    AUTH_USERS ||--o{ STUDY_CIRCLES : owns
    STUDY_CIRCLES ||--o{ STUDY_CIRCLE_MEMBERSHIPS : has
    AUTH_USERS ||--o{ STUDY_CIRCLE_MEMBERSHIPS : joins
    STUDY_CIRCLES ||--o{ STUDY_CIRCLE_MESSAGES : contains
    AUTH_USERS ||--o{ STUDY_CIRCLE_MESSAGES : writes
    STUDY_CIRCLES ||--o{ STUDY_CIRCLE_EVENTS : audits

    STUDY_CIRCLES {
        uuid id PK
        text public_slug UK
        uuid owner_user_id FK
        text name
        text topic
        text scope
        int member_limit
        text status
    }
    STUDY_CIRCLE_MEMBERSHIPS {
        uuid circle_id FK
        uuid user_id FK
        text role
        text status
        timestamptz joined_at
    }
    STUDY_CIRCLE_MESSAGES {
        uuid id PK
        uuid circle_id FK
        uuid author_user_id FK
        text public_id UK
        text body
        text moderation_status
    }
    STUDY_CIRCLE_EVENTS {
        uuid id PK
        uuid circle_id FK
        text event_type
        timestamptz created_at
    }
```

Joining a Circle does not create an introduction, private conversation, Identity Reveal, or Contact Reveal.

## 5. Campus Events

```mermaid
erDiagram
    AUTH_USERS ||--o{ CAMPUS_EVENTS : organizes
    STUDY_CIRCLES o|--o{ CAMPUS_EVENTS : may_group
    CAMPUS_EVENTS ||--o{ CAMPUS_EVENT_RSVPS : receives
    AUTH_USERS ||--o{ CAMPUS_EVENT_RSVPS : registers
    CAMPUS_EVENTS ||--o{ EVENT_TEAM_MEMBERS : delegates
    CAMPUS_EVENTS ||--o{ EVENT_REGISTRATION_QUESTIONS : asks

    CAMPUS_EVENT_RSVPS ||--o| CAMPUS_EVENT_TICKETS : issues
    CAMPUS_EVENTS ||--o{ CAMPUS_EVENT_MESSAGES : contains
    CAMPUS_EVENTS ||--o{ CAMPUS_EVENT_AUDIT_EVENTS : audits

    CAMPUS_EVENTS {
        uuid id PK
        text public_slug UK
        uuid organizer_user_id FK
        uuid study_circle_id FK
        text title
        text category
        text scope
        timestamptz starts_at
        int capacity
        text status
        text registration_mode
    }
    CAMPUS_EVENT_RSVPS {
        uuid id PK
        text public_id UK
        uuid event_id FK
        uuid user_id FK
        text status
        jsonb registration_answers
        timestamptz checked_in_at
    }
    EVENT_TEAM_MEMBERS {
        uuid id PK
        uuid event_id FK
        uuid user_id FK
        text role
        text status
    }
    EVENT_REGISTRATION_QUESTIONS {
        uuid id PK
        uuid event_id FK
        text public_id UK
        text label
        boolean required
    }
    CAMPUS_EVENT_TICKETS {
        uuid id PK
        uuid rsvp_id FK
        text ticket_hash UK
        timestamptz issued_at
        timestamptz revoked_at
    }
    CAMPUS_EVENT_MESSAGES {
        uuid id PK
        uuid event_id FK
        uuid author_user_id FK
        text public_id UK
        text body
    }
    CAMPUS_EVENT_AUDIT_EVENTS {
        uuid id PK
        uuid event_id FK
        text event_type
        timestamptz created_at
    }
```

Event registration, attendance, and check-in do not expose a participant's legal identity or contacts to other participants. Organizer and team projections remain limited to operational data allowed by the migrations.

## 6. Membership and billing

```mermaid
erDiagram
    MEMBERSHIP_PLANS ||--o{ USER_ENTITLEMENTS : grants
    AUTH_USERS ||--o{ USER_ENTITLEMENTS : owns
    AUTH_USERS ||--o{ MEMBERSHIP_QUOTA_USAGE : consumes
    MEMBERSHIP_BILLING_OFFER ||--o{ MEMBERSHIP_PAYMENT_ORDERS : prices
    AUTH_USERS ||--o{ MEMBERSHIP_PAYMENT_ORDERS : creates
    MEMBERSHIP_PAYMENT_ORDERS o|--o| USER_ENTITLEMENTS : finalizes

    MEMBERSHIP_PLANS {
        text code PK
        text name
    }
    USER_ENTITLEMENTS {
        uuid id PK
        uuid user_id FK
        text plan_code FK
        text status
        text source
        timestamptz starts_at
        timestamptz ends_at
    }
    MEMBERSHIP_QUOTA_USAGE {
        uuid user_id FK
        text quota_key
        timestamptz window_start
        int usage_count
    }
    MEMBERSHIP_BILLING_OFFER {
        text package_code PK
        int duration_days
        int amount
        boolean is_active
    }
    MEMBERSHIP_PAYMENT_ORDERS {
        uuid id PK
        text public_id UK
        uuid user_id FK
        text package_code FK
        int amount
        text status
        uuid entitlement_id FK
    }
```

Payment availability and database deployment are different states. The checkout kill switch and production payment audit still determine whether checkout may be offered.

## 7. Telegram Companion

```mermaid
erDiagram
    AUTH_USERS ||--o{ TELEGRAM_LINK_SESSIONS : starts
    AUTH_USERS ||--o| TELEGRAM_ACCOUNT_BINDINGS : binds
    TELEGRAM_ACCOUNT_BINDINGS ||--o| TELEGRAM_CONVERSATION_RELAYS : routes
    CONVERSATION_SHELLS ||--o{ TELEGRAM_CONVERSATION_RELAYS : targets
    ANONYMOUS_MESSAGES ||--o{ TELEGRAM_DELIVERY_OUTBOX : delivers
    TELEGRAM_UPDATE_RECEIPTS ||--o{ TELEGRAM_DELIVERY_OUTBOX : deduplicates

    TELEGRAM_LINK_SESSIONS {
        uuid id PK
        uuid user_id FK
        text token_hash
        text status
        timestamptz expires_at
    }
    TELEGRAM_ACCOUNT_BINDINGS {
        uuid user_id PK
        text identity_fingerprint UK
        text route_ciphertext
        timestamptz linked_at
        timestamptz revoked_at
    }
    TELEGRAM_CONVERSATION_RELAYS {
        uuid user_id PK
        uuid conversation_id FK
        timestamptz activated_at
    }
    TELEGRAM_UPDATE_RECEIPTS {
        bigint update_id PK
        timestamptz received_at
    }
    TELEGRAM_DELIVERY_OUTBOX {
        uuid id PK
        uuid message_id FK
        uuid recipient_user_id FK
        text status
        int retry_count
    }
```

Telegram is a transport for an existing StudyDate Anonymous Chat. It must not become a second identity system or reveal Telegram metadata to the other participant.

## 8. Notifications, moderation, and account lifecycle

Core supporting tables include:

| Domain | Main tables | Purpose |
|---|---|---|
| Notifications | `user_notifications`, notification preferences | Recipient-scoped in-app alerts without private message content |
| Safety | `user_blocks`, `user_reports`, `moderation_report_events` | Block, report, and sanitized moderation lifecycle |
| Staff | `staff_members`, `staff_role_events` | Trusted role, capabilities, and append-only role audit |
| Account deletion | `account_deletion_requests`, `account_privacy_policy`, `account_deletion_audit_events` | Privacy lock, bounded cleanup, retention, and sanitized audit |
| Rate limits | Feature-specific rate-limit tables | Durable abuse and quota boundaries |
| Verification audit | `verification_events` | Sanitized verification lifecycle without evidence payload |
| Reveal media cleanup | `identity_reveal_photo_cleanup_queue` | Retry-safe cleanup of private reveal photos |

These supporting entities are intentionally not connected into every diagram. Their foreign keys and security rules must be checked in the exact migration before implementation work.

## 9. Data exposure zones

| Zone | Examples | Client access rule |
|---|---|---|
| Public or anonymous-safe | landing content, opaque public slugs, bounded Event metadata | Only explicitly approved public output |
| Authenticated safe projection | People cards, Circle members, Event attendees, notification rows | RPC projection with no raw UUID or private data |
| Participant-private | introductions, Anonymous Chat, reveal state, meeting plans | Only eligible participants |
| User-private | preferences, verification status, LinkedIn connection status, membership | Only the owning user through approved RPC or RLS |
| Staff-restricted | verification evidence, moderation queue, account support | Capability-based and audited |
| Service-only | encryption operations, provider callbacks, payment finalization, deletion workers | Server or service-role only |

## 10. Maintenance rule

Update this file when a change adds, removes, or materially changes a core relationship. Also update:

- [SCHEMA.md](./SCHEMA.md) for exact entity behavior;
- [PRD.md](./PRD.md) for product behavior;
- [ARCHITECTURE.md](./ARCHITECTURE.md) for service boundaries;
- tests and migration documentation for rollout evidence.

Do not update the ERD first and treat it as database implementation. The migration, security policy, server validation, tests, and controlled rollout must exist separately.
