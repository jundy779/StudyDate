# Limited rollout plan — StudyDate MVP

Scope (frozen): Auth, onboarding, People, Introduction, Anonymous Chat, Mutual Interest,
Identity Reveal, Contact Reveal (Telegram / Instagram / LinkedIn), Block, Report,
Owner/Admin separation, responsive authenticated UI, Landing / Early Access.

Out of scope: public Student Verification, WhatsApp/phone/email reveal, Groups, Campus
Events, Telegram bot, calls, attachments, native Realtime, matching algorithm, swipe UI,
payments.

---

## Entry criteria

1. **P1-01 key recovery (Owner)** — checklist in
   `docs/operations/contact-reveal-key-recovery.md` completed offline (no key in Git).
2. **P1-02 moderation** — migration `202608060008` applied remotely after dry-run; Owner
   can triage `/owner/moderation`.
3. **CLI** — profile `studydate` authenticated to project `ctbqudtvrfezuoqcecyj`.
4. **Regression green** — lint, typecheck, all `test:*`, browser, build.
5. **Student Verification remains disabled** (`STUDENT_VERIFICATION_ENABLED` ≠ `true`).

---

## Cohort

- Invite-only, small campus / trusted peers (suggest ≤ 30 active students initially).
- No public marketing blast until first week ops review.
- Prefer users who can report issues privately to Owner.

---

## Launch steps

1. Confirm production env: Supabase URL/publishable, service-role, Contact Reveal key +
   version, site URL — server-only secrets never in client.
2. Apply migration 008 (after `db push --dry-run` clean on correct CLI account).
3. Smoke Owner login → `/owner/moderation` loads (empty queue OK).
4. Smoke Student A/B golden path on production-like host (port convention for audits: 3010
   when using local live scripts).
5. Share invite + Community / Safety short note (public-place meetings only).
6. Watch: report submissions, Intro rate-limit errors, chat send failures, reveal prepare
   failures (manual log review until monitoring exists).

---

## Day-0 / Week-1 ops

| Cadence | Action |
|---------|--------|
| Daily | Owner opens moderation queue; clear `submitted` |
| Daily | Skim Auth/error logs for 5xx (no PII) |
| On report | Follow `docs/operations/moderation-triage.md` |
| On key/env incident | Follow contact-reveal key recovery runbook |
| End of week 1 | Decide expand cohort / pause / fix P2 (CSP, kill switches, CLI hygiene) |

---

## Kill / containment (interim)

Until dedicated feature flags exist:

1. Unset Contact Reveal key on host → prepares fail closed.
2. Redeploy / stop Next host → stops all writes.
3. Auth Dashboard → disable abusive accounts.

---

## Explicit non-goals during limited rollout

- Do not enable Student Verification.
- Do not add WhatsApp / phone / email reveal.
- Do not broaden staff to read all chats.
- Do not force-push migrations or skip dry-run.

---

## Exit to wider rollout (later)

- P2: CSP/headers, social kill switches, monitoring alerts, CLI identity stable
- Retention / account-deletion policy decision
- Documented backup restore drill for Supabase plan
- Moderation load acceptable with current Owner capacity
