# Campus catalog (owner/admin)

Approved campus names power onboarding suggestions. Manual campus entries
become **pending** suggestions for staff curation.

## Apply migration

```bash
cd studydate-web
supabase db push --dry-run
# after review:
supabase db push
```

Migration: `202608070002_create_campus_options_v1.sql`

## Surfaces

| Role | Path |
|------|------|
| Owner | `/owner/campuses` |
| Admin | `/admin/campuses` |

Staff can **tambah / edit / setujui / tolak / hapus**.

## Student flow

1. Onboarding loads approved campuses (seed fallback if RPC unavailable).
2. After successful onboarding, `suggest_campus_option` records the campus:
   - already approved → count bump only
   - new / formerly rejected → pending queue for staff

## Notes

- Direct table access is revoked; use RPCs only.
- Student projections never expose full user UUIDs (suffix only in staff list).
