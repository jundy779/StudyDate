import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  contactRevealConsentSchema,
  contactRevealPrepareSchema,
  formatContactDisplay,
  formatContactHref,
  normalizeContactValue,
} from "../lib/contact-reveal/validation.ts";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/202608060006_create_contact_reveal_v1.sql"),
  "utf8",
);
const constants = readFileSync(
  join(root, "lib/contact-reveal/constants.ts"),
  "utf8",
);
const service = readFileSync(
  join(root, "lib/contact-reveal/service.ts"),
  "utf8",
);
const cryptoSrc = readFileSync(
  join(root, "lib/contact-reveal/crypto.ts"),
  "utf8",
);
const cryptoCoreSrc = readFileSync(
  join(root, "lib/contact-reveal/crypto-core.ts"),
  "utf8",
);
const panel = readFileSync(
  join(root, "components/messages/contact-reveal-panel.tsx"),
  "utf8",
);
const room = readFileSync(
  join(root, "components/messages/conversation-room.tsx"),
  "utf8",
);
const pollRoute = readFileSync(
  join(root, "app/api/messages/[publicId]/route.ts"),
  "utf8",
);
const prepareRoute = readFileSync(
  join(root, "app/api/contact-reveal/prepare/route.ts"),
  "utf8",
);
const identityMigration = readFileSync(
  join(root, "supabase/migrations/202608060005_create_identity_reveal_v1.sql"),
  "utf8",
);
const migration007 = readFileSync(
  join(
    root,
    "supabase/migrations/202608060007_fix_contact_reveal_channel_ambiguity.sql",
  ),
  "utf8",
);

test("contact reveal migration is conversation-scoped and applied remotely", () => {
  assert.match(migration, /Applied remotely to StudyDate project ctbqudtvrfezuoqcecyj/);
  assert.match(migration, /conversation_contact_versions/);
  assert.match(migration, /conversation_id uuid not null/);
  assert.match(migration, /conversation_contact_versions_one_active_idx/);
  assert.match(migration, /conversation_contact_reveal_consents/);
  assert.match(migration, /conversation_contact_reveals/);
  assert.match(migration, /channel in \('telegram', 'instagram', 'linkedin'\)/);
  assert.doesNotMatch(migration, /drop table public\.conversation_shells/i);
  assert.doesNotMatch(migration, /truncate /i);
  assert.doesNotMatch(
    migration,
    /create table[\s\S]*whatsapp|phone_number text|email_ciphertext/i,
  );
});

test("migration 007 fixes channel ambiguity with use_column and on conflict on constraint", () => {
  assert.match(migration007, /#variable_conflict use_column/);
  assert.match(migration007, /on conflict on constraint/);
  assert.match(
    migration007,
    /conversation_contact_reveal_consents_unique_participant_channel/,
  );
});

test("eligibility requires identity reveal, active shell, non-staff, not blocked", () => {
  assert.match(migration, /is_conversation_eligible_for_contact_reveal/);
  assert.match(migration, /identity_revealed_at is null/);
  assert.match(migration, /mutual_interest_at is null/);
  assert.match(migration, /shell\.status <> 'active'/);
  assert.match(migration, /is_eligible_introduction_student/);
  assert.match(migration, /users_are_blocked/);
  assert.match(identityMigration, /identity_revealed_at/);
});

test("one-sided prepare and consent are never projected to the counterpart", () => {
  assert.match(
    migration,
    /never exposes counterpart prepare\/consent|One-sided prepare\/consent is NEVER exposed/i,
  );
  assert.match(migration, /project_contact_reveal_channel_state/);
  assert.doesNotMatch(
    migration,
    /counterpart_selected|other_participant_consented|selected_by_them|has_other_contact/i,
  );
  assert.doesNotMatch(
    panel,
    /seseorang menunggu|someone is waiting|1 dari 2|buka semua|waiting for the other/i,
  );
  assert.doesNotMatch(
    constants,
    /Match|Unlock|Buka semua|countdown|Waiting for/i,
  );
});

test("safe ContactRevealChannelState is the only pre-completion client contract", () => {
  assert.match(constants, /hasContact/);
  assert.match(constants, /selectedByMe/);
  assert.match(constants, /canWithdraw/);
  assert.match(constants, /completedAt/);
  assert.doesNotMatch(
    constants,
    /counterpartPrepared|otherSelected|selectedByOther/i,
  );
  assert.match(pollRoute, /contactReveal/);
  assert.match(pollRoute, /hasContact/);
  assert.doesNotMatch(
    pollRoute,
    /ciphertext|contact_iv|selected_by_other|selectedByOther/i,
  );
});

test("consent RPCs use auth.uid and public id; client cannot forge completion", () => {
  assert.match(migration, /select_contact_reveal\(/);
  assert.match(migration, /p_contact_version_id uuid/);
  assert.match(migration, /withdraw_contact_reveal\(/);
  assert.match(migration, /get_contact_reveal_state\(p_public_id text\)/);
  assert.match(migration, /current_user_id uuid := auth\.uid\(\)/);
  assert.doesNotMatch(migration, /p_completed\b/);
  assert.equal(
    contactRevealConsentSchema.safeParse({
      publicId: "ab".repeat(16),
      channel: "telegram",
      contactVersionId: "11111111-1111-4111-8111-111111111111",
    }).success,
    true,
  );
  assert.equal(
    contactRevealConsentSchema.safeParse({
      publicId: "not-valid",
      channel: "telegram",
      contactVersionId: "11111111-1111-4111-8111-111111111111",
    }).success,
    false,
  );
});

test("contact versions are conversation-scoped immutable encrypted snapshots", () => {
  assert.match(migration, /superseded_at/);
  assert.match(migration, /register_contact_reveal_version/);
  assert.match(migration, /contact_ciphertext bytea/);
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.match(migration, /sender_contact_version_id|participant_a_contact_version_id|first_contact_version/);
  assert.match(service, /register_contact_reveal_version/);
  assert.match(prepareRoute, /prepareContactReveal/);
  assert.match(cryptoCoreSrc, /aes-256-gcm/);
  assert.match(cryptoCoreSrc, /CONTACT_REVEAL_ENCRYPTION_KEY/);
  assert.match(cryptoCoreSrc, /CONTACT_REVEAL_ENCRYPTION_KEY_V/);
  assert.match(cryptoCoreSrc, /encryption_key_version|keyVersion/);
  assert.match(cryptoSrc, /server-only/);
  assert.match(cryptoSrc, /crypto-core/);
});

test("channels are independent; no global open-all operation", () => {
  assert.match(migration, /primary key \(conversation_id, channel\)/);
  assert.match(constants, /Bagikan kontak secara bertahap/);
  assert.match(constants, /Setiap kontak hanya dibagikan jika kalian berdua setuju/);
  assert.doesNotMatch(panel, /Buka semua kontak|Setujui semua/i);
  assert.doesNotMatch(constants, /Buka semua|Open all contacts/i);
});

test("channel validation accepts only conservative telegram/instagram/linkedin", () => {
  assert.equal(normalizeContactValue("telegram", "@StudyDate_User"), "StudyDate_User");
  assert.equal(normalizeContactValue("instagram", "@campus.user"), "campus.user");
  assert.equal(
    normalizeContactValue(
      "linkedin",
      "https://www.linkedin.com/in/andi-campus/?trk=x",
    ),
    "https://www.linkedin.com/in/andi-campus",
  );
  assert.throws(() => normalizeContactValue("telegram", "ab"));
  assert.throws(() => normalizeContactValue("telegram", "https://t.me/x"));
  assert.throws(() => normalizeContactValue("instagram", "bad..user"));
  assert.throws(() =>
    normalizeContactValue("linkedin", "https://linkedin.com/company/x"),
  );
  assert.throws(() =>
    normalizeContactValue("linkedin", "http://www.linkedin.com/in/andi"),
  );
  assert.equal(formatContactDisplay("telegram", "andi_campus"), "@andi_campus");
  assert.equal(
    formatContactHref("telegram", "andi_campus"),
    "https://t.me/andi_campus",
  );
  assert.equal(
    contactRevealPrepareSchema.safeParse({
      publicId: "ab".repeat(16),
      channel: "whatsapp",
      value: "123",
    }).success,
    false,
  );
});

test("post-completion end retains; block hides counterpart contact", () => {
  assert.match(migration, /status = ended: both participants retain/i);
  assert.match(migration, /hide counterpart contact/i);
  assert.match(constants, /completedBlockedBody/);
  assert.match(constants, /sudah sempat dilihat tidak dapat dihapus/i);
  assert.match(panel, /completedBlockedBody/);
  assert.match(panel, /counterpartUnavailable/);
});

test("completion is atomic with a sanitized contact_revealed event per channel", () => {
  assert.match(migration, /contact_revealed/);
  assert.match(migration, /event_channel/);
  assert.match(migration, /active_count >= 2/);
  assert.match(migration, /conversation_events_one_contact_revealed_per_channel_idx/);
  assert.doesNotMatch(
    migration,
    /event_type in \([\s\S]*contact_reveal_selected/,
  );
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
});

test("RLS revoke-all and authenticated-only grants", () => {
  assert.match(
    migration,
    /revoke all on table public\.conversation_contact_reveal_consents/,
  );
  assert.match(
    migration,
    /revoke all on table public\.conversation_contact_versions/,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_contact_reveal_state\(text\) to authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.select_contact_reveal\(text, text, uuid\) to authenticated/,
  );
});

test("UI is gated on Identity Reveal and uses calm per-channel consent copy", () => {
  assert.match(room, /ContactRevealPanel/);
  assert.match(room, /identityRevealCompleted=\{Boolean\(identityReveal\.completed\)\}/);
  assert.match(constants, /Setujui berbagi Telegram/);
  assert.match(constants, /Persetujuanmu tetap privat/);
  assert.match(panel, /consentCtas/);
  assert.match(panel, /privacyNote/);
  assert.match(constants, /Kontak telah dibagikan/);
});

test("ciphertext is never returned through authenticated preview RPC", () => {
  const previewFn = migration.slice(
    migration.indexOf(
      "create or replace function public.get_contact_reveal_preview",
    ),
    migration.indexOf(
      "grant execute on function public.get_contact_reveal_preview",
    ),
  );
  assert.doesNotMatch(previewFn, /contact_ciphertext/);
  assert.match(migration, /resolve_contact_reveal_preview_cipher/);
  assert.match(migration, /get_completed_contact_reveal_cipher/);
  assert.match(service, /decryptContactValue/);
});

test("static contract suite is distinct from behavioral coverage", () => {
  const pkg = readFileSync(join(root, "package.json"), "utf8");
  assert.match(pkg, /contact-reveal-behavior\.test\.ts/);
});
