# ChatGPT and Codex Project Instructions

This file provides StudyDate ID context for ChatGPT and Codex sessions.

[AGENTS.md](./AGENTS.md) is the canonical repository instruction file and must be read first. This file adds product-specific guidance. The current code, tests, and migrations remain authoritative when documentation is stale.

## What StudyDate ID is

StudyDate ID helps Indonesian students and alumni find:

- study partners;
- new friends and campus connections;
- project or competition collaborators;
- Study Circles;
- Campus Events.

The product starts from shared academic interests and campus activities. Dating is possible only as a natural, optional outcome chosen by the users. Do not position StudyDate ID as a dating app and do not deny that closer relationships can happen.

A useful public explanation is:

> Cari teman belajar, kenalan baru, circle, dan acara kampus. Mulai pelan-pelan tanpa langsung membagikan nama asli atau kontak.

## Source-of-truth order

Before planning or editing, read the relevant parts of:

1. [context/MVP.md](./context/MVP.md)
2. [context/PRD.md](./context/PRD.md)
3. [context/DESIGN.md](./context/DESIGN.md)
4. [context/ARCHITECTURE.md](./context/ARCHITECTURE.md)
5. [context/SCHEMA.md](./context/SCHEMA.md)
6. [context/ERD.md](./context/ERD.md)
7. relevant files in `app/`, `components/`, `lib/`, `tests/`, and `supabase/migrations/`

For database behavior, migration SQL wins over summaries and diagrams.

## Collaboration rules

- Answer in clear, natural Indonesian unless the task requires another language.
- Lead with the actual outcome or finding.
- Be honest when a feature is incomplete, untested, local-only, behind a kill switch, or not verified remotely.
- Do not say “sudah selesai”, “aman”, “live”, or “100%” without evidence covering the requested scope.
- Separate repository implementation from production availability.
- When asked to implement, finish the safe in-scope change and validate it before handing off.
- Do not silently expand scope into deployment, production database writes, secret changes, account creation, or external messages.
- Preserve unrelated user changes.

## Feature status vocabulary

Use these exact meanings:

| Status | Meaning |
|---|---|
| Repository implemented | Code or migration exists in the repository |
| Remote rollout verified | Applied and tested in the intended environment |
| Not implemented | Capability is unavailable |

Feature flags, environment variables, UI shells, and migration files alone are not proof of a live feature.

## Product and copy rules

User-facing language must be understandable without product or developer knowledge.

Prefer:

- Cari teman
- Kirim perkenalan
- Mulai ngobrol
- Kenal lebih jauh
- Buka identitas
- Bagikan kontak
- Gabung Circle
- Ikuti acara
- Ajak lewat chat
- Ruang Operasional

Avoid unexplained internal language such as:

- mutual interest;
- progressive reveal;
- projection;
- entitlement;
- conversation shell;
- provider adapter;
- repository scope.

Do not use manipulative scarcity, rejection-shaming, romance pressure, fake safety claims, fake metrics, or fake verification.

## Privacy invariants

These rules must survive every refactor:

1. People Discovery exposes only the approved anonymous projection.
2. Accepting an introduction opens chat but not identity or contact.
3. One-sided **Kenal Lebih Jauh** remains private.
4. Identity Reveal requires completed mutual interest and separate consent from both participants.
5. Contact Reveal is conversation-scoped and completed separately per Telegram, Instagram, or LinkedIn.
6. Circle or Event membership never grants access to private identity, contact, or conversation data.
7. Block, report, end-conversation, and account deletion remain available and are not paid features.
8. Student, Admin, and Owner data access stays separated through server-authoritative roles and capabilities.
9. NIM, legal name, evidence, tokens, raw UUIDs, storage paths, and private contact values never enter public projections.
10. PDDikti and LinkedIn signals do not replace the complete student verification decision.

## UI and responsive rules

- Preserve the editorial campus-tech design direction from `context/DESIGN.md`.
- Reuse the current design tokens and UI primitives.
- Avoid dating-app swipe patterns, excessive cards, fake charts, heavy glass effects, and decorative complexity without product value.
- Provide honest loading, empty, error, retry, success, and disabled states.
- Maintain semantic HTML, keyboard flow, visible focus, accessible names, announcements, and sufficient contrast.
- Test long Indonesian copy and widths 375px, 768px, 1024px, and 1440px.
- Mobile pages must not shift or scroll horizontally.

## Database and infrastructure rules

- Inspect the latest relevant migration before changing the schema.
- Add a forward migration. Do not rewrite a migration that may have been applied.
- Preserve RLS, grants, constraints, idempotency, rate limits, and audit behavior.
- Use safe RPC projections instead of broad client table reads.
- Derive the acting user from the authenticated server context, not a client-supplied user ID.
- Keep service-role operations server-only.
- Never run a remote migration, owner bootstrap, production webhook, real-provider smoke test, or destructive cleanup without explicit authorization and target verification.
- Never commit secrets, test credentials, magic links, OTPs, access tokens, database passwords, or private evidence.

## Change workflow

1. Inspect the current implementation and repository status.
2. Define the affected user flow and privacy boundary.
3. Implement the smallest complete change.
4. Add or update focused tests.
5. Run feature-specific checks.
6. Run lint, typecheck, and build when practical.
7. Update MVP, PRD, DESIGN, SCHEMA, ARCHITECTURE, or ERD only when their contract changed.
8. Report changed files, validation results, remaining rollout work, and commit details when applicable.

Before a release candidate, run:

```bash
npm run verify:release
```

Do not claim tests passed if they were skipped, blocked, or only inferred from static inspection.
