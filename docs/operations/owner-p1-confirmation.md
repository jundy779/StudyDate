# Owner P1 confirmation (no secrets)

Fill offline. Do **not** paste encryption keys or tokens into this file or Git.

Date: 2026-08-07  
Owner name: __________

## P1-01 Contact Reveal key

- [x] Secure backup of `CONTACT_REVEAL_ENCRYPTION_KEY` exists in approved vault
  - Local machine vault (outside Git): `%USERPROFILE%\StudyDate-Vault\contact-reveal-backup-LATEST.env` (ACL current Windows user only; version `1`)
  - [ ] Also copied into password manager / org vault (Owner — recommended before public rollout)
- [ ] Access works for primary + backup person (or dual-control)
- [x] Key is not in Git / chat / ordinary docs
- [x] Host `CONTACT_REVEAL_KEY_VERSION` matches backup records (`1`)
- [x] Non-destructive restore check done (synthetic or staging; no production key printed)
  - File read-back verify OK (2026-08-07); engineering: `npm run test:contact-reveal` crypto recovery tests pass

Engineering drill (already automated): `npm run test:contact-reveal` crypto recovery tests.

## P1-02 Moderation

- [x] Migration `202608060008` applied to project `ctbqudtvrfezuoqcecyj` after dry-run
- [x] Owner RPC `list_moderation_reports` allowed (live smoke)
- [x] Student/anon RPC denied (live smoke)
- [x] Unauthenticated `/owner/moderation` redirects to staff login
- [ ] Owner visually opens `/owner/moderation` in browser once
- [ ] SOP `docs/operations/moderation-triage.md` reviewed

Engineering live smoke: `node --experimental-strip-types scripts/live-moderation-smoke.mjs` → `SMOKE_OK` (2026-08-07).

When P1-01 checkboxes above are checked, limited-rollout P1 blockers are closed operationally.
