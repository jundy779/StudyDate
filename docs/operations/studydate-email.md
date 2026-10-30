# StudyDate ID outbound email

Product magic links are sent by **StudyDate ID**, not by the Supabase Auth mailer.

## Flow

1. `/api/auth/magic-link` or `/api/auth/staff-magic-link`
2. Service-role `generateLink` (token only — no Supabase email send)
3. StudyDate HTML/text template
4. Resend API **or** SMTP
5. Inbox CTA opens `https://YOUR_ORIGIN/auth/confirm?token_hash=…`

## Required env

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3010   # must match npm start port locally
STUDYDATE_EMAIL_FROM="StudyDate ID <noreply@your-domain.com>"

# Option A
STUDYDATE_RESEND_API_KEY=re_...

# Option B
STUDYDATE_SMTP_HOST=smtp.gmail.com
STUDYDATE_SMTP_PORT=587
STUDYDATE_SMTP_USER=...
STUDYDATE_SMTP_PASSWORD=...   # app password, never commit
```

## Supabase Dashboard

Still required for Auth sessions:

- Site URL = same origin as `NEXT_PUBLIC_SITE_URL`
- Redirect allowlist includes `/auth/callback` and `/auth/confirm`

You do **not** need Supabase “custom SMTP” for StudyDate login emails when using this path.
Keep Supabase built-in auth emails unused by never calling `signInWithOtp`.

## Local port

`npm run dev` / `npm start` listen on **3010** so they match `NEXT_PUBLIC_SITE_URL`.

## Event announcement email (flag `EVENT_EMAIL_ENABLED`)

Organizers can tick "Kirim juga lewat email" when posting an event announcement. Recipient addresses are read only
server-side with the service role (`claim_campus_event_email_batch`), never shown to organizers. Each email carries
an unsubscribe link to `/email/berhenti` (confirm button, no action on GET) and a `List-Unsubscribe` header.
Limits: once per announcement, 2 per organizer per day. Requires migration 202610300001. Owner switches it on at
`/owner/events` (migration 202610300002) once every requirement shows a green check.
