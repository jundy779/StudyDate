# Migration preflight — Moderation triage v1

**Status:** LOCAL READY — remote apply pending correct CLI auth + dry-run approval

**Migration file:** `supabase/migrations/202608060008_create_moderation_triage_v1.sql`

**Project:** `ctbqudtvrfezuoqcecyj`

## Preflight commands (Owner terminal with StudyDate CLI account)

```bash
npx supabase projects list --profile studydate
npx supabase migration list --profile studydate
npx supabase db push --dry-run --profile studydate
```

Expected: StudyDate project visible; local includes 008; dry-run shows only 008 pending;
no seed/role mutation/repair.

Then, only with explicit approval:

```bash
npx supabase db push --profile studydate
```

## Contained changes

- Columns on `user_reports`: status, reviewer, timestamps, internal_note
- Table `moderation_report_events`
- Owner-only RPCs for list/get/update/count
- No Contact Reveal decrypt; optional single message excerpt only

## Rollback note

Reverse is non-trivial once events exist; prefer forward-fix. Do not apply to the wrong
Supabase project.
