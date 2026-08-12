import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const migration = read(
  "supabase/migrations/202608110001_create_telegram_anonymous_chat_companion_v1.sql",
);
const claimFixMigration = read(
  "supabase/migrations/202608110002_fix_telegram_delivery_claim_ambiguity.sql",
);
const route = read("app/api/integrations/telegram/webhook/route.ts");
const webhook = read("lib/telegram/webhook.ts");
const botApi = read("lib/telegram/bot-api.ts");
const worker = read("scripts/process-telegram-outbox.mjs");
const runner = read("lib/telegram/delivery-runner.ts");
const runnerRoute = read("app/api/internal/telegram/delivery/route.ts");
const vercelConfig = read("vercel.json");
const panel = read("components/messages/telegram-companion-panel.tsx");
const setting = read("components/settings/telegram-companion-setting.tsx");

function functionBody(name: string) {
  return (
    migration.match(
      new RegExp(
        `create or replace function public\\.${name}[\\s\\S]*?\\n\\$\\$;`,
      ),
    )?.[0] ?? ""
  );
}

function tableBody(name: string) {
  return (
    migration.match(
      new RegExp(`create table public\\.${name}[\\s\\S]*?\\n\\);`),
    )?.[0] ?? ""
  );
}

const stateProjection =
  (
    functionBody("get_my_telegram_companion_state").match(
      /returns table \(([\s\S]*?)\)\s*language/,
    )?.[1] ?? ""
  ) +
  panel +
  setting;
const unlink = functionBody("unlink_my_telegram_companion");
const telegramUnlink = functionBody(
  "unlink_telegram_companion_by_fingerprint",
);
const ingress = functionBody("send_anonymous_message_from_telegram");
const sharedMessage = functionBody("insert_anonymous_message_for_actor");
const claim = functionBody("claim_telegram_delivery");

const webhookChecks: [string, () => void][] = [
  ["rejects non-POST methods by defining POST only", () => assert.doesNotMatch(route, /export async function (GET|PUT|PATCH|DELETE)/)],
  ["fails closed when kill switch is off", () => assert.match(route, /!isTelegramCompanionEnabled\(\)/)],
  ["requires the official secret header", () => assert.match(route, /x-telegram-bot-api-secret-token/)],
  ["compares webhook secret in constant time", () => assert.match(route, /timingSafeEqual/)],
  ["returns a generic not-found response for bad secret", () => assert.match(route, /if \(!hasValidSecret\(request\)\) return response\(404\)/)],
  ["requires JSON content type", () => assert.match(route, /startsWith\("application\/json"\)/)],
  ["bounds declared content length", () => assert.match(route, /declaredLength > TELEGRAM_WEBHOOK_MAX_BYTES/)],
  ["bounds actual UTF-8 body size", () => assert.match(route, /TextEncoder\(\)\.encode\(raw\)\.byteLength/)],
  ["rejects malformed JSON", () => assert.match(route, /JSON\.parse\(raw\)[\s\S]*return response\(400\)/)],
  ["validates Telegram update shape", () => assert.match(route, /telegramUpdateSchema\.safeParse/)],
  ["enforces private direct chats", () => assert.match(webhook, /message\.chat\.type !== "private"/)],
  ["does not log update, identity, or message body", () => assert.doesNotMatch(route + webhook, /console\.(log|error|warn)|JSON\.stringify\(update\)/)],
];

for (const [name, check] of webhookChecks) {
  test(`webhook security: ${name}`, check);
}

const linkingChecks: [string, () => void][] = [
  ["requires authenticated StudyDate user", () => assert.match(functionBody("create_my_telegram_link_session"), /actor uuid := auth\.uid\(\)/)],
  ["requires conversation participation", () => assert.match(functionBody("create_my_telegram_link_session"), /actor in \([\s\S]*participant_sender_id[\s\S]*participant_recipient_id/)],
  ["requires active conversation eligibility", () => assert.match(functionBody("is_telegram_conversation_eligible"), /shell\.status = 'active'/)],
  ["excludes ineligible students and staff through existing gate", () => assert.match(functionBody("is_telegram_conversation_eligible"), /is_eligible_introduction_student/)],
  ["uses a strict opaque token hash format", () => assert.match(tableBody("telegram_link_sessions"), /token_hash ~ '\^\[0-9a-f\]\{64\}\$'/)],
  ["stores no plaintext token column", () => assert.doesNotMatch(tableBody("telegram_link_sessions"), /token_plain|start_token|raw_token/)],
  ["enforces a maximum fifteen-minute lifetime", () => assert.match(tableBody("telegram_link_sessions"), /interval '15 minutes'/)],
  ["revokes previous unused sessions", () => assert.match(functionBody("create_my_telegram_link_session"), /status = 'revoked'[\s\S]*status in \('created', 'telegram_pending'\)/)],
  ["bot start produces telegram_pending only", () => assert.match(functionBody("accept_telegram_link_token"), /status = 'telegram_pending'/)],
  ["bot start cannot call confirmation RPC", () => assert.doesNotMatch(webhook, /confirm_my_telegram_binding/)],
  ["confirmation requires authenticated user", () => assert.match(functionBody("confirm_my_telegram_binding"), /actor uuid := auth\.uid\(\)/)],
  ["confirmation is scoped to session owner", () => assert.match(functionBody("confirm_my_telegram_binding"), /session\.user_id = actor/)],
  ["confirmation requires pending state", () => assert.match(functionBody("confirm_my_telegram_binding"), /status <> 'telegram_pending'/)],
  ["confirmation rechecks expiry", () => assert.match(functionBody("confirm_my_telegram_binding"), /expires_at <= timezone\('utc', now\(\)\)/)],
  ["one binding row is enforced per StudyDate user", () => assert.match(tableBody("telegram_account_bindings"), /user_id uuid not null unique/)],
  ["one active Telegram fingerprint is globally unique", () => assert.match(migration, /telegram_account_bindings_identity_uidx[\s\S]*where identity_fingerprint is not null and revoked_at is null/)],
  ["conflicts do not silently transfer an account", () => assert.match(functionBody("confirm_my_telegram_binding"), /telegram account unavailable|unlink existing telegram account first/)],
  ["switch requires confirmation and atomically replaces one relay", () => {
    assert.match(functionBody("confirm_my_telegram_binding"), /switch_required/);
    assert.match(tableBody("telegram_conversation_relays"), /user_id uuid primary key/);
    assert.match(functionBody("confirm_my_telegram_binding"), /on conflict \(user_id\) do update/);
  }],
];

for (const [name, check] of linkingChecks) {
  test(`linking security: ${name}`, check);
}

const relayChecks: [string, () => void][] = [
  ["derives StudyDate actor from private binding", () => assert.match(ingress, /binding\.user_id/)],
  ["accepts no browser-supplied actor UUID", () => assert.doesNotMatch(ingress, /p_actor uuid/)],
  ["requires an active relay", () => assert.match(ingress, /candidate\.revoked_at is null/)],
  ["requires active eligible conversation", () => assert.match(ingress, /is_telegram_conversation_eligible/)],
  ["uses existing normalization", () => assert.match(sharedMessage, /normalize_anonymous_message/)],
  ["enforces message length", () => assert.match(sharedMessage, /char_length\(normalized\) not between 1 and 1000/)],
  ["uses existing message rate limits", () => assert.match(sharedMessage, /sent_last_minute >= 20 or sent_last_day >= 300/)],
  ["uses existing contact-sharing filter", () => assert.match(sharedMessage, /introduction_message_has_contact/)],
  ["uses update-derived idempotency", () => assert.match(ingress, /'tg_' \|\| p_update_id::text/)],
  ["deduplicates Telegram update before insert", () => assert.match(ingress, /on conflict \(update_id\) do nothing[\s\S]*return 'duplicate'/)],
  ["rejects media without downloading files", () => {
    assert.match(webhook, /typeof message\.text !== "string"/);
    assert.doesNotMatch(webhook, /getFile|download|file_id/);
  }],
  ["writes the same anonymous_messages source of truth", () => assert.match(sharedMessage, /insert into public\.anonymous_messages/)],
];

for (const [name, check] of relayChecks) {
  test(`message relay: ${name}`, check);
}

const deliveryChecks: [string, () => void][] = [
  ["queues from normal anonymous message insertion", () => assert.match(migration, /after insert on public\.anonymous_messages/)],
  ["selects counterpart rather than sender", () => assert.match(functionBody("queue_telegram_delivery"), /when shell\.participant_sender_id = new\.sender_id[\s\S]*participant_recipient_id/)],
  ["requires recipient relay on the same conversation", () => assert.match(functionBody("queue_telegram_delivery"), /relay\.user_id = recipient[\s\S]*relay\.conversation_id = shell\.id/)],
  ["does not queue tombstoned sender messages", () => assert.match(functionBody("queue_telegram_delivery"), /new\.sender_id is null/)],
  ["rechecks eligibility at claim time", () => assert.match(claim, /is_telegram_conversation_eligible/)],
  ["stores no duplicate message body in outbox", () => assert.doesNotMatch(tableBody("telegram_delivery_outbox"), /message_body|body text/)],
  ["uses a bounded exclusive lease", () => assert.match(claim, /for update skip locked[\s\S]*interval '2 minutes'/)],
  ["caps delivery attempts", () => assert.match(claim, /attempt_count < 5/)],
  ["honors Telegram 429 retry_after", () => assert.match(worker, /response\.status === 429[\s\S]*retry_after/)],
  ["handles Telegram 5xx as retryable unavailable", () => assert.match(worker, /response\.status >= 500[\s\S]*telegram_unavailable/)],
  ["never rolls back StudyDate message on network failure", () => assert.doesNotMatch(functionBody("queue_telegram_delivery"), /api\.telegram\.org|sendMessage/)],
  ["suppresses rich link previews", () => assert.match(worker + botApi, /link_preview_options: \{ is_disabled: true \}/)],
  ["uses a protected production scheduler endpoint", () => {
    assert.doesNotMatch(vercelConfig, /\/api\/internal\/telegram\/delivery/);
    assert.match(runnerRoute, /process\.env\.CRON_SECRET/);
    assert.match(runnerRoute, /authorization/);
    assert.match(runnerRoute, /timingSafeEqual/);
    assert.match(runnerRoute, /hasTelegramDeliveryConfiguration/);
  }],
  ["claims a bounded batch per scheduler invocation", () => {
    assert.match(runner, /TELEGRAM_DELIVERY_BATCH_SIZE = 25/);
    assert.match(runner, /index < TELEGRAM_DELIVERY_BATCH_SIZE/);
    assert.match(runner, /claim_telegram_delivery/);
  }],
];

for (const [name, check] of deliveryChecks) {
  test(`delivery reliability: ${name}`, check);
}

const claimFixChecks: [string, () => void][] = [
  ["keeps service-role-only authorization", () => {
    assert.match(claimFixMigration, /auth\.role\(\) <> 'service_role'/);
    assert.match(
      claimFixMigration,
      /revoke all on function public\.claim_telegram_delivery\(\)[\s\S]*from public, anon, authenticated/,
    );
    assert.match(
      claimFixMigration,
      /grant execute on function public\.claim_telegram_delivery\(\)[\s\S]*to service_role/,
    );
  }],
  ["uses a fixed empty search path and no dynamic SQL", () => {
    assert.match(claimFixMigration, /set search_path = ''/);
    assert.doesNotMatch(claimFixMigration, /execute\s+format|execute\s+immediate/i);
  }],
  ["qualifies attempt and lease columns", () => {
    assert.match(
      claimFixMigration,
      /attempt_count = outbox\.attempt_count \+ 1/,
    );
    assert.match(claimFixMigration, /outbox\.attempt_count < 5/);
    assert.match(claimFixMigration, /outbox\.lease_expires_at/);
  }],
  ["preserves bounded exclusive claim semantics", () => {
    assert.match(claimFixMigration, /for update of outbox skip locked/);
    assert.match(claimFixMigration, /limit 1/);
    assert.match(claimFixMigration, /interval '2 minutes'/);
  }],
  ["preserves the private worker projection only", () => {
    assert.match(
      claimFixMigration,
      /target_binding\.route_ciphertext[\s\S]*target_binding\.route_iv[\s\S]*target_binding\.route_auth_tag/,
    );
    assert.doesNotMatch(
      claimFixMigration,
      /username|first_name|last_name|language_code|identity_fingerprint/,
    );
  }],
];

for (const [name, check] of claimFixChecks) {
  test(`delivery claim forward fix: ${name}`, check);
}

const privateProjectionFields: [string, RegExp][] = [
  ["Telegram user ID", /telegram_user_id|telegramUserId/i],
  ["Telegram chat ID", /telegram_chat_id|chatId/i],
  ["Telegram username", /\busername\b/i],
  ["Telegram first name", /first_name|firstName/i],
  ["Telegram last name", /last_name|lastName/i],
  ["Telegram photo", /telegram.*photo|profile_photo/i],
  ["Telegram language code", /language_code|languageCode/i],
  ["identity fingerprint", /identity_fingerprint|identityFingerprint/i],
  ["routing ciphertext", /route_ciphertext|ciphertext/i],
  ["encryption key version", /encryption_key_version|keyVersion/i],
  ["student email", /\bemail\b/i],
  ["NIM", /\bNIM\b/],
  ["legal name", /legalName|nama legal/i],
  ["Identity Reveal photo", /identity.*photo|revealedPhoto/i],
  ["Contact Reveal value", /contactValue|contact_value/i],
  ["block reason", /blockReason|block_reason/i],
  ["report or one-sided state", /reportStatus|selectedByMe|counterpartSelected/i],
];

for (const [field, pattern] of privateProjectionFields) {
  test(`privacy projection excludes ${field}`, () => {
    assert.doesNotMatch(stateProjection, pattern);
  });
}

const unlinkChecks: [string, () => void][] = [
  ["requires authenticated user", () => assert.match(unlink, /actor uuid := auth\.uid\(\)/)],
  ["cannot target another StudyDate user", () => assert.match(unlink, /where binding\.user_id = actor/)],
  ["revokes only the caller relay", () => assert.match(unlink, /where relay\.user_id = actor/)],
  ["stops queued delivery for caller", () => assert.match(unlink, /where outbox\.recipient_user_id = actor/)],
  ["preserves Anonymous Chat history", () => assert.doesNotMatch(unlink + telegramUnlink, /delete from public\.anonymous_messages/)],
  ["preserves Contact Reveal", () => assert.doesNotMatch(unlink + telegramUnlink, /conversation_contact_reveal/)],
  ["invalidates pending link sessions", () => assert.match(unlink, /status in \('created', 'telegram_pending'\)/)],
  ["is idempotent and audits only a real state change", () => assert.match(unlink, /if changed then[\s\S]*'unlinked'/)],
];

for (const [name, check] of unlinkChecks) {
  test(`unlink: ${name}`, check);
}

const deletion = functionBody("revoke_telegram_for_account_deletion");
const purge = functionBody("purge_telegram_for_profile_delete");
const deletionChecks: [string, () => void][] = [
  ["deletion request triggers immediate Telegram revocation", () => assert.match(migration, /account_deletion_requests_revoke_telegram_v1/)],
  ["privacy lock revokes active relay", () => assert.match(deletion, /revoke_reason = coalesce\(revoke_reason, 'deletion'\)/)],
  ["privacy lock invalidates sessions and pending routing", () => assert.match(deletion, /pending_identity_fingerprint = null[\s\S]*pending_route_ciphertext = null/)],
  ["privacy lock makes ingress binding inactive", () => {
    assert.match(deletion, /binding\.revoked_at is null/);
    assert.match(ingress, /candidate\.revoked_at is null/);
  }],
  ["privacy lock cancels outgoing delivery", () => assert.match(deletion, /status = 'cancelled'[\s\S]*recipient_user_id = new\.user_id/)],
  ["final cleanup purges fingerprint and encrypted routing row", () => assert.match(purge, /delete from public\.telegram_account_bindings/)],
  ["cleanup is scoped and preserves other users' bindings", () => assert.match(purge, /where user_id = old\.user_id/)],
];

for (const [name, check] of deletionChecks) {
  test(`account deletion: ${name}`, check);
}
