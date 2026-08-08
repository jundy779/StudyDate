# StudyDate ID

StudyDate ID is a privacy-first student connection platform for discovering people, small groups, and campus events.
Connections begin through private introductions and can develop gradually with mutual consent.

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

The approved landing page, Early Access waitlist, and auth/onboarding foundation must not be redesigned without explicit
instruction.

## Developer guide

### Product overview

StudyDate is organized around three product pillars:

- **People** — discover students through shared context while keeping private identity data protected.
- **Groups** — join small campus groups, Study Circles, and Open Tables.
- **Campus Events** — discover seminars, workshops, communities, study gatherings, competitions, and career events.

Connections begin with a private introduction before anonymous chat. Identity is revealed progressively, and every
contact type requires separate mutual consent. Interaction is online-first; offline meetings are allowed only in public
locations.

### Technology stack

- Next.js 16.2.12 with the App Router
- React and React DOM 19.2.8
- TypeScript 5
- Tailwind CSS 3.4.1
- Supabase Auth and PostgreSQL through `@supabase/ssr` and `@supabase/supabase-js`
- Zod 4.4.3 for server-side validation
- Accessible semantic controls and existing Radix UI primitives

### Current implementation status

Implemented:

- Public landing page
- Early Access waitlist
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
- Anonymous Chat v1 at `/app/messages` (deployed through migration `202608060003`)
- Mutual Interest v1 inside active conversations (migration `202608060004`)
- Identity Reveal v1 (migration `202608060005`)
- Contact Reveal v1 for Telegram / Instagram / LinkedIn after Identity Reveal
  (migrations `202608060006`–`202608060007`)
- Notifications v1 privacy-safe in-app UI (migration `202608070013`, applied remotely
  after controlled preflight and live A/B/C audit)
- Study Circle v1 at `/app/circles` with privacy-safe membership, group discussion,
  Introduction handoff, block/report integration, and local-only migration `202608090001`
- Staff Roles and Admin Shell v1 with `/staff/login`, `/owner`, and `/admin/verifications`
- Server-side sign-out

Not implemented yet:

- WhatsApp, phone, email, X/Twitter, Discord, Facebook contact reveal
- Campus Events
- Telegram bot linking
- Full moderation dashboard
- Push, browser Web Push, email, SMS, WhatsApp, Telegram bot, or native notifications
- Supabase Realtime chat delivery (v1 uses authenticated RPC polling)

Student Verification Center code exists but remains globally disabled unless explicitly enabled for controlled testing.

### Local requirements

- Node.js 20.9.0 or newer, as required by the installed Next.js version
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

Open [http://localhost:3000](http://localhost:3000).

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
6. `supabase/migrations/202607310004_create_people_discovery.sql` (local-only until a separate approved preflight)
7. `supabase/migrations/202607310005_create_staff_roles_and_admin_shell.sql` (local-only; do not apply without approval)
8. `supabase/migrations/202608060001_create_introduction_requests_v1.sql`
9. `supabase/migrations/202608060002_fix_introduction_rpc_volatility.sql`
10. `supabase/migrations/202608060003_create_anonymous_chat_v1.sql` (local-only; do not apply without approval)

Only after the linked project has been manually verified:

```powershell
npx supabase db push
npx supabase migration list
```

> **Warning:** Both commands communicate with the linked remote project, and `db push` modifies its database.
> Review the target and migration plan before continuing.

### Supabase Auth configuration

Configure Supabase Dashboard → Authentication:

- Enable Email authentication.
- Set Site URL to `http://localhost:3010` for local development (must match `npm start` / `NEXT_PUBLIC_SITE_URL`).
- Add local redirect URL: `http://localhost:3010/auth/callback` and `http://localhost:3010/auth/confirm`.
- Add production redirect URL: `https://YOUR_DOMAIN/auth/callback` and `https://YOUR_DOMAIN/auth/confirm`.
- Magic-link **email delivery is owned by StudyDate** (SMTP or Resend). Do not rely on Supabase Auth’s built-in mailer for product login emails.

Set the same production origin in `NEXT_PUBLIC_SITE_URL`. The production application should use HTTPS.

### Authentication flow

1. The user submits an email on `/login`.
2. Supabase sends a passwordless link.
3. `/auth/callback` exchanges the PKCE code and establishes the cookie-backed session.
4. A new authenticated user without completed onboarding goes to `/onboarding`.
5. A user with completed onboarding goes to `/app`.

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

### Early Access waitlist

The Early Access flow includes:

- Server-side insertion
- Case-insensitive duplicate handling
- Consent version and timestamp recording
- Honeypot validation
- Request payload limit
- Basic in-memory rate limiting
- RLS and revoked table permissions preventing public waitlist reads

The current rate limiter is in-memory and per application instance. Replace it with durable shared rate limiting before
serving large or horizontally scaled production traffic.

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
| `npm run test:people` | Run People Discovery validation, projection, and authorization tests |
| `npm run test:staff` | Run staff-role, bootstrap, route-guard, audit, and reviewer authorization tests |
| `npm run test:introductions` | Run Introduction Requests validation, projection, and authorization tests |
| `npm run test:messages` | Run Anonymous Chat validation, projection, and authorization tests |
| `npm run test:mutual` | Run Mutual Interest validation, privacy, and authorization tests |
| `npm run test:identity-reveal` | Run Identity Reveal static, behavioral, and hydrate tests |
| `npm run test:contact-reveal` | Run Contact Reveal static contract and behavioral tests |
| `npm run test:notifications` | Run Notifications v1 static/privacy/behavioral tests |
| `npm run test:circles` | Run Study Circle privacy, abuse, projection, and lifecycle tests |
| `npm run staff:bootstrap-owner` | Interactive trusted first-owner bootstrap; run only after approved migration |
| `npm run test:browser` | Audit login responsiveness, overflow, and keyboard focus with Chrome |
| `npm run check` | Run lint, typecheck, and production build |

`npm run test:browser` expects Google Chrome at its default Windows location unless `CHROME_PATH` is supplied.

### Validation before committing

Run:

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

Notifications use bounded keyset pagination and a 25-second authenticated global unread
poll that pauses while the document is hidden. Chat polling remains unchanged.

The post-deployment live audit verifies A/B/C recipient isolation, direct-table denial,
trusted trigger creation, deterministic deduplication, read-one/read-all behavior, all
three contact channels, one-sided consent silence, safe projection, blocked-history
privacy, and complete synthetic-account cleanup.

### Study Circle v1 (local-only)

Migration `202608090001_create_study_circles_v1.sql` adds direct-join Study Circles with
`open` or same-campus scope, owner-only Circle management, `active | left | removed`
membership, member-only plain-text discussion, atomic abuse counters, and report-scoped
moderation evidence. The migration has not been applied remotely.

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
