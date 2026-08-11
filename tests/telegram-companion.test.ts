import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  createTelegramLinkToken,
  decryptTelegramRoute,
  encryptTelegramRoute,
  fingerprintTelegramIdentity,
  hashTelegramLinkToken,
} from "../lib/telegram/crypto-core.ts";
import {
  parseTelegramCommand,
  telegramUpdateSchema,
} from "../lib/telegram/validation.ts";

const root = join(import.meta.dirname, "..");
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/202608110001_create_telegram_anonymous_chat_companion_v1.sql",
  ),
  "utf8",
);
const webhookRoute = readFileSync(
  join(root, "app/api/integrations/telegram/webhook/route.ts"),
  "utf8",
);
const webhook = readFileSync(join(root, "lib/telegram/webhook.ts"), "utf8");
const botApi = readFileSync(join(root, "lib/telegram/bot-api.ts"), "utf8");
const service = readFileSync(join(root, "lib/telegram/service.ts"), "utf8");
const panel = readFileSync(
  join(root, "components/messages/telegram-companion-panel.tsx"),
  "utf8",
);
const setting = readFileSync(
  join(root, "components/settings/telegram-companion-setting.tsx"),
  "utf8",
);
const worker = readFileSync(
  join(root, "scripts/process-telegram-outbox.mjs"),
  "utf8",
);
const deletionMigration = readFileSync(
  join(
    root,
    "supabase/migrations/202608100003_harden_account_deletion_runtime.sql",
  ),
  "utf8",
);

const cryptoEnv = {
  NODE_ENV: "test",
  TELEGRAM_COMPANION_ENCRYPTION_KEY: "11".repeat(32),
  TELEGRAM_COMPANION_HMAC_KEY: "22".repeat(32),
  TELEGRAM_COMPANION_KEY_VERSION: "1",
} as NodeJS.ProcessEnv;
const syntheticTelegramId = "999001";

test("link token is opaque, constrained, hashed, and never persisted in plaintext", () => {
  const token = createTelegramLinkToken();
  assert.match(token, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(token.includes("-".repeat(8)), false);
  const hash = hashTelegramLinkToken(token, cryptoEnv);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, token);
  assert.match(migration, /token_hash text not null unique/);
  assert.doesNotMatch(migration, /token_plaintext|link_token text/);
  assert.match(migration, /p_ttl_seconds not between 300 and 900/);
});

test("Telegram route uses dedicated AES-GCM key and keyed identity fingerprint", () => {
  const encrypted = encryptTelegramRoute(syntheticTelegramId, cryptoEnv);
  assert.notEqual(encrypted.ciphertext, syntheticTelegramId);
  assert.equal(decryptTelegramRoute(encrypted, cryptoEnv), syntheticTelegramId);
  assert.match(
    fingerprintTelegramIdentity(syntheticTelegramId, cryptoEnv),
    /^[0-9a-f]{64}$/,
  );
  assert.throws(() =>
    decryptTelegramRoute(
      { ...encrypted, authTag: `\\x${"00".repeat(16)}` },
      cryptoEnv,
    ),
  );
  assert.doesNotMatch(
    service,
    /CONTACT_REVEAL_ENCRYPTION_KEY|STUDENT_VERIFICATION_HMAC_KEY/,
  );
});

test("webhook rejects GET, bad content, oversized body, and invalid secret", () => {
  assert.doesNotMatch(webhookRoute, /export async function GET/);
  assert.match(webhookRoute, /timingSafeEqual/);
  assert.match(webhookRoute, /x-telegram-bot-api-secret-token/);
  assert.match(webhookRoute, /status >= 200 && status < 300/);
  assert.match(webhookRoute, /return response\(404\)/);
  assert.match(webhookRoute, /return response\(415\)/);
  assert.match(webhookRoute, /return response\(413\)/);
  assert.match(webhookRoute, /return response\(400\)/);
  assert.match(webhookRoute, /request\.text\(\)/);
  assert.doesNotMatch(webhookRoute, /console\.|JSON\.stringify\(parsed\.data\)/);
});

test("synthetic webhook fixtures validate without real Telegram identity", () => {
  const fixture = {
    update_id: 800000001,
    message: {
      message_id: 1,
      from: { id: 999001, is_bot: false },
      chat: { id: 999001, type: "private" },
      text: "/start AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    },
  };
  assert.equal(telegramUpdateSchema.safeParse(fixture).success, true);
  assert.equal(
    telegramUpdateSchema.safeParse({
      ...fixture,
      update_id: "not-an-integer",
    }).success,
    false,
  );
  assert.deepEqual(parseTelegramCommand("/unlink"), {
    command: "unlink",
    argument: null,
  });
});

test("private chat and text-only command set are enforced", () => {
  assert.match(webhook, /message\.chat\.type !== "private"/);
  assert.match(webhook, /message\.from\?\.is_bot/);
  assert.match(webhook, /command\?\.command === "start"/);
  assert.match(webhook, /command\?\.command === "help"/);
  assert.match(webhook, /command\?\.command === "unlink"/);
  assert.doesNotMatch(
    webhook,
    /command\?\.command === "(match|find|people|reveal|contact|mutual|whoami|partner)"/,
  );
  assert.match(webhook, /hanya mendukung pesan teks/);
  assert.doesNotMatch(webhook, /getFile|download|photo\[/);
});

test("deep link alone remains pending until authenticated confirmation", () => {
  assert.match(migration, /status = 'telegram_pending'/);
  assert.match(migration, /create or replace function public\.confirm_my_telegram_binding/);
  assert.match(migration, /actor uuid := auth\.uid\(\)/);
  assert.match(migration, /target_session\.user_id = actor|session\.user_id = actor/);
  assert.match(migration, /target_session\.status <> 'telegram_pending'/);
  assert.match(migration, /status = 'confirmed'/);
  assert.match(webhook, /Kembali ke StudyDate untuk menyelesaikan koneksi/);
  assert.doesNotMatch(webhook, /confirm_my_telegram_binding/);
});

test("linking authorization, expiry, uniqueness, and replay are database-enforced", () => {
  assert.match(migration, /public\.is_telegram_conversation_eligible/);
  assert.match(migration, /public\.is_eligible_introduction_student/);
  assert.match(migration, /public\.users_are_blocked/);
  assert.match(migration, /shell\.status = 'active'/);
  assert.match(migration, /expires_at <= timezone\('utc', now\(\)\)/);
  assert.match(migration, /telegram_account_bindings_identity_uidx/);
  assert.match(migration, /user_id uuid not null unique/);
  assert.match(migration, /telegram_update_receipts/);
  assert.match(migration, /return 'duplicate'/);
  assert.match(migration, /status = 'revoked'[\s\S]*telegram_pending/);
});

test("switch is explicit and one active relay per StudyDate user is atomic", () => {
  assert.match(
    migration,
    /telegram_conversation_relays \([\s\S]*user_id uuid primary key/,
  );
  assert.match(migration, /if did_switch and not coalesce\(p_confirm_switch, false\)/);
  assert.match(migration, /return query select 'switch_required'/);
  assert.match(migration, /on conflict \(user_id\) do update set/);
  assert.match(panel, /Telegram saat ini terhubung ke percakapan lain/);
  assert.match(panel, /Percakapan lama[\s\S]*tetap tersedia di web/);
});

test("Telegram ingress uses the same Anonymous Chat insertion policy", () => {
  assert.match(migration, /insert_anonymous_message_for_actor/);
  assert.match(migration, /public\.normalize_anonymous_message\(p_body\)/);
  assert.match(migration, /char_length\(normalized\) not between 1 and 1000/);
  assert.match(migration, /public\.introduction_message_has_contact\(normalized\)/);
  assert.match(migration, /sent_last_minute >= 20 or sent_last_day >= 300/);
  assert.match(migration, /recent_duplicate > 0/);
  assert.match(migration, /'tg_' \|\| p_update_id::text/);
  assert.match(migration, /binding\.user_id/);
  assert.match(migration, /p_require_active and shell\.status <> 'active'/);
  const helperGrant = migration.match(
    /revoke all on function public\.insert_anonymous_message_for_actor[\s\S]*?;/,
  )?.[0] ?? "";
  assert.doesNotMatch(helperGrant, /grant execute/);
});

test("normal message trigger creates durable recipient-only outbox without self echo", () => {
  assert.match(migration, /anonymous_messages_queue_telegram_v1/);
  assert.match(migration, /when shell\.participant_sender_id = new\.sender_id/);
  assert.match(migration, /if new\.sender_id is null/);
  assert.match(migration, /anonymous_message_id uuid not null unique/);
  assert.match(migration, /recipient_user_id uuid not null/);
  assert.match(migration, /relay\.conversation_id = shell\.id/);
  assert.match(migration, /on conflict \(anonymous_message_id\) do nothing/);
  assert.doesNotMatch(
    migration.match(/create table public\.telegram_delivery_outbox[\s\S]*?\);/)?.[0] ?? "",
    /message_body|body text/,
  );
});

test("delivery worker rechecks eligibility and uses leased bounded retries", () => {
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /attempt_count < 5/);
  assert.match(migration, /interval '2 minutes'/);
  assert.match(migration, /public\.is_telegram_conversation_eligible/);
  assert.match(migration, /status = 'cancelled'/);
  assert.match(migration, /least\([\s\S]*3600/);
  assert.match(worker, /--limit must be an integer between 1 and 100/);
  assert.match(worker, /link_preview_options: \{ is_disabled: true \}/);
  assert.match(worker, /AbortSignal\.timeout\(10_000\)/);
  assert.doesNotMatch(worker, /console\.(log|error|warn)/);
  assert.doesNotMatch(
    worker,
    /process\.stdout\.write\([\s\S]*?(message_body|chatId|botToken)/,
  );
});

test("delivery failure never rolls back the StudyDate message", () => {
  const outboxTrigger = migration.match(
    /create or replace function public\.queue_telegram_delivery[\s\S]*?create trigger anonymous_messages_queue_telegram_v1[\s\S]*?;/,
  )?.[0] ?? "";
  assert.match(outboxTrigger, /after insert on public\.anonymous_messages/);
  assert.doesNotMatch(outboxTrigger, /sendMessage|api\.telegram\.org/);
  assert.match(migration, /status text not null default 'pending'/);
});

test("block, end, deletion lock, and final cleanup revoke Telegram state", () => {
  assert.match(migration, /conversation_shells_revoke_telegram_v1/);
  assert.match(migration, /new\.status in \('ended', 'blocked'\)/);
  assert.match(migration, /account_deletion_requests_revoke_telegram_v1/);
  assert.match(migration, /revoke_reason = coalesce\(revoke_reason, 'deletion'\)/);
  assert.match(migration, /profiles_purge_telegram_v1/);
  for (const table of [
    "telegram_delivery_outbox",
    "telegram_conversation_relays",
    "telegram_link_sessions",
    "telegram_account_bindings",
  ]) {
    assert.match(migration, new RegExp(`delete from public\\.${table}`));
  }
  assert.match(deletionMigration, /delete from public\.profiles/);
});

test("unlink is self-scoped, private, idempotent, and independent from Contact Reveal", () => {
  assert.match(migration, /create or replace function public\.unlink_my_telegram_companion/);
  assert.match(migration, /actor uuid := auth\.uid\(\)/);
  assert.match(migration, /where binding\.user_id = actor/);
  assert.match(migration, /where session\.user_id = actor/);
  assert.doesNotMatch(
    migration.match(/create or replace function public\.unlink_my_telegram_companion[\s\S]*?\$\$;/)?.[0] ?? "",
    /conversation_contact|end_conversation|user_blocks|delete from public\.anonymous_messages/,
  );
  assert.match(
    setting,
    /Contact\s*[\r\n]+\s*Reveal tetap tidak berubah/,
  );
});

test("all Telegram tables are private and helpers have narrow grants", () => {
  for (const table of [
    "telegram_link_sessions",
    "telegram_account_bindings",
    "telegram_conversation_relays",
    "telegram_update_receipts",
    "telegram_delivery_outbox",
    "telegram_companion_rate_limits",
    "telegram_companion_audit_events",
  ]) {
    assert.match(migration, new RegExp(`'${table}'`));
  }
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\./);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.doesNotMatch(migration, /dynamic sql|execute format.*select/i);
});

test("client projection contains no Telegram or StudyDate private identity", () => {
  const stateFunction = migration.match(
    /create or replace function public\.get_my_telegram_companion_state[\s\S]*?end;\s*\$\$;/,
  )?.[0] ?? "";
  const returns = stateFunction.match(/returns table \(([\s\S]*?)\)\s*language/)?.[1] ?? "";
  assert.doesNotMatch(
    returns,
    /user_id|chat_id|username|first_name|last_name|ciphertext|fingerprint|key_version|conversation_id|uuid/i,
  );
  for (const source of [panel, setting]) {
    assert.doesNotMatch(
      source,
      /telegramUserId|chatId|username|first_name|last_name|profile_photo|language_code|ciphertext|auth_tag|UUID|NIM|email/,
    );
  }
});

test("no reveal or one-sided state is projected through Telegram", () => {
  assert.doesNotMatch(
    webhook,
    /get_mutual_interest_state|get_identity_reveal_state|get_contact_reveal_state|selected_by_me|has_profile|has_contact|counterpart/,
  );
  assert.match(webhook, /Atur privasi dan pembukaan informasi di StudyDate/);
  assert.doesNotMatch(
    botApi,
    /mineFirstName|counterpartFirstName|mineDisplay|counterpartDisplay/,
  );
});

test("privacy-sensitive values are absent from logs and audit storage", () => {
  for (const source of [webhookRoute, webhook, botApi, worker]) {
    assert.doesNotMatch(source, /console\.(log|error|warn)|process\.stderr\.write\([^)]*error/);
  }
  const auditTable = migration.match(
    /create table public\.telegram_companion_audit_events[\s\S]*?\);/,
  )?.[0] ?? "";
  assert.doesNotMatch(
    auditTable,
    /message_body|username|telegram_user|chat_id|token_hash|ciphertext|contact|email|nim/,
  );
});

test("kill switch defaults closed and no real Bot API is used by tests", () => {
  assert.match(botApi, /env\.TELEGRAM_COMPANION_ENABLED === "true"/);
  assert.match(webhookRoute, /!isTelegramCompanionEnabled\(\)/);
  assert.match(service, /!isTelegramCompanionEnabled\(\)/);
  assert.doesNotMatch(
    readFileSync(join(root, ".env.example"), "utf8"),
    /TELEGRAM_COMPANION_ENABLED=true/,
  );
  assert.doesNotMatch(import.meta.url, /api\.telegram\.org/);
});
