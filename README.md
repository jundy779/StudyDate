# StudyDate ID

StudyDate ID helps students find study partners, small circles, and campus events without immediately sharing their
real name or personal contact details. A conversation starts only after an introduction is accepted, and identity or
contact details are shared gradually with mutual consent.

## Agent context

Any coding agent must read the project context in this order before changing code, migrations, dependencies, or UI:

1. [`context/RULES.md`](context/RULES.md)
2. [`context/PRD.md`](context/PRD.md)
3. [`context/ARCHITECTURE.md`](context/ARCHITECTURE.md)
4. [`context/SCHEMA.md`](context/SCHEMA.md)
5. [`context/DESIGN.md`](context/DESIGN.md)

These documents are the primary product and engineering context, but agents must still inspect the actual repository
before editing. When code and documentation conflict, stop, inspect the implementation, and report the conflict instead
of guessing. New product decisions should update the relevant context in the same commit.

The current source-side First Meet Beta RC record is [`docs/operations/beta-rc-2026-08-25.md`](docs/operations/beta-rc-2026-08-25.md). It records validation evidence and deployment boundaries without treating repository migrations as already applied remotely.

The approved landing page, Early Access waitlist, and auth/onboarding foundation must not be redesigned without explicit
instruction.

## Developer guide

### Product overview

StudyDate has a defined product stack:

- **MVP core loop** — People → Introduction → Anonymous Chat → Mutual Interest → Identity Reveal → Contact Reveal.
- **Growth loops** — Study Circles and Campus Events create more reasons to return and start a connection.
- **Trust layer** — consent, block, report, privacy controls, account deletion, and verification only when its rollout is active.
- **Business model** — StudyDate Free for the core experience and StudyDate Plus for additional capacity or convenience. Safety and privacy are never paywalled.

Repository implementation does not automatically mean a capability is live. Features that depend on remote migrations,
secrets, webhooks, schedulers, or operational review must be verified in the target environment before being described
as active.

### Technology stack

- Next.js 16.3.0 with the App Router
- React and React DOM 19.2.8
- TypeScript 5
- Tailwind CSS 3.4.1
- Supabase Auth and PostgreSQL through `@supabase/ssr` and `@supabase/supabase-js`
- Zod 4.4.3 for server-side validation
- Accessible semantic controls and existing Radix UI primitives

### Current implementation status

Implemented:

- Public landing page
- Early Access waitlist with moderation, invitation, revision reasons, one-time correction links, and account claim
- Passwordless email authentication
- Supabase PKCE callback
- Protected `/onboarding` and `/app` routes
- Four-step student onboarding
- Server-generated anonymous public alias
- Privacy preferences
- Versioned consent records
- Minimal authenticated `/app` page
- Privacy-safe People Discovery v1 at `/app/people`
- Introduction Requests v1 at `/app/introductions` with send/accept/decline/cancel, block/report foundation, and
  conversation shell handoff
- Anonymous Chat v1 at `/app/messages` (deployed through migration `202608060003`); local migration
  `202608250001` adds Unicode emoji composer support and allowlisted official StudyDate mascot stickers with a
  legacy-safe text fallback. The sticker migration must be applied before enabling sticker sends.
- Mutual Interest v1 inside active conversations (migration `202608060004`)
- Identity Reveal v1 (migration `202608060005`)
- Contact Reveal v1 for Telegram / Instagram / LinkedIn after Identity Reveal
  (migrations `202608060006`–`202608060007`)
- Notifications v1 privacy-safe in-app UI (migration `202608070013`, applied remotely
  after controlled preflight and live A/B/C audit)
- Study Circle v1 at `/app/circles` with privacy-safe membership, group discussion,
  Introduction handoff, block/report integration, and deployed migrations
  `202608090001`–`202608090002`
- Campus Events v1 deployed at `/app/events` with public-place-only venues,
  atomic-capacity RSVP, private attendee projection, Introduction/block/report reuse, and
  migrations `202608090003`–`202608090004`
- Account & Privacy Controls v1 at `/app/settings` for bounded profile editing,
  People visibility, own-block management, session basics, privacy summary, and
  an immediate privacy-lock deletion request. Migrations `202608100001`–
  `202608100003` are deployed and live-verified; they implement retryable
  server-only cleanup, shared-history tombstones, Circle/Event policy, and
  Auth-last finalization.
- Telegram Anonymous Chat Companion v1 is implemented in the repository behind
  `TELEGRAM_COMPANION_ENABLED=false`: two-step web-confirmed linking,
  private text-only bot ingress, one active relay conversation per user,
  encrypted routing, update dedupe, durable outbox, and a protected delivery
  runner. Remote migration state, production secrets, webhook, scheduler, and
  a controlled real-bot audit must be verified before enabling it.
- PDDIKTI Academic Lookup + Manual Verification Fallback v1 database migration
  is **DEPLOYED** behind both `STUDENT_VERIFICATION_ENABLED=false` and
  `PDDIKTI_LOOKUP_PROVIDER_ENABLED=false`. It adds a replaceable server-only
  provider adapter, exact academic matching, private/re-encoded screenshot
  fallback, and academic-only reviewer actions. Migration `202608110003` is
  synchronized with the StudyDate project; controlled rollout has not started
  and automated/live audits did not call the real provider.
- Staff Roles and Admin Shell v1 with `/staff/login`, `/owner`, and `/admin/verifications`
- Server-side sign-out

Not implemented yet:

- WhatsApp, phone, email, X/Twitter, Discord, Facebook contact reveal
- Production Telegram webhook configuration and controlled real-bot audit
- Full moderation dashboard
- Push, browser Web Push, email, SMS, WhatsApp, Telegram bot, or native notifications
- Supabase Realtime chat delivery (v1 uses authenticated RPC polling)

Student Verification Center code exists but remains globally disabled unless explicitly enabled for controlled testing.

### Local requirements

- Node.js 22.6.0 or newer. Next.js itself supports older Node 20 releases, but this repository's TypeScript test commands use Node's `--experimental-strip-types` support.
- npm
- A dedicated Supabase project for StudyDate
- Supabase CLI when linking or applying migrations
- Two accessible test email inboxes for live authentication and RLS testing

Use test inboxes rather than primary personal email accounts when possible.

### Local setup

From PowerShell in the project directory:

```powershell
npm install
Copy-Item .env.example .env.local
```

Open `.env.local` and fill every required value manually. Do not paste real credentials into documentation, commits,
issues, screenshots, or chat.

Start the development server:

```powershell
npm run dev
```

Open [http://localhost:3010](http://localhost:3010).

If `.env.local` already exists, do not overwrite it. Verify the required variable names and fill only missing values.

### Environment variables

| Variable | Required | Used by | Description | Visibility |
|---|---:|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser and server Supabase clients | URL of the dedicated StudyDate Supabase project | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Browser and server Supabase clients | Supabase publishable or legacy anonymous key | Public |
| `NEXT_PUBLIC_SITE_URL` | Yes | Auth magic-link creation | Trusted application origin used to build the callback URL | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for Early Access | Server-side Early Access route only | Privileged key used for controlled waitlist insertion | Secret |

Any value with a `NEXT_PUBLIC_` prefix is bundled for the browser and must never contain a secret. The service-role key
must remain server-only and must never be renamed with a `NEXT_PUBLIC_` prefix.

### Supabase project setup

Create or select a **dedicated StudyDate Supabase project**. Do not apply StudyDate migrations to an unrelated project.

Log in and link the CLI using placeholders only:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_STUDYDATE_PROJECT_REF
npx supabase migration list
```

Obtain the project reference from the Supabase Dashboard project settings. Before running any command that changes the
remote database, verify:

- Project name
- Project reference
- Organization
- Existing migration history
- Exact local migrations about to be applied

Linking the wrong project can expose or modify unrelated production data.

### Database migrations

StudyDate migrations must be applied in this order:

1. `supabase/migrations/202607300001_create_early_access_waitlist.sql`
2. `supabase/migrations/202607300002_create_auth_onboarding_foundation.sql`
3. `supabase/migrations/202607310001_create_student_verification_center.sql`
4. `supabase/migrations/202607310002_refine_academic_verification.sql`
5. `supabase/migrations/202607310003_harden_verification_cleanup.sql`
6. `supabase/migrations/202607310004_create_people_discovery.sql`
7. `supabase/migrations/202607310005_create_staff_roles_and_admin_shell.sql`
8. `supabase/migrations/202608060001_create_introduction_requests_v1.sql`
9. `supabase/migrations/202608060002_fix_introduction_rpc_volatility.sql`
10. `supabase/migrations/202608060003_create_anonymous_chat_v1.sql`

Only after the linked project has been manually verified:

```powershell
npx supabase db push
npx supabase migration list
```

> **Warning:** Both commands communicate with the linked remote project, and `db push` modifies its database.
> Review the target and migration plan before continuing.

Current Beta-RC local tail also includes `202608250001_anonymous_chat_official_stickers_v1.sql` and `202608250002_early_access_moderation_invitation_v1.sql`. Do not infer remote status from this README; compare `supabase migration list` before any push. For the Early Access rollout, apply `202608250002` before deploying the app code that calls `can_issue_student_magic_link`.

### Supabase Auth configuration

Configure Supabase Dashboard → Authentication:

- Enable Email authentication.
- Set Site URL to `http://localhost:3010` for local development (must match `npm start` / `NEXT_PUBLIC_SITE_URL`).
- Add local redirect URL: `http://localhost:3010/auth/callback` and `http://localhost:3010/auth/confirm`.
- Add production redirect URL: `https://YOUR_DOMAIN/auth/callback` and `https://YOUR_DOMAIN/auth/confirm`.
- Magic-link **email delivery is owned by StudyDate** (SMTP or Resend). Do not rely on Supabase Auth’s built-in mailer for product login emails.

Set the same production origin in `NEXT_PUBLIC_SITE_URL`. The production application should use HTTPS.

### Authentication flow

1. A new Beta user first submits the public Early Access form and waits for review.
2. Owner or an explicitly authorized Early Access reviewer approves the entry; StudyDate sends a branded one-time login email.
3. `/auth/confirm` / `/auth/callback` establishes the cookie-backed session.
4. For a not-yet-onboarded user, callback/onboarding requires a same-email approved Early Access claim before continuing.
5. A user with completed onboarding continues to `/app`; existing completed accounts can still request normal login links.

The public login endpoint returns an enumeration-safe success response when a brand-new email is not approved and does not create an Auth account in that case. Early Access approval is separate from Student/Alumni Verification.

Callback redirects accept only trusted internal destinations. Authentication errors shown to users are generic and do
not expose Supabase error details.

Staff use the same Supabase Auth system through `/staff/login`, with account creation disabled. After PKCE callback,
the server requires matching trusted `app_metadata` and an active `staff_members` row. Owner goes to `/owner`, active
admin reviewer goes to `/admin/verifications`, and non-staff goes safely to `/app`. Staff should use dedicated accounts.

The first owner has no public registration flow. After the staff migration is explicitly approved and applied, a
trusted operator may export the required server environment variables and run `npm run staff:bootstrap-owner`. The
script asks for the existing Auth email interactively, requires exactly one match, prints only a masked email and UUID
suffix, and pauses for explicit confirmation before calling the service-role-only UUID bootstrap RPC. Never commit the
email or use it in authorization checks. This repository task does not execute that bootstrap.

### Onboarding flow

The onboarding form has four steps:

1. Basic student introduction
2. Interests and connection goals
3. Comfort and privacy preferences
4. Terms, Privacy, and Community Guidelines consent

The public alias uses the format `Partner #NNNNNN`, is generated server-side with cryptographically secure randomness,
and retries on collisions. Verification starts as `unverified`, discoverability remains `false`, and completion is
persisted through an atomic database RPC.

### Database security

- Row Level Security is enabled on private onboarding tables.
- Users can read only their own complete private profile.
- There is no broad authenticated `SELECT` policy over complete profiles.
- Normal clients cannot set their verification status.
- Normal clients cannot activate discoverability.
- Normal clients cannot edit their anonymous alias.
- Consent timestamps cannot be rewritten through a normal client.
- Profile, preferences, and required consents are created through a controlled RPC.
- Service-role access is server-only.
- Staff role checks require matching Auth `app_metadata` and active protected `staff_members` state.
- `user_metadata`, client bodies, URLs, local storage, and UI visibility never grant staff access.
- Active staff are excluded from People at the database RPC and cannot enable discoverability.

People Discovery uses dedicated authenticated RPCs with an explicit safe projection rather than exposing the complete
`profiles` table. Eligible rows require completed onboarding and user opt-in, exclude the current user, and expose
neither private names, auth email, contacts, NIM, nor internal user IDs.

Introduction Requests v1 uses alias-based SECURITY DEFINER RPCs for send/accept/decline/cancel, durable database rate
limits, private `user_blocks`/`user_reports`, and an `awaiting_chat` conversation shell on accept. Participant UUIDs are
not exposed in rendered student routes.

Anonymous Chat v1 (migration `202608060003`) adds opaque conversation `public_id`, `anonymous_messages`,
end/block/report RPCs, and authenticated polling.

Mutual Interest v1 (migration `202608060004`) adds private “Kenal Lebih Jauh” consent inside an active
conversation. One-sided interest is never exposed. Mutual completion does not reveal identity or contacts.

### Early Access moderation + invitation

The Early Access flow includes:

- Server-side waitlist insertion with case-insensitive duplicate handling
- Consent version/timestamp, honeypot, bounded payload, and durable DB-backed rate limiting
- One shared moderation queue at `/owner/early-access` and `/staff/early-access`
- Owner role-implied full Early Access access; Staff read/review capabilities are explicit and least-privilege
- Lifecycle `waiting → approved|needs_revision|rejected`; only `approved → claimed` with the same authenticated email
- `needs_revision` stores structured reason codes, keeps internal notes separate, and sends a hashed one-time revision link; corrected submissions return to `waiting`
- Branded StudyDate one-time invitation email after Approve, with safe resend when delivery fails
- New-account student magic-link eligibility gate that remains enumeration-safe to public callers
- Claim before onboarding; Early Access approval never substitutes Student/Alumni Verification or legal/product consent
- RLS/revoked direct table permissions; review and claim occur through server-authoritative RPCs

`202608250002_early_access_moderation_invitation_v1.sql` is forward-only and must be migration-preflighted before app deployment. Deploy the database contract first because the public magic-link gate fails closed when the new RPC is unavailable.

`202608260001_early_access_revision_reasons_v1.sql` extends review outcomes with `needs_revision`, structured applicant-facing reasons, private internal notes, branded rejection/revision email, and a SHA-256-hashed one-time correction token. Apply this migration before deploying the revision UI/actions.

### Available scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run test:auth` | Run auth, onboarding, migration, and security unit/static tests |
| `npm run test:verification` | Run Student Verification security and readiness tests |
| `npm run test:pddikti` | Run PDDIKTI provider, exact-match, upload, and privacy contracts without network calls |
| `npm run test:pddikti:browser` | Audit local verification lookup UI across five viewports |
| `npm run test:people` | Run People Discovery validation, projection, and authorization tests |
| `npm run test:staff` | Run staff-role, bootstrap, route-guard, audit, and reviewer authorization tests |
| `npm run test:introductions` | Run Introduction Requests validation, projection, and authorization tests |
| `npm run test:messages` | Run Anonymous Chat validation, projection, and authorization tests |
| `npm run test:mutual` | Run Mutual Interest validation, privacy, and authorization tests |
| `npm run test:identity-reveal` | Run Identity Reveal static, behavioral, and hydrate tests |
| `npm run test:contact-reveal` | Run Contact Reveal static contract and behavioral tests |
| `npm run test:notifications` | Run Notifications v1 static/privacy/behavioral tests |
| `npm run test:circles` | Run Study Circle privacy, abuse, projection, and lifecycle tests |
| `npm run test:events` | Run Campus Events safety, privacy, RSVP, concurrency, and lifecycle tests |
| `npm run test:account-privacy` | Run Account & Privacy settings, block, projection, deletion-gate, and lifecycle tests |
| `npm run test:telegram` | Run Telegram Companion webhook, linking, relay, delivery, privacy, unlink, and deletion contracts |
| `npm run test:telegram:browser` | Audit local Telegram Companion states and dialog accessibility across five viewports |
| `npm run test:account-privacy:browser` | Audit authenticated settings responsiveness and deletion-dialog accessibility; requires `ACCOUNT_PRIVACY_AUDIT_STORAGE_STATE` |
| `npm run account-deletions:process -- --limit=10` | Process bounded account-deletion jobs from a trusted server runner |
| `npm run telegram-outbox:process -- --limit=25` | Manually recover bounded Telegram outbox jobs; production uses the protected Vercel Cron runner |
| `npm run pddikti-provider:smoke -- <query>` | Optional Owner-approved real-provider smoke; never run in automated tests |
| `npm run staff:bootstrap-owner` | Interactive trusted first-owner bootstrap; run only after approved migration |
| `npm run test:browser` | Audit login responsiveness, overflow, and keyboard focus with Chrome |
| `npm run check` | Run lint, typecheck, and production build |
| `npm run verify:release` | Run lint, typecheck, all Node tests, and production build before a release candidate |

`npm run test:browser` expects Google Chrome at its default Windows location unless `CHROME_PATH` is supplied.

### Validation before committing

Run the complete release gate when dependencies are installed:

```powershell
npm run verify:release
```

Feature-specific and browser/live audits still require their own controlled environment. For targeted development validation, run:

```powershell
npm run lint
npm run typecheck
npm run test:auth
npm run test:verification
npm run test:people
npm run test:staff
npm run test:introductions
npm run test:messages
npm run test:mutual
npm run test:identity-reveal
npm run test:contact-reveal
npm run test:moderation
npm run test:notifications
npm run test:circles
npm run test:events
npm run test:account-privacy
npm run test:browser
npm run build
git status --short
git check-ignore .env.local
```

Confirm that `.env.local` is ignored and no generated screenshots, test credentials, tokens, or secret values are
staged.

### Notifications v1

Migration `202608070013_create_notifications_v1.sql` adds recipient-scoped in-app
notifications for Introduction received/accepted, Anonymous Chat messages, completed
Mutual Interest, completed Identity Reveal, and completed Contact Reveal per Telegram,
Instagram, or LinkedIn. It was applied remotely after an exact single-migration dry-run;
the post-push history is synchronized and a repeat dry-run reports no pending changes.

One-sided Mutual selection/withdrawal, Identity preparation/consent/withdrawal, and
Contact preparation/consent/withdrawal intentionally create no notification. Message
bodies, names, contact values, email, NIM, raw UUIDs, Storage paths, report details, and
moderation notes are not part of the notification projection.

Notifications use bounded keyset pagination and a 45-second authenticated global unread
poll that pauses while the document is hidden. Chat polling uses adaptive authenticated polling that slows while idle, pauses when hidden/offline, and resumes on visibility/network recovery.

The post-deployment live audit verifies A/B/C recipient isolation, direct-table denial,
trusted trigger creation, deterministic deduplication, read-one/read-all behavior, all
three contact channels, one-sided consent silence, safe projection, blocked-history
privacy, and complete synthetic-account cleanup.

### Study Circle v1 (deployed)

Migration `202608090001_create_study_circles_v1.sql` adds direct-join Study Circles with
`open` or same-campus scope, owner-only Circle management, `active | left | removed`
membership, member-only plain-text discussion, atomic abuse counters, and report-scoped
moderation evidence. Migration `202608090002_fix_study_circle_rpc_ambiguity.sql` replaces
three affected RPCs after the first live pass exposed a PL/pgSQL `circle_id` ambiguity.
Both migrations are synchronized remotely.

Routes are `/app/circles`, `/app/circles/create`, and
`/app/circles/<opaque-public-slug>`. Member projections reuse only safe People fields;
legal name, first name, email, NIM, clear reveal photos, contacts, UUIDs, and private
connection state are excluded.

Circle membership never creates Anonymous Chat, Mutual Interest, Identity Reveal, or
Contact Reveal. Member-to-member introductions call the existing Introduction eligibility
and send flow, including block, staff exclusion, cooldown, rate limit, and discoverability
rules. Blocked members may still see existing member-authorized group history, while direct
Introduction affordances remain unavailable.

V1 deliberately has no moderator role, approval queue, waitlist, group attachments,
events/sessions, popularity ranking, online state, or Circle notifications. Archiving
prevents new joins and messages while preserving member-readable history and moderation
evidence. Student Verification remains globally disabled and is not a Circle prerequisite.

The post-deployment A/B/C/D audit verifies open and campus discovery, direct join,
idempotency, leave/rejoin, owner removal/edit/archive, member-only discussion, contact
filtering, all three report contexts, Introduction and block integration, RLS/direct-grant
denial, safe rendered payloads, zero automatic private-flow side effects, Notification
silence for Circle operations, authenticated UI smoke, and complete synthetic cleanup.

### Campus Events v1 baseline (deployed)

> Bagian ini mencatat baseline peluncuran v1. Kemampuan yang kemudian ditambahkan oleh Event v2 dirangkum setelah section ini.

Migrations `202608090003_create_campus_events_v1.sql` and
`202608090004_fix_campus_event_detail_projection.sql` are applied remotely. They add open
or same-campus Events with opaque routes, `timestamptz` scheduling, constrained
public-place venues, required server-side safety affirmations, atomic RSVP capacity,
sanitized audit events, and report-scoped Moderation Triage evidence.

Routes are `/app/events`, `/app/events/create`, and
`/app/events/<opaque-public-slug>`. Discovery exposes real attendee counts, while the safe
attendee list is limited to the organizer and active attendees. Co-attendance does not
create an Introduction, conversation, Mutual Interest, Identity Reveal, Contact Reveal,
or Notification; `Kirim perkenalan` reuses the existing private Introduction flow.

V1 uses `scheduled | cancelled | archived` Events and `going | cancelled` RSVP. Capacity
is 3–30 and authoritative RSVP serializes on the Event row before counting active seats.
Cancelled RSVP may rejoin if eligible; cancelled/archived Events cannot accept RSVP.
Time, timezone, and venue are frozen after the first non-organizer RSVP because v1 does
not emit update notifications; capacity still cannot drop below active RSVP.
There is no waitlist, ticketing, payment, check-in, Event chat, arbitrary link, Circle
association, recommendation ranking, or Event notification. Student Verification remains
globally disabled and is not an Event prerequisite.

The live synthetic A/B/C/D audit verifies venue and timestamp rejection, open/campus
discovery, safe detail and attendee projections, exact final-slot concurrency, RSVP
cancel/rejoin, block and Introduction behavior, schedule/venue locking, organizer/staff
isolation, scoped reports, cancel/archive retention, RLS/direct-grant denial, zero
automatic private-flow or Event Notification writes, authenticated UI smoke, and complete
cleanup. The post-deployment migration dry-run is empty.


### Campus Events v2 (current repository)

Repository saat ini melanjutkan baseline v1 dengan organizer registration, approval/instant registration, waitlist,
Event chat, Circle association, scoped team roles, attendee ticket, QR check-in, manual fallback, dan operational
management routes. Migration utama v2 berada pada `202608210003`–`202608210010`, `202608220002`–`202608220003`,
dan fix `202608240001`. Status migration remote harus selalu diverifikasi dengan `supabase migration list` sebelum
menyebut capability v2 sebagai live pada environment tertentu.

QR scanner memakai kamera browser hanya pada origin StudyDate dan tetap menyediakan fallback manual. Global
`Permissions-Policy` mengizinkan `camera=(self)` serta tetap menolak microphone, geolocation, dan payment browser
permissions.

### Live Supabase verification checklist

The following require a verified Supabase project, real credentials, and two accessible test accounts. Do not mark them
as passed until they have actually been tested:

- [ ] Real email delivery
- [ ] PKCE code exchange
- [ ] New-user redirect to `/onboarding`
- [ ] Onboarded-user redirect to `/app`
- [ ] Atomic onboarding RPC
- [ ] Transaction rollback without partial rows
- [ ] RLS testing with Account A and Account B
- [ ] Protected-field update rejection
- [ ] Session refresh on protected pages
- [ ] Server-side sign-out and cookie clearing
- [ ] Real Early Access insertion
- [ ] Duplicate Early Access friendly response

### Security notes

- Never commit `.env.local`.
- Never expose the service-role key.
- Never paste magic links, OTPs, access tokens, refresh tokens, database passwords, or test-account inbox contents into
  issues, commits, screenshots, or chat.
- Never run migrations against an unverified project.
- Verify the linked project before every remote migration operation.
- Use dedicated test accounts rather than primary personal email accounts when possible.
