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
- Server-side sign-out

Not implemented yet:

- Introductions
- Chat
- Groups
- Events
- Verification documents
- Telegram linking
- Contact reveal

The “Segera hadir” areas inside `/app` do not contain fake recommendations or placeholder data.

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
- Set Site URL to `http://localhost:3000` for local development.
- Add local redirect URL: `http://localhost:3000/auth/callback`.
- Add production redirect URL: `https://YOUR_DOMAIN/auth/callback`.

Set the same production origin in `NEXT_PUBLIC_SITE_URL`. The production application should use HTTPS.

### Authentication flow

1. The user submits an email on `/login`.
2. Supabase sends a passwordless link.
3. `/auth/callback` exchanges the PKCE code and establishes the cookie-backed session.
4. A new authenticated user without completed onboarding goes to `/onboarding`.
5. A user with completed onboarding goes to `/app`.

Callback redirects accept only trusted internal destinations. Authentication errors shown to users are generic and do
not expose Supabase error details.

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

People Discovery uses dedicated authenticated RPCs with an explicit safe projection rather than exposing the complete
`profiles` table. Eligible rows require completed onboarding and user opt-in, exclude the current user, and expose
neither private names, auth email, contacts, NIM, nor internal user IDs.

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
npm run test:browser
npm run build
git status --short
git check-ignore .env.local
```

Confirm that `.env.local` is ignored and no generated screenshots, test credentials, tokens, or secret values are
staged.

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
