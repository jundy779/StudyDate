# StudyDate project audit closure — 2026-08-09

## Scope and baseline

- Starting HEAD: `f4afc44` (`master`, initially aligned with `origin/master`).
- P0: none.
- Student Verification stayed disabled.
- No database migration was created or applied. Local and deployed migration
  history had already been verified as 32/32 aligned during preflight.
- The pre-existing `app/not-found.tsx` work is unrelated and was preserved
  without staging or modification by this audit.

## Findings closed in source

### P1 — inaccessible chat history

- The initial page remains bounded at 50 messages.
- `POST /api/messages/[publicId]` now loads older messages through the existing
  `(created_at, message_id)` cursor.
- Client merging is deterministic and deduplicated by the safe message ID.
- Polling merges recent results instead of replacing already loaded history.
- Loading, retry, exhausted-history, keyboard operation, and prepend
  scroll-position preservation are implemented.

### P2 — chat reliability, privacy, accessibility, and layout

- Message polling is recursive `setTimeout` at 4 seconds after successful
  completion; reveal polling runs separately at 30 seconds.
- Both use bounded exponential backoff to 30 seconds, generation guards,
  independent abort controllers, visibility pause, immediate refresh on return,
  and cleanup on unmount. In-flight requests are aborted before visibility
  refresh so they cannot overlap or commit stale state.
- Incoming messages auto-scroll only when the reader was within 100 px of the
  bottom. Otherwise the scroll position stays stable and a keyboard-accessible
  `Pesan baru` action appears.
- Identity and Contact Reveal infrastructure failures return a generic 503
  unavailable response. The client keeps previously authorized completed data
  and displays `Data pembukaan belum dapat diperbarui.` without exposing
  internal errors, encryption data, or Storage paths.
- End Conversation uses stable label/description IDs, safe initial focus,
  Tab/Shift+Tab containment, Escape, and focus restoration.
- Privacy, Mutual Interest, Identity Reveal, and Contact Reveal panels are in
  normal content flow; only the message composer remains sticky.
- Mobile navigation focus restoration was made deterministic by returning
  focus to its explicit trigger.

### P3 — preload, root failure, and message counter

- Non-critical and breakpoint-hidden images no longer use `priority`; the
  visible landing brand candidate remains prioritized.
- `app/global-error.tsx` supplies a minimal Indonesian root error boundary with
  retry and no raw exception details.
- The visual character counter is no longer announced on every keystroke.
  Screen-reader status is emitted only at 100 remaining, 20 remaining, and the
  limit.

## Automated and browser evidence

- Node tests: 345 passed, 0 failed, 0 skipped.
- ESLint: passed with 0 errors and 0 warnings.
- TypeScript: passed.
- Next.js production build: passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- Secret-pattern scan across source/config/docs/migrations: no matches.
- `git diff --check`: passed; only Windows LF/CRLF conversion notices.
- Login browser audit passed at 375, 768, 1024, and 1440 px.
- Authenticated production-build chat/reveal audit passed at:
  - 320 × 568
  - 360 × 800
  - 390 × 844
  - 768 × 1024
  - 1024 × 768
  - 1440 × 900
- That audit also verified:
  - all reveal panels available in the seeded mutual conversation;
  - no horizontal overflow;
  - short 390 × 420 viewport reduction as virtual-keyboard proxy;
  - End Conversation label/description, safe initial focus, Tab, Escape, and
    focus restoration;
  - mobile navigation open focus, Escape close, focus restoration, and body
    scroll restoration;
  - background message polling pauses while `document.hidden`;
  - no hidden symbol-logo preload;
  - onboarding campus combobox ArrowDown, ArrowUp, Home, End, Escape,
    `aria-activedescendant`, empty results, and manual-entry focus;
  - no console/network errors or Contact Reveal ciphertext fields in the
    message API/client payload.
- Browser artifacts: `audit-artifacts/audit-closure/` and
  `audit-artifacts/contact-reveal-responsive-report.json` (gitignored).

## Loading, error, and privacy regression coverage

- Tests cover bounded initial history, stable cursor use, merge order,
  deduplication, preserved history after polling, no-more-history behavior,
  polling visibility/backoff/cleanup contracts, near-bottom scrolling,
  new-message affordance, reveal unavailable semantics, retention of completed
  reveal data, dialog semantics, counter thresholds, sticky layout, root error,
  image priority, and forbidden private payload fields.
- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, raw participant IDs, NIM,
  service-role key, encryption key, Contact Reveal ciphertext, IV, or auth tag
  was introduced into the audited message surfaces.

## CSP decision

The existing security headers remain in place. A CSP was not added because the
original finding classified it as future hardening, and a production-safe
policy requires separately inventorying Next.js runtime, Supabase Auth, images,
fonts, and development/preview behavior. Adding an unproven policy here could
break authentication or rendering and is outside this closure.

## Explicit limitations

- The mobile-keyboard check uses viewport-height reduction; it is not a
  physical iOS keyboard test.
- Safe-area behavior was inspected through responsive browser emulation, not a
  physical iPhone.
- Dialog stress used a 390 × 420 effective viewport. No claim is made for a
  physical device, VoiceOver, NVDA, or browser-level 200% zoom session.
- Existing browser reports cover normal and reveal states. A dedicated
  screenshot fixture for every requested synthetic long-content, >50-message,
  transient-failure, and global-error visual state was not produced.
- No Lighthouse score or fabricated performance number is reported. The
  relevant performance closure evidence is production build success, separated
  polling cadence, hidden-tab pause, bounded backoff, preload inspection, and
  clean browser network/console checks.

## Verdict

All source P1/P2/P3 findings are fixed and automated regression is green.
Physical-device/manual verification and several requested visual stress
fixtures remain outside demonstrated coverage.

**AUDIT SOURCE FIXES COMPLETE — MANUAL DEVICE VERIFICATION REMAINS**
