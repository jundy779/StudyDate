# Study program / jurusan catalog (owner/admin)

Same pattern as campus catalog: approved names power onboarding suggestions;
manual entries become pending for staff curation. Sorted A–Z by name.

## Apply migration

```bash
cd studydate-web
supabase db push --dry-run
supabase db push
```

Migration: `202608070004_create_study_program_options_v1.sql`

## Surfaces

| Role | Path |
|------|------|
| Owner | `/owner/study-programs` |
| Admin | `/admin/study-programs` |

## Student flow

After onboarding succeeds, `suggest_study_program_option` records the program
(best-effort). Staff approve → appears in onboarding list for everyone.
