# Production environment checklist — StudyDate ID

Do not commit secret values. Fill hosting env (Vercel/etc.) and keep `.env.local` for local only.

## Status categories

| Area | Local (`.env.local`) | Public production |
|------|----------------------|-------------------|
| Supabase URL + publishable + service-role | Required | Same project values |
| `CONTACT_REVEAL_ENCRYPTION_KEY` (+ backup) | Required | Same key (backed up offline) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3010` | `https://YOUR_DOMAIN` |
| StudyDate email (`STUDYDATE_*`) | Required to test login mail | Required |
| `STUDENT_VERIFICATION_ENABLED` | `false` | Enable only after controlled audit |

## Required production variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN
SUPABASE_SERVICE_ROLE_KEY=
CONTACT_REVEAL_ENCRYPTION_KEY=
CONTACT_REVEAL_KEY_VERSION=1

STUDYDATE_EMAIL_FROM="StudyDate ID <noreply@YOUR_DOMAIN>"
# either:
STUDYDATE_RESEND_API_KEY=
# or SMTP:
STUDYDATE_SMTP_HOST=
STUDYDATE_SMTP_PORT=587
STUDYDATE_SMTP_SECURE=false
STUDYDATE_SMTP_USER=
STUDYDATE_SMTP_PASSWORD=

STUDENT_VERIFICATION_ENABLED=false
STUDENT_VERIFICATION_ENCRYPTION_KEY=
STUDENT_VERIFICATION_HMAC_KEY=
STUDENT_VERIFICATION_REVIEWER_USER_ID=
STUDENT_VERIFICATION_CLEANUP_SECRET=
STUDENT_VERIFICATION_CLEANUP_SCHEDULED=false
PDDIKTI_LOOKUP_PROVIDER_ENABLED=false
PDDIKTI_PROVIDER_BASE_URL=
PDDIKTI_PROVIDER_ACCESS_KEY=
```

Verification crypto keys may remain set even while Verification stays disabled.

## Student Verification production gate

1. Rotate any provider access key that has appeared in chat, logs, screenshots,
   or shell history.
2. Configure all verification variables above in Production; use
   `STUDENT_VERIFICATION_TEST_USER_IDS` only for the controlled audit.
3. Deploy the daily Vercel Cron for `/api/internal/verification/cleanup`,
   configure `CRON_SECRET`, verify one successful heartbeat with zero failed and
   remaining work, then set
   `STUDENT_VERIFICATION_CLEANUP_SCHEDULED=true`.
4. Confirm the dedicated reviewer remains active and has the server-managed
   `verification_reviewer` metadata/role.
5. Keep both public flags false while running the controlled end-to-end audit:
   lookup, manual fallback, ownership proof, staff review, badge transition,
   evidence access, cleanup, rate limits, and rollback.
6. After the audit passes, remove controlled test IDs, enable
   `PDDIKTI_LOOKUP_PROVIDER_ENABLED=true`, then enable
   `STUDENT_VERIFICATION_ENABLED=true` and redeploy.
7. Rollback immediately by setting both flags false. Existing requests remain
   private and reviewable; no new student request is accepted.

## Supabase Dashboard (production)

- Authentication → Site URL = `https://YOUR_DOMAIN`
- Redirect URLs include:
  - `https://YOUR_DOMAIN/auth/callback`
  - `https://YOUR_DOMAIN/auth/confirm`
- Do not use Supabase Auth mailer for product magic links (StudyDate SMTP/Resend owns delivery)

## Hosting

1. Set all variables above in the host dashboard (never commit `.env.local`).
2. Deploy `studydate-web` production build (**Vercel root directory = `studydate-web`**).
3. Apply migration `202608070001` (API rate limits) before public demo traffic.
4. Smoke: landing → login → magic link arrives as StudyDate ID → confirm → `/app` or `/owner`.
5. Owner opens `/owner/moderation`.
6. Full Vercel steps: `docs/operations/vercel-deploy.md`.

## Blockers until filled by Owner

1. Public HTTPS domain for `NEXT_PUBLIC_SITE_URL` (target `https://studydate.id`)
2. Resend API key **or** SMTP credentials + From address (`STUDYDATE_SMTP_PASSWORD` for Gmail)
3. Vercel project env mirrors this checklist (Production + Preview as needed)
4. Supabase Auth Site URL + redirect allowlist for the deployed origin