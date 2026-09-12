# Verified on LinkedIn

## Product rule

LinkedIn is an optional trust signal, not a replacement for StudyDate student
verification. The student badge still requires:

1. an academic match through PDDikti;
2. ownership proof through an approved campus email or reviewed student card;
3. final approval by an active StudyDate reviewer.

The UI keeps these signals separate:

- **Akun LinkedIn terhubung** means the member completed StudyDate's LinkedIn
  OAuth flow.
- **Identitas di LinkedIn terverifikasi** is shown only when LinkedIn's
  verificationReport returns IDENTITY.
- **Tempat kerja di LinkedIn terverifikasi** is shown only when the report
  returns WORKPLACE.

Basic LinkedIn profile or education text must never be described as verified
student status. No scraping is allowed.

## Activation checklist

Keep LINKEDIN_VERIFICATION_ENABLED=false until all steps are complete:

1. Create a LinkedIn Developer application owned by StudyDate ID.
2. Add the **Verified on LinkedIn** product and test only with app
   administrators in Development tier.
3. Register the exact HTTPS callback:
   https://studydate.id/api/verification/linkedin/callback.
4. Apply migration
   202609120001_linkedin_verification_links_v1.sql.
5. Configure the server-only variables from .env.example in Vercel. Read
   current LinkedIn release notes before setting both API version headers.
6. Generate a dedicated 32-byte LINKEDIN_MEMBER_HASH_KEY. Do not reuse
   Student Verification, Contact Reveal, Telegram, or ticket keys.
7. Complete a controlled test for successful connection, rejected consent,
   expired state, duplicate member, missing scopes, and LinkedIn 4xx/5xx.
8. Apply for Lite tier before allowing normal members to use the flow.
9. Set LINKEDIN_VERIFICATION_ENABLED=true only after the database, secrets,
   callback, and controlled audit are confirmed in production.

## Privacy and security

- OAuth state uses a short-lived, HttpOnly, SameSite=Lax cookie.
- The callback authenticates the current StudyDate session before any write.
- LinkedIn access tokens and raw API responses are discarded after the check.
- The database stores only an HMAC fingerprint of the app-scoped member ID,
  two verification booleans, and timestamps.
- A unique fingerprint prevents one LinkedIn member from being attached to
  multiple StudyDate accounts.
- Authenticated clients receive read-only access to their own row through RLS.
  Insert and update remain server-only.
- Students can remove their own StudyDate-side connection at any time. The
  server derives the target from the authenticated session.
