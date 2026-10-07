# Gemini Project Instructions

This file guides Gemini when working in the StudyDate ID repository.

Read and follow [AGENTS.md](./AGENTS.md) first. If this file conflicts with `AGENTS.md`, the actual code, or the current database migrations, use `AGENTS.md` and the implementation as the source of truth.

## Product context

StudyDate ID is a social platform for Indonesian students and alumni. Its main value is helping people find study partners, new friends, project collaborators, Study Circles, and Campus Events.

A closer or romantic relationship may grow naturally between users, but it is optional and must not become the main promise, visual language, or interaction pattern.

Public language should feel natural, warm, simple, and easy for non-technical students to understand.

## Read before changing code

Use these documents in this order:

1. [context/MVP.md](./context/MVP.md) for the current release boundary.
2. [context/PRD.md](./context/PRD.md) for complete product behavior.
3. [context/DESIGN.md](./context/DESIGN.md) for UI, UX, content, accessibility, and responsive rules.
4. [context/ARCHITECTURE.md](./context/ARCHITECTURE.md) for system boundaries.
5. [context/SCHEMA.md](./context/SCHEMA.md) and [context/ERD.md](./context/ERD.md) for data context.
6. `supabase/migrations/` for the exact database contract.

A Markdown document may be behind the implementation. Always inspect the relevant application code, tests, and migrations before making a claim or change.

## Status language

Use only these terms when reporting a feature:

- **Repository implemented:** code or migration exists in the repository.
- **Remote rollout verified:** the feature has been applied and tested in the target environment.
- **Not implemented:** the capability is not available.

Never call a feature live merely because its code, environment variable, migration, UI, or feature flag exists.

## Working rules

1. Inspect the relevant route, service, validation, migration, and tests.
2. State the intended scope before making a broad change.
3. Prefer the smallest complete change that preserves existing privacy and authorization boundaries.
4. Reuse existing components and product terms.
5. Add or update tests for changed behavior.
6. Update the relevant context document when product behavior or schema changes.
7. Report what was changed, what was verified, and what still requires remote testing.

Do not invent users, events, metrics, verification badges, payment status, testimonials, or production readiness.

## Frontend rules

- Follow the installed Next.js documentation referenced by `AGENTS.md`; do not rely only on model memory.
- Use Poppins for headings and Inter for body or UI text, following existing tokens.
- Keep the editorial campus-tech direction. Avoid swipe decks, heart-heavy dating visuals, fake compatibility scores, excessive gradients, and generic SaaS dashboards.
- Use everyday Indonesian in user-facing copy. Internal terms such as `mutual interest`, `projection`, `entitlement`, or `conversation shell` must not appear without a plain-language explanation.
- Preserve loading, empty, error, retry, disabled, and success states.
- Preserve keyboard access, visible focus, semantic labels, screen-reader status, reduced motion, and non-color-only meaning.
- Check 375px, 768px, 1024px, and 1440px. Long Indonesian text must wrap and the page must not overflow horizontally.
- Do not expose UUIDs, storage paths, email addresses, NIM, legal names, contact values, tokens, or one-sided consent state.

## Supabase and security rules

- Treat migrations as forward-only.
- Never edit an already-applied migration to change production behavior. Add a new migration.
- Never run `supabase db push`, link a project, rotate a secret, bootstrap an owner, or perform a live audit without explicit authorization and a verified target.
- Keep service-role credentials on the server.
- Preserve RLS, revoked direct table grants, explicit safe projections, actor derivation from `auth.uid()`, fixed `search_path`, and least-privilege RPC access.
- Do not make authorization decisions from client state, route parameters, `user_metadata`, or UI visibility.
- One-sided Mutual Interest, Identity Reveal, and Contact Reveal state must remain private.
- PDDikti and LinkedIn verification must not be described as active until their specific rollout is verified.
- Account deletion, block, report, moderation evidence, and audit retention must remain privacy-safe.

## Product invariants

- Accepting an introduction does not reveal identity or contacts.
- Mutual Interest does not automatically reveal identity.
- Identity Reveal requires separate two-party consent.
- Each Contact Reveal channel requires separate two-party consent.
- Joining a Circle or Event does not create a private conversation or reveal attendee contacts.
- Safety and privacy controls are never paywalled.
- Offline meetings are only encouraged in public places, without a guarantee of safety.
- Staff access is capability-based and must be audited.

## Validation

Run the narrow tests for the changed feature first. Before a release candidate, use:

```bash
npm run verify:release
```

When a full gate is not possible, run at least:

```bash
npm run lint
npm run typecheck
npm run build
```

Never report a command as passed unless it was actually run successfully. Browser, email, payment, Telegram, LinkedIn, PDDikti, and remote Supabase checks require the appropriate controlled environment.
