# Telegram Anonymous Chat Companion v1

Status: **LOCAL-ONLY / NOT DEPLOYED**

Bot identity: `@StudyDateBot`

## Product boundary

Telegram Companion relays text for one existing eligible StudyDate Anonymous
Chat. It is not login, People discovery, matching, Contact Reveal, or a second
message database. Mutual Interest, Identity Reveal, Contact Reveal, report
detail, and privacy controls remain web-only.

V1 supports one active Telegram-relayed conversation per StudyDate user.
Switching requires explicit web confirmation. The previous StudyDate chat
remains available and its counterpart receives no switch signal.

## Link flow

1. Authenticated eligible Student creates a 10-minute link session.
2. Server returns a 32-character opaque deep-link token; only a keyed HMAC hash
   is stored.
3. `/start <token>` in a private chat with `@StudyDateBot` validates the token,
   records encrypted routing data, and sets `telegram_pending`.
4. The bot says: “Kembali ke StudyDate untuk menyelesaikan koneksi.”
5. The authenticated StudyDate initiator explicitly confirms.
6. Binding and active relay become active atomically.

Bot `/start` alone never activates a binding. No confirmation phrase was added:
the authenticated two-step state is authoritative, while a visible phrase
would add UX state without adding authentication strength.

## Private binding

- Telegram user identity lookup: HMAC-SHA-256 keyed fingerprint.
- Telegram private chat route: AES-256-GCM with a dedicated Telegram key and
  explicit key version.
- No Telegram username, first/last name, photo, language code, or other
  metadata is stored or projected.
- One active Telegram account per StudyDate account.
- One active StudyDate account per Telegram fingerprint.
- Conflicts fail closed; there is no silent transfer.

## Environment names

All are server-only:

- `TELEGRAM_COMPANION_ENABLED` — exact `true` enables runtime; default `false`.
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_COMPANION_ENCRYPTION_KEY`
- `TELEGRAM_COMPANION_HMAC_KEY`
- `TELEGRAM_COMPANION_KEY_VERSION`
- historical rotation keys:
  `TELEGRAM_COMPANION_ENCRYPTION_KEY_V{n}`

Encryption and HMAC keys must be distinct 32-byte values and must not reuse
Contact Reveal or Student Verification keys. Never add `NEXT_PUBLIC_`.

## BotFather and webhook — later rollout only

Do not perform these steps until migration approval, production delivery
runner selection, secrets, and live-test approval:

1. In BotFather, verify bot username `@StudyDateBot`.
2. Configure only `/start`, `/help`, `/unlink`.
3. Set the HTTPS webhook target:
   `https://studydate.id/api/integrations/telegram/webhook`.
4. Call official `setWebhook` with:
   - `allowed_updates=["message"]`
   - a random 32–256 character `secret_token` using only
     `A-Z a-z 0-9 _ -`
5. Store that same value as `TELEGRAM_WEBHOOK_SECRET`.

The route checks `X-Telegram-Bot-Api-Secret-Token` using a timing-safe
comparison, accepts POST JSON only, caps requests at 16 KiB, validates the
update schema, accepts private chats only, and deduplicates by `update_id`.
No raw update, identity, message body, token, or secret is logged.

## Commands and message types

- `/start <token>` — set pending link only.
- `/start` — help.
- `/help` — help.
- `/unlink` — revoke the caller's binding and relay.

Only plain text is relayed. Group/supergroup/channel use is rejected.
Photo/video/document/audio/voice/sticker/animation/contact/location/venue/poll
and other media are not downloaded and create no StudyDate message.

## Message policy

Telegram ingress derives the StudyDate actor from the private binding and uses
the same database insertion policy as web Anonymous Chat:

- active eligible participant;
- no block or deletion lock;
- normalized text, 1–1000 characters;
- existing best-effort contact-sharing filter;
- 20 messages/minute and 300/day;
- 8-second duplicate window;
- update-derived idempotency key.

Telegram is transport only. The same `anonymous_messages` row and existing
`MESSAGE_RECEIVED` notification are used. No Telegram notification type is
added.

## Outbound delivery

The database trigger only writes a durable outbox reference after the
StudyDate message commits. It does not perform network I/O and does not roll
back the StudyDate message on Telegram failure.

Run the bounded trusted executor:

```text
npm run telegram-outbox:process -- --limit=25
```

The executor claims rows with `FOR UPDATE SKIP LOCKED`, a two-minute lease,
rechecks relay/conversation/block/deletion eligibility, decrypts the route,
sends “Pesan baru” plus text with link preview disabled, and completes or
retries. Retry is bounded to five attempts with 15-second–1-hour backoff;
official 429 `retry_after` is honored. Failure categories are sanitized.

Operational blocker: this repository currently has no Vercel Cron, queue host,
Supabase scheduled job, or trusted external scheduler. The feature is not
deploy-ready until the Owner selects and configures a durable execution path
for this executor. A manual run is local/operational testing only.

## Rate limits and retention

- link sessions: 5/hour/user;
- confirmation: 10/hour/user;
- unlink: 10/hour/user;
- message ingress: authoritative Anonymous Chat limits;
- update receipts: 7 days;
- runtime rate windows: 2 days;
- link session: 10 minutes.

## Lifecycle and deletion

End/block immediately revokes the relay and cancels queued delivery with a
generic unavailable state. A deletion request immediately revokes relay and
link sessions and denies ingress/outbound. Final profile cleanup deletes
binding, encrypted route, fingerprint, link sessions, outbox, rate limits, and
Telegram audit rows. Anonymous Chat shared history follows existing tombstone
policy.

Unlinking only affects Telegram Companion. It does not delete chat history,
end the conversation, block the counterpart, or alter Contact Reveal.

## Rollback and disable

Immediate kill switch:

1. set `TELEGRAM_COMPANION_ENABLED=false`;
2. stop the outbox scheduler/runner;
3. remove the webhook with official `deleteWebhook` if it had been configured;
4. keep private binding data inaccessible while deciding migration rollback.

Because this migration is not applied in the current task, rollback today is
simply leaving the flag OFF and not configuring the webhook.

## Secret rotation

- Bot token compromise: rotate in BotFather, update server env, redeploy, never
  print or test the old token.
- Webhook secret compromise: set a new random secret in environment and
  `setWebhook` together.
- Encryption key: increment `TELEGRAM_COMPANION_KEY_VERSION`, preserve prior
  `..._V{n}` keys while ciphertext remains, then re-encrypt before retirement.
- HMAC key rotation changes identity/token fingerprints and requires a planned
  unlink/relink migration; do not rotate silently.

No real Bot API request, BotFather change, webhook configuration, real Telegram
identifier, or remote Supabase migration is part of the LOCAL-ONLY task.
