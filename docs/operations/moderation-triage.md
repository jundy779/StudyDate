# Moderation triage (limited rollout)

Repository-safe SOP. Moderators must not copy private user content into external chats,
tickets, or personal notes beyond what is required to act.

---

## Status of technical workflow

**Current deployed schema (`user_reports` through migration `202608060007`) does not
include moderation status, reviewer, internal note, or staff list/update RPCs.**

Report **submission** (participants → `user_reports`) remains privacy-safe and live.

Owner Moderation **triage with status transitions is blocked** until a separate
migration preflight is approved and applied. See:

`docs/operations/moderation-triage-migration-preflight.md`

Until that lands, treat the Owner `#moderation` shell as a reminder only — reports must
not be assumed “handled” by the product UI.

---

## Intended limited-rollout workflow (after migration)

```text
submitted → under_review → resolved
                         → dismissed
```

Owner (or authorized reviewer, if granted by product policy) will:

1. Open `/owner/moderation` unresolved queue
2. Open one report
3. See only sanitized fields needed to triage
4. Move to `under_review`, then `resolved` or `dismissed`
5. Optionally store a **bounded plain-text** internal note (staff-only)

### Privacy boundary

Moderators must **not** automatically gain:

- full Anonymous Chat history
- one-sided Mutual Interest / Identity / Contact Reveal state
- reveal photos unrelated to the report
- Contact Reveal plaintext or ciphertext
- unrelated profiles, emails, NIM, legal names

If a report references a specific message, resolve **only that message** when the model
supports it. If evidence cannot be shown safely, document the limitation — do not add
broad read grants.

---

## Queue ownership

| Role | Access (intended) |
|------|-------------------|
| Owner | Full triage queue |
| Admin without explicit moderation permission | No triage |
| Student / anon | No access |

Authorization must use `staff_members` + `app_metadata` (never `user_metadata`).

---

## First review process

1. Confirm report is actionable (not empty / not duplicate spam of the same hour window).
2. Classify urgency using `reason_code` only:
   - `harassment` — prioritize
   - `contact_pressure` — prioritize privacy coaching / block guidance
   - `spam` — rate / pattern check
   - `fake_or_misleading` — assess claims carefully; no automatic guilt
   - `other` — read bounded details if present
3. Set status `under_review` before deep work.
4. Prefer participant **block** tools already in product over surveillance.
5. Resolve or dismiss with a short internal note (facts only, no pasted chat dumps).

---

## Escalation categories

| Signal | Action |
|--------|--------|
| Suspected privacy leak (identity/contact exposed early) | Escalate to Owner + engineering; preserve report id + timestamps; do not redistribute evidence |
| Harassment / threats | Guide reporter to block; consider account restriction **only if** product supports it (today: Auth disable is operator/Dashboard, not in-app) |
| Spam campaign | Check Intro/chat rate limits; consider temporary feature disable via redeploy/env |
| Suspected underage / severe safety | Owner decision path; follow applicable local policy; do not invent legal SLAs here |

---

## Evidence preservation

- Keep report row + timestamps.
- Do not download reveal photos “for the ticket”.
- Do not export ciphertext or attempt Contact Reveal decrypt for moderation.
- Sanitized audit trail (after migration): report id, old/new status, reviewer suffix, time.

---

## What moderators must never copy externally

- Message bodies beyond a minimal paraphrase
- Contact handles / URLs
- Reveal first names / photos
- Emails, NIM, legal names, full UUIDs
- Magic links, cookies, service keys

---

## Account restriction

In-app account ban/suspend is **not** implemented as a student-facing control today.
Operator may disable Auth users via Supabase Dashboard when Owner approves.
Document the Auth user suffix only — not email — in internal notes when required.

---

## Incident path

For systemic leaks or key compromise, use
`docs/operations/contact-reveal-key-recovery.md` and the limited-rollout incident playbook
under gitignored audit artifacts (if present). Prefer containment over broad data access.
