# Moderation triage (limited rollout)

Repository-safe SOP. Moderators must not copy private user content into external chats,
tickets, or personal notes beyond what is required to act.

---

## Technical workflow

Route: `/owner/moderation` (Owner only via `requireOwner` + `staff_members` /
`app_metadata`).

Database (migration `202608060008_create_moderation_triage_v1.sql`):

```text
submitted → under_review → resolved
                         → dismissed
```

Direct `submitted → resolved|dismissed` is allowed for sparse limited-rollout queues.
Terminal states are not reopened from the UI.

RPCs:

- `list_moderation_reports`
- `get_moderation_report`
- `update_moderation_report_status`
- `count_unresolved_moderation_reports`

Actor identity is always `auth.uid()` of the Owner session. Clients cannot supply a
reviewer UUID.

Report **submission** by students remains unchanged and privacy-safe.

---

## Privacy boundary

Moderators must **not** automatically gain:

- full Anonymous Chat history
- one-sided Mutual Interest / Identity / Contact Reveal state
- reveal photos unrelated to the report
- Contact Reveal plaintext or ciphertext
- unrelated profiles, emails, NIM, legal names

When a report references a specific message, only a short excerpt of that message may
appear. Otherwise show target kind + reason + bounded reporter details only.

---

## Queue ownership

| Role | Access |
|------|--------|
| Owner | Full triage queue |
| Admin (even with verification reviewer) | No moderation triage |
| Student / anon | No access |

---

## First review process

1. Open unresolved queue (`submitted` / `under_review` count on inbox).
2. Open one report.
3. Classify using `reason_code`:
   - `harassment` — prioritize
   - `contact_pressure` — privacy / block guidance
   - `spam` — pattern check
   - `fake_or_misleading` — no automatic guilt
   - `other` — read bounded details if present
4. Prefer `under_review` before deep work when the queue is busy.
5. Resolve or dismiss with a short internal note (facts only).

---

## Escalation categories

| Signal | Action |
|--------|--------|
| Suspected privacy leak | Escalate to Owner + engineering; preserve report id + timestamps |
| Harassment / threats | Guide reporter to block; Auth disable only via Dashboard if Owner approves |
| Spam campaign | Check Intro/chat rate limits; consider temporary disable via redeploy/env |
| Suspected underage / severe safety | Owner decision; do not invent legal SLAs |

---

## Evidence preservation

- Keep report row + moderation_report_events.
- Do not download reveal photos for tickets.
- Do not decrypt Contact Reveal for moderation.
- Audit fields: report id, old/new status, actor, timestamp.

---

## What moderators must never copy externally

- Full message histories
- Contact handles / URLs
- Reveal first names / photos
- Emails, NIM, legal names, full UUIDs
- Magic links, cookies, service keys

---

## Account restriction

In-app ban/suspend is not implemented. Operator may disable Auth users via Supabase
Dashboard when Owner approves. Record Auth user suffix only in internal notes.

---

## Incident path

For systemic leaks or key compromise, use
`docs/operations/contact-reveal-key-recovery.md`.
