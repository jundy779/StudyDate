# Migration preflight request — Moderation triage v1

**Status:** REQUIRED BEFORE P1-02 can close  
**Do not apply in this task.** No migration file was created or pushed here.

## Why the deployed schema cannot close P1-02

Table `public.user_reports` (migrations `202608060001` + conversation columns in
`202608060003`) currently stores:

- reporter / subject
- optional introduction / conversation / message references
- reason_code + optional details
- created_at

It does **not** store:

- moderation status (`submitted` / `under_review` / `resolved` / `dismissed`)
- reviewer identity
- reviewed_at / resolved_at
- staff-only internal note
- moderation audit events

There is also **no** SECURITY DEFINER RPC for Owner to list or update reports.
Direct grants to `authenticated` remain revoked (correct for students).

Therefore a durable Owner triage workflow with required status transitions **cannot**
be implemented safely without a new database migration + RPC surface.

## Requested separate task

Title suggestion: `StudyDate Moderation Triage Migration Preflight`

Proposed migration id (example): `202608060008_create_moderation_triage_v1.sql`

Minimum schema intent (design only — implement in the migration task):

1. Add columns to `user_reports` (or equivalent 1:1 triage table):
   - `moderation_status` with check constraint
   - `reviewer_user_id` (nullable, staff only when set)
   - `reviewed_at`, `resolved_at`
   - `internal_note` (bounded length, plain text)
2. Default existing rows to `submitted`
3. Append-only `moderation_report_events` (report_id, old_status, new_status, actor, created_at)
4. RPCs (SECURITY DEFINER, `search_path = ''`, Owner or explicit permission):
   - `list_moderation_reports`
   - `get_moderation_report`
   - `update_moderation_report_status`
5. Projections must exclude Contact Reveal plaintext, one-sided reveal state, and full chat history
6. Optional: single referenced message body only when `anonymous_message_id` is set — never full thread

## Acceptance for P1-02 closure

- Migration preflight + remote apply through approved process
- Owner UI `/owner/moderation` wired to RPCs
- Behavioral tests for anon/student denial and Owner transitions
- SOP in `docs/operations/moderation-triage.md` remains accurate

## Explicit non-goals for that migration

- Broad admin chat surveillance
- Automatic guilt / public accusation UI
- Decrypting Contact Reveal for moderators
- Enabling Student Verification
