# Owner P1 confirmation (no secrets)

Fill offline. Do **not** paste encryption keys or tokens into this file or Git.

Date: __________  
Owner name: __________

## P1-01 Contact Reveal key

- [ ] Secure backup of `CONTACT_REVEAL_ENCRYPTION_KEY` exists in approved vault
- [ ] Access works for primary + backup person (or dual-control)
- [ ] Key is not in Git / chat / ordinary docs
- [ ] Host `CONTACT_REVEAL_KEY_VERSION` matches backup records
- [ ] Non-destructive restore check done (synthetic or staging; no production key printed)

Engineering drill (already automated): `npm run test:contact-reveal` crypto recovery tests.

## P1-02 Moderation

- [ ] Migration `202608060008` applied to project `ctbqudtvrfezuoqcecyj` after dry-run
- [ ] `/owner/moderation` lists queue for Owner session
- [ ] Student session cannot open moderation routes
- [ ] SOP `docs/operations/moderation-triage.md` reviewed

When both sections are checked, limited-rollout P1 blockers are closed operationally.
