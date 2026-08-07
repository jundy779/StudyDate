# Migration preflight — Moderation triage v1

**Status:** APPLIED remotely to StudyDate `ctbqudtvrfezuoqcecyj` (2026-08-07)

**Migration file:** `supabase/migrations/202608060008_create_moderation_triage_v1.sql`

**Verified:**
- `migration list` local = remote through `202608060008`
- `db push` reports remote up to date
- live probe: `list_moderation_reports` present (Owner auth gate); `moderation_report_events` readable via service role; anon denied

## Contained changes

- Columns on `user_reports`: status, reviewer, timestamps, internal_note
- Table `moderation_report_events`
- Owner-only RPCs for list/get/update/count
- No Contact Reveal decrypt; optional single message excerpt only
