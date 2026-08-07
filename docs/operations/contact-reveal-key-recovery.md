# Contact Reveal encryption key recovery

Repository-safe runbook. **Never** paste key values into Git, tickets, chat, README,
context files, audit artifacts, or browser storage.

Secret identifier (name only): `CONTACT_REVEAL_ENCRYPTION_KEY`  
Optional current version: `CONTACT_REVEAL_KEY_VERSION` (default `1`)  
Prior versions during rotation: `CONTACT_REVEAL_ENCRYPTION_KEY_V{n}`

---

## Architecture (current)

| Item | Value |
|------|--------|
| Algorithm | AES-256-GCM |
| Key length | 32 bytes (256-bit), hex (64 chars) or canonical Base64 |
| Nonce / IV | 12 random bytes per encryption (`crypto.randomBytes`) |
| Auth tag | GCM tag stored beside ciphertext |
| Key version | Explicit integer stored on `conversation_contact_versions.encryption_key_version` |
| Encrypt entry | `encryptContactValue` → `lib/contact-reveal/crypto-core.ts` (via server-only `crypto.ts`) |
| Decrypt entry | `decryptContactValue` with **required** `keyVersion` |
| Server boundary | `import "server-only"`; prepare/decrypt only on Next.js server + service-role cipher RPCs |
| Missing key | Fail closed (`Contact cryptography is unavailable`); no plaintext fallback |
| Wrong key | GCM authentication failure; fail closed |
| Unknown version | Fail closed — versions are never inferred from ciphertext bytes |

Rows already store `encryption_key_version`. New writes use the configured current version.
Decryption loads only an explicitly configured key for that version.

---

## Ownership

| Role | Responsibility |
|------|----------------|
| Owner | Approves backup location, recovers/rotates keys, confirms drills |
| Deploy operator | Injects env on the application host; never copies keys into tickets |

---

## Backup requirement (Owner)

Before limited rollout, Owner must complete the checklist below using an **approved
external** secret store (password manager with dual-control, org vault, etc.).

This repository **does not** contain a verified production backup. Do not claim a
backup exists until Owner confirms it.

**Loss of all copies of a required encryption key makes Contact Reveal ciphertext
encrypted with that key unrecoverable.**

---

## Owner verification checklist

Mark each item only after you have done it. Do **not** paste the key anywhere in this repo.

- [ ] An approved secure backup of `CONTACT_REVEAL_ENCRYPTION_KEY` exists outside Git
- [ ] Access to that backup works for at least two authorized people (or dual-control)
- [ ] Recovery ownership is named (primary + backup person)
- [ ] The key is **not** stored in Git, README, context, audit-artifacts, or ordinary notes
- [ ] A non-destructive restore verification succeeded (see below)
- [ ] Host env and backup agree on the same current `CONTACT_REVEAL_KEY_VERSION`

Until every box is checked, P1-01 remains **OPEN** for operational closure.

---

## Recovery answers (model)

1. **Where is the production key backed up?** Owner-approved external vault only (confirm via checklist).
2. **Who may retrieve it?** Named Owner (+ designated backup); never all staff by default.
3. **How to test recovery without exposing the key?** Run local synthetic drill:
   `npm run test:contact-reveal` (includes `contact-reveal-crypto-recovery.test.ts`).
   Separately, Owner may encrypt/decrypt a **synthetic** value on a staging host after
   restoring the key into a temporary env — never log plaintext or key material.
4. **Host loses env configuration?** Redeploy env from the approved vault; historical rows
   decrypt only if the matching version keys are restored (`CONTACT_REVEAL_ENCRYPTION_KEY`
   and any still-needed `_V{n}` entries).
5. **Key permanently lost?** Ciphertext for that version is unrecoverable. Contact Reveal
   display fails closed for those rows. Users may re-prepare contacts only where product
   lifecycle still allows a new version.
6. **Effect on encrypted rows?** Rows remain; they cannot be decrypted without the key.
7. **Rotation?** See procedure below. Do not retire an old version until no live row needs it.
8. **Rollback if rotation fails?** Keep prior `_V{n}` keys configured; set
   `CONTACT_REVEAL_KEY_VERSION` back to the previous current version and restore that key
   as `CONTACT_REVEAL_ENCRYPTION_KEY`.
9. **Backup access audit?** Use the vault’s access log; do not invent in-app key access logs
   that could capture secret material.
10. **Exposed key revoked?** Treat as compromise: rotate immediately (procedure below),
    revoke vault shares, redeploy, assess who could have read DB + key.

---

## Restore procedure (production host)

1. Retrieve the key **only** from the approved vault (never from chat/Git).
2. Set server-only env: `CONTACT_REVEAL_ENCRYPTION_KEY`, matching `CONTACT_REVEAL_KEY_VERSION`,
   plus any `CONTACT_REVEAL_ENCRYPTION_KEY_V{n}` still required.
3. Restart the application process so env is loaded.
4. Verify with a **synthetic** Contact Reveal path on a non-production conversation, or confirm
   `isContactRevealKeyConfigured()` via existing server health without printing secrets.
5. Confirm application logs contain no key material, ciphertext dumps, or plaintext contacts.

---

## Rotation procedure (do not run against production casually)

1. Generate a new 32-byte key offline; store it in the vault **before** deploying.
2. Leave the old key available as `CONTACT_REVEAL_ENCRYPTION_KEY_V{oldVersion}`.
3. Set `CONTACT_REVEAL_ENCRYPTION_KEY` to the new key and
   `CONTACT_REVEAL_KEY_VERSION` to `{newVersion}`.
4. Deploy / restart. New prepares write `encryption_key_version = newVersion`.
5. Old rows remain decryptable via `_V{oldVersion}` until re-encrypted or retired.
6. Optional re-encryption of live rows is a **separate**, carefully reviewed operation —
   not required for limited rollout if dual-key window is maintained.
7. Retire `_V{oldVersion}` from host env **only** after confirming no live ciphertext
   still references that version.
8. If rotation fails: roll back current version + primary key env; keep vault copies of both.

Local simulation (synthetic keys only): covered by `tests/contact-reveal-crypto-recovery.test.ts`.

---

## Compromise procedure

1. Assume Contact Reveal plaintext is readable to anyone with DB + key.
2. Disable Contact Reveal prepares if a kill switch exists; otherwise take the app write path
   offline / redeploy with Contact Reveal env unset to fail closed.
3. Rotate to a new version; keep old key only as long as needed for legitimate participant
   decrypt during transition, then remove from hosts.
4. Preserve evidence (timestamps, access logs) without copying secret values.
5. Follow `docs/operations/moderation-triage.md` / incident playbook for user notification decisions.

---

## Prohibitions

- Do not copy the key into tickets, chat, Git, screenshots, or CI logs.
- Do not store the key in ordinary database tables or browser storage.
- Do not print ciphertext, IV, auth tags, or decrypted contacts in support tools.
- Do not rotate production keys as part of routine audits without Owner approval.

---

## Verification commands (no secrets)

```bash
npm run test:contact-reveal
```

Expect crypto recovery / rotation drills to pass. These tests generate ephemeral keys in-process
and must not load production `.env.local` values into assertions or logs.
