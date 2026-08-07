import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  identityRevealConsentSchema,
  identityRevealProfileSchema,
} from "../lib/identity-reveal/validation.ts";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/202608060005_create_identity_reveal_v1.sql"),
  "utf8",
);
const constants = readFileSync(
  join(root, "lib/identity-reveal/constants.ts"),
  "utf8",
);
const service = readFileSync(
  join(root, "lib/identity-reveal/service.ts"),
  "utf8",
);
const photo = readFileSync(join(root, "lib/identity-reveal/photo.ts"), "utf8");
const panel = readFileSync(
  join(root, "components/messages/identity-reveal-panel.tsx"),
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
const profileRoute = readFileSync(
  join(root, "app/api/identity-reveal/profile/route.ts"),
  "utf8",
);
const mediaRoute = readFileSync(
  join(root, "app/api/identity-reveal/media/route.ts"),
  "utf8",
);
const mutualMigration = readFileSync(
  join(root, "supabase/migrations/202608060004_create_mutual_interest_v1.sql"),
  "utf8",
);

test("identity reveal migration is local-forward and conversation-scoped", () => {
  assert.match(migration, /Local-only until explicit remote preflight/);
  assert.match(migration, /Conversation-scoped \(NOT a global identity profile\)/);
  assert.match(migration, /identity_reveal_profile_versions/);
  assert.match(migration, /conversation_id uuid not null/);
  assert.match(migration, /identity_reveal_profile_versions_one_active_idx/);
  assert.match(migration, /conversation_identity_reveal_consents/);
  assert.match(migration, /conversation_identity_reveals/);
  assert.match(migration, /identity_revealed_at/);
  assert.doesNotMatch(migration, /drop table public\.conversation_shells/i);
  assert.doesNotMatch(migration, /truncate /i);
});

test("eligibility requires mutual interest, active shell, non-staff, not blocked", () => {
  assert.match(migration, /is_conversation_eligible_for_identity_reveal/);
  assert.match(migration, /mutual_interest_at is null/);
  assert.match(migration, /shell\.status <> 'active'/);
  assert.match(migration, /is_eligible_introduction_student/);
  assert.match(migration, /users_are_blocked/);
  assert.match(mutualMigration, /mutual_interest_at/);
});

test("one-sided prepare and consent are never projected to the counterpart", () => {
  assert.match(
    migration,
    /never inspect or return whether the counterpart prepared or consented/i,
  );
  assert.match(migration, /project_identity_reveal_state/);
  assert.doesNotMatch(
    migration,
    /counterpart_selected|other_participant_consented|selected_by_them|has_other_profile/i,
  );
  assert.doesNotMatch(
    panel,
    /seseorang menunggu|someone is waiting|1 dari 2|match|unlock/i,
  );
  assert.doesNotMatch(constants, /Match|Unlock|Secret admirer|countdown/i);
});

test("safe IdentityRevealState shape is the only pre-completion client contract", () => {
  assert.match(constants, /hasProfile/);
  assert.match(constants, /selectedByMe/);
  assert.match(constants, /canWithdraw/);
  assert.match(constants, /completedAt/);
  assert.doesNotMatch(
    constants,
    /counterpartPrepared|otherSelected|selectedByOther/i,
  );
  assert.match(pollRoute, /identityReveal/);
  assert.match(pollRoute, /hasProfile/);
  assert.doesNotMatch(
    pollRoute,
    /photo_object_key|selected_by_other|selectedByOther/i,
  );
});

test("consent RPCs use auth.uid and public id; client cannot forge completion", () => {
  assert.match(migration, /select_identity_reveal\(/);
  assert.match(migration, /p_profile_version_id uuid/);
  assert.match(migration, /withdraw_identity_reveal\(p_public_id text\)/);
  assert.match(migration, /get_identity_reveal_state\(p_public_id text\)/);
  assert.match(migration, /current_user_id uuid := auth\.uid\(\)/);
  assert.doesNotMatch(migration, /p_completed|p_revealed\b/);
  assert.equal(
    identityRevealConsentSchema.safeParse({
      publicId: "ab".repeat(16),
      profileVersionId: "11111111-1111-4111-8111-111111111111",
    }).success,
    true,
  );
  assert.equal(
    identityRevealConsentSchema.safeParse({
      publicId: "not-valid",
      profileVersionId: "11111111-1111-4111-8111-111111111111",
    }).success,
    false,
  );
});

test("profile versions are conversation-scoped immutable snapshots", () => {
  assert.match(migration, /superseded_at/);
  assert.match(migration, /Invalidate pending \(pre-completion\) consents/);
  assert.match(migration, /register_identity_reveal_profile_version/);
  assert.match(migration, /p_public_id text/);
  assert.match(migration, /profile\.conversation_id <> shell\.id|profile\.conversation_id = shell\.id/);
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.match(migration, /conversation_identity_reveals/);
  assert.match(migration, /sender_profile_version_id/);
  assert.match(migration, /recipient_profile_version_id/);
  assert.match(service, /p_public_id: input\.publicId/);
  assert.match(profileRoute, /publicId/);
});

test("completed reveal returns names only via completed RPC", () => {
  assert.match(migration, /get_completed_identity_reveal/);
  assert.match(migration, /mine_first_name/);
  assert.match(migration, /counterpart_first_name/);
  const completedFn = migration.slice(
    migration.indexOf(
      "create or replace function public.get_completed_identity_reveal",
    ),
    migration.indexOf(
      "revoke all on function public.get_completed_identity_reveal",
    ),
  );
  assert.doesNotMatch(completedFn, /photo_object_key/);
  assert.match(mediaRoute, /literal\("completed"\)/);
  assert.match(mediaRoute, /private, no-store/);
});

test("post-completion end retains; block hides counterpart name and media", () => {
  assert.match(migration, /status = ended: both participants retain/i);
  assert.match(migration, /hide counterpart identity\/media/i);
  assert.match(migration, /is_blocked and p_which = 'counterpart'/);
  assert.match(constants, /completedBlockedBody/);
  assert.match(constants, /sudah sempat dilihat tidak dapat dihapus/i);
  assert.match(panel, /completedBlockedBody/);
  assert.match(panel, /counterpartUnavailable/);
});

test("photo pipeline validates content, re-encodes, and uses private bucket", () => {
  assert.match(migration, /identity-reveal-photos/);
  assert.match(migration, /false,\s*\n\s*5242880|false,\s*5242880/);
  assert.match(photo, /sharp/);
  assert.match(photo, /animated: false/);
  assert.match(photo, /rotate\(/);
  assert.match(photo, /jpeg\(/);
  assert.match(profileRoute, /createIdentityRevealProfile/);
  assert.match(service, /IDENTITY_REVEAL_PHOTO_BUCKET/);
});

test("first name is user-provided and not derived from legal or auth identity", () => {
  assert.match(constants, /Nama depan yang ingin kamu tampilkan/);
  assert.match(constants, /bukan nama legal/i);
  assert.doesNotMatch(migration, /from public\.profiles[\s\S]*first_name/);
  assert.doesNotMatch(
    service,
    /profiles\.first_name|legal_name|auth\.users\.email/,
  );
  assert.equal(
    identityRevealProfileSchema.safeParse({
      publicId: "ab".repeat(16),
      firstName: "Andi",
    }).success,
    true,
  );
  assert.equal(
    identityRevealProfileSchema.safeParse({
      firstName: "Andi",
    }).success,
    false,
  );
  assert.equal(
    identityRevealProfileSchema.safeParse({
      publicId: "ab".repeat(16),
      firstName: "test@example.com",
    }).success,
    false,
  );
  assert.equal(
    identityRevealProfileSchema.safeParse({
      publicId: "ab".repeat(16),
      firstName: "https://x.com",
    }).success,
    false,
  );
});

test("completion is atomic with a single sanitized event", () => {
  assert.match(migration, /identity_revealed/);
  assert.match(migration, /active_count >= 2/);
  assert.match(migration, /identity_revealed_at = now_utc/);
  assert.doesNotMatch(
    migration,
    /event_type in \([\s\S]*identity_reveal_selected/,
  );
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
});

test("withdraw is allowed only before completion", () => {
  assert.match(migration, /withdraw_identity_reveal/);
  assert.match(
    migration,
    /if shell\.identity_revealed_at is not null then[\s\S]*project_identity_reveal_state/,
  );
});

test("RLS revoke-all and authenticated-only grants", () => {
  assert.match(
    migration,
    /revoke all on table public\.conversation_identity_reveal_consents/,
  );
  assert.match(
    migration,
    /revoke all on table public\.identity_reveal_profile_versions/,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_identity_reveal_state\(text\) to authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.select_identity_reveal\(text, uuid\) to authenticated/,
  );
});

test("UI is gated on Mutual Interest and uses calm consent copy", () => {
  assert.match(room, /IdentityRevealPanel/);
  assert.match(room, /mutualCompleted=\{mutualInterest\.mutual\}/);
  assert.match(constants, /Setujui Pembukaan Identitas/);
  assert.match(panel, /consentCta/);
  assert.match(panel, /privacyNote/);
  assert.match(constants, /Identitas telah dibuka/);
  assert.match(constants, /Nama lengkap dan kontak/);
});

test("no contact reveal fields stored in identity reveal migration tables", () => {
  assert.doesNotMatch(
    migration,
    /telegram_username|whatsapp_number|instagram_handle|phone_number|legal_name|nim_ciphertext/i,
  );
  assert.doesNotMatch(constants, /Contact Reveal|WhatsApp|Telegram/);
});

test("static contract suite is distinct from behavioral and hydrate coverage", () => {
  const pkg = readFileSync(join(root, "package.json"), "utf8");
  assert.match(pkg, /identity-reveal-behavior\.test\.ts/);
  assert.match(pkg, /identity-reveal-hydrate\.test\.ts/);
});
