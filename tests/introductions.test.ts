import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  openingMessageHasContact,
  openingMessageSchema,
  sendIntroductionSchema,
} from "../lib/introductions/validation.ts";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202608060001_create_introduction_requests_v1.sql",
    import.meta.url,
  ),
  "utf8",
);
const service = readFileSync(
  new URL("../lib/introductions/service.ts", import.meta.url),
  "utf8",
);
const actions = readFileSync(
  new URL("../app/app/introductions/actions.ts", import.meta.url),
  "utf8",
);
const introductionsPage = readFileSync(
  new URL("../app/app/introductions/page.tsx", import.meta.url),
  "utf8",
);
const introductionCard = readFileSync(
  new URL("../components/introductions/introduction-card.tsx", import.meta.url),
  "utf8",
);
const acceptedLink = readFileSync(
  new URL(
    "../components/messages/accepted-conversation-link.tsx",
    import.meta.url,
  ),
  "utf8",
);
const detailPage = readFileSync(
  new URL("../app/app/people/[alias]/page.tsx", import.meta.url),
  "utf8",
);
const navigation = readFileSync(
  new URL("../components/navigation/responsive-navigation.tsx", import.meta.url),
  "utf8",
);
const staffShell = readFileSync(
  new URL("../components/staff/staff-shell.tsx", import.meta.url),
  "utf8",
);

test("anonymous and incomplete users are gated before introduction RPCs", () => {
  assert.match(migration, /authentication required/);
  assert.match(migration, /is_eligible_introduction_student/);
  assert.match(migration, /onboarding_completed_at is not null/);
  assert.match(introductionsPage, /getAuthenticatedUser/);
  assert.match(introductionsPage, /onboarding_completed_at/);
  assert.match(actions, /requireOnboardedStudent|getAuthenticatedUser/);
});

test("sender cannot introduce self and recipient resolves by alias only", () => {
  assert.match(migration, /cannot introduce self/);
  assert.match(migration, /p_recipient_alias/);
  assert.match(migration, /public_alias = p_recipient_alias/);
  assert.doesNotMatch(
    migration,
    /create or replace function public\.send_introduction_request\(\s*p_recipient_id/,
  );
  assert.equal(
    sendIntroductionSchema.safeParse({
      recipientAlias: "4c8d8484-1234-4567-9876-123456789012",
      openingMessage: "Halo, aku ingin berkenalan soal desain.",
    }).success,
    false,
  );
});

test("active staff cannot send or receive introductions", () => {
  assert.match(migration, /is_active_staff_user/);
  assert.match(migration, /not public\.is_active_staff_user\(p_user_id\)/);
  assert.match(migration, /not public\.is_active_staff_user\(profile\.user_id\)/);
  assert.match(migration, /sender not eligible/);
  assert.match(migration, /is_eligible_introduction_student\(current_user_id\)/);
});

test("hidden or ineligible recipients cannot receive new introductions", () => {
  assert.match(migration, /is_discoverable = true/);
  assert.match(migration, /recipient unavailable/);
  assert.match(migration, /participants retain list\/detail access/i);
});

test("users cannot read unrelated introductions or forge acceptance", () => {
  assert.match(migration, /recipient_id = current_user_id/);
  assert.match(migration, /sender_id = current_user_id/);
  assert.match(migration, /not request recipient/);
  assert.match(migration, /not request sender/);
  assert.doesNotMatch(actions, /status\s*=\s*['\"]accepted['\"]/);
  assert.match(migration, /status = 'accepted'/);
  assert.match(migration, /conversation_shells/);
});

test("role actions are constrained by participant side", () => {
  assert.match(migration, /accept_introduction_request/);
  assert.match(migration, /decline_introduction_request/);
  assert.match(migration, /cancel_introduction_request/);
  assert.match(
    migration,
    /if target\.recipient_id <> current_user_id[\s\S]*not request recipient/,
  );
  assert.match(
    migration,
    /if target\.sender_id <> current_user_id[\s\S]*not request sender/,
  );
});

test("duplicate active requests and durable rate limits are enforced", () => {
  assert.match(migration, /introduction_requests_one_pending_pair_idx/);
  assert.match(migration, /duplicate introduction/);
  assert.match(migration, /pending_outgoing >= 5/);
  assert.match(migration, /sent_last_hour >= 5/);
  assert.match(migration, /sent_last_day >= 15/);
  assert.match(migration, /interval '7 days'/);
  assert.match(migration, /introduction rate limited|introduction cooldown/);
});

test("status transitions are constrained", () => {
  assert.match(
    migration,
    /status in \('pending', 'accepted', 'declined', 'cancelled', 'expired'\)/,
  );
  assert.match(migration, /request not actionable/);
  assert.match(migration, /status <> 'pending'/);
});

test("opening message rejects obvious contact disclosure", () => {
  assert.equal(
    openingMessageSchema.safeParse("Halo, yuk belajar bersama desain UI.").success,
    true,
  );
  assert.equal(openingMessageHasContact("hubungi aku di 081234567890"), true);
  assert.equal(openingMessageHasContact("email saya di nama@kampus.ac.id"), true);
  assert.equal(openingMessageHasContact("telegram @belajarbersama"), true);
  assert.equal(openingMessageHasContact("https://wa.me/6281234567890"), true);
  assert.match(migration, /introduction_message_has_contact/);
  assert.match(migration, /contact disclosure blocked/);
});

test("block works both directions and report requires participation", () => {
  assert.match(migration, /users_are_blocked/);
  assert.match(migration, /blocker_id = p_user_a and block\.blocked_id = p_user_b/);
  assert.match(migration, /close_pending_introductions_for_block/);
  assert.match(migration, /not request participant/);
  assert.match(migration, /report_introduction_request/);
});

test("privacy-safe projections exclude private identity fields", () => {
  const receivedProjection = migration.match(
    /create or replace function public\.list_received_introduction_requests[\s\S]*?returns table \(([\s\S]*?)\)\s*language plpgsql/,
  );
  assert.ok(receivedProjection);

  for (const safeField of [
    "request_id",
    "counterpart_alias",
    "campus",
    "study_program",
    "opening_message",
    "status",
    "is_verified",
  ]) {
    assert.match(receivedProjection[1], new RegExp(safeField));
  }

  for (const privateField of [
    "sender_id",
    "recipient_id",
    "first_name",
    "email",
    "legal_name",
    "phone",
    "telegram",
    "instagram",
    "whatsapp",
  ]) {
    assert.doesNotMatch(receivedProjection[1], new RegExp(`\\b${privateField}\\b`));
  }
  assert.doesNotMatch(receivedProjection[1], /\bnim\b/i);

  assert.doesNotMatch(introductionsPage, /\/app\/introductions\/\[/);
  assert.doesNotMatch(
    detailPage,
    /profile\.first_name|\blegal_name\b|profile\.nim|@gmail/i,
  );
  assert.match(detailPage, /NIM tidak dibagikan ke pengguna lain/);
  assert.match(detailPage, /Kirim perkenalan/);
});

test("accepted handoff creates conversation shell and safe chat CTA", () => {
  assert.match(migration, /awaiting_chat/);
  assert.match(migration, /introduction_request_id uuid not null unique/);
  assert.match(
    introductionsPage,
    /Lanjutkan di Pesan untuk memulai percakapan anonim/,
  );
  assert.match(introductionCard, /Percakapan anonim sudah tersedia/);
  assert.match(
    introductionCard,
    /status === "accepted"[\s\S]*AcceptedConversationLink/,
  );
  assert.doesNotMatch(
    introductionsPage,
    /message composer|chat box|chat_open|kirim pesan chat/i,
  );
  assert.doesNotMatch(
    introductionCard,
    /participant_sender_id|legal_name|\bnim\b/i,
  );
  assert.doesNotMatch(service, /from\(["']messages["']\)/);
  // Non-accepted statuses must not render the chat handoff CTA component inline.
  assert.equal(
    (introductionCard.match(/AcceptedConversationLink/g) ?? []).length,
    2,
  ); // import + accepted branch usage
  assert.doesNotMatch(
    introductionCard,
    /status === "(pending|declined|cancelled|expired)"[\s\S]{0,200}AcceptedConversationLink/,
  );
  assert.match(
    acceptedLink,
    /getConversationPublicIdForIntroduction\(requestId\)/,
  );
  assert.match(acceptedLink, /\/app\/messages\/\$\{publicId\}/);
  assert.match(acceptedLink, /Mulai percakapan/);
  assert.match(acceptedLink, /href="\/app\/messages"/);
  assert.match(acceptedLink, /Buka Pesan/);
  assert.doesNotMatch(
    acceptedLink,
    /conversation_id|participant_|legal_name|\bnim\b|user_id/i,
  );
  assert.doesNotMatch(
    acceptedLink,
    /\/app\/messages\/\$\{requestId\}|\/app\/messages\/[0-9a-f-]{36}/i,
  );
});

test("RLS revoke and SECURITY DEFINER grants are authenticated-only", () => {
  for (const tableName of [
    "introduction_requests",
    "user_blocks",
    "user_reports",
    "conversation_shells",
    "introduction_events",
  ]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${tableName} enable row level security`),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all on table public\\.${tableName} from public, anon, authenticated`,
      ),
    );
  }

  for (const functionName of [
    "send_introduction_request",
    "accept_introduction_request",
    "decline_introduction_request",
    "cancel_introduction_request",
    "list_received_introduction_requests",
    "list_sent_introduction_requests",
    "block_student_by_alias",
    "report_introduction_request",
  ]) {
    assert.match(
      migration,
      new RegExp(`security definer[\\s\\S]*?${functionName}|${functionName}[\\s\\S]*?security definer`),
    );
    assert.match(migration, new RegExp(`set search_path = ''`));
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${functionName}`),
    );
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${functionName}`),
    );
  }

  assert.match(
    migration,
    /revoke all on function public\.is_active_staff_user\(uuid\)[\s\S]*from public, anon, authenticated/,
  );
});

test("student navigation includes Perkenalan and staff shell does not", () => {
  assert.match(navigation, /label: "Perkenalan"/);
  assert.match(navigation, /href: "\/app\/introductions"/);
  assert.match(navigation, /label: "Pesan"/);
  assert.match(navigation, /label: "Bantuan"/);
  assert.match(navigation, /href: "\/help"/);
  assert.match(navigation, /label: "Privasi & keamanan"/);
  assert.match(navigation, /href: "\/app\/account\/privacy"/);
  assert.doesNotMatch(staffShell, /\/app\/introductions/);
  assert.match(service, /rpc\(\s*[\n\r\s]*"send_introduction_request"/);
  assert.match(service, /rpc\(\s*[\n\r\s]*"list_received_introduction_requests"/);
});

test("People discovery excludes mutual blocks after introduction migration", () => {
  assert.match(migration, /not public\.users_are_blocked\(current_user_id, profile\.user_id\)/);
  assert.match(
    migration,
    /create or replace function public\.list_people_discovery_profiles/,
  );
});

const volatilityFix = readFileSync(
  new URL(
    "../supabase/migrations/202608060002_fix_introduction_rpc_volatility.sql",
    import.meta.url,
  ),
  "utf8",
);

test("list and eligibility RPCs are volatile so expiry writes are allowed", () => {
  for (const functionName of [
    "list_received_introduction_requests",
    "list_sent_introduction_requests",
    "count_pending_received_introductions",
    "get_introduction_send_eligibility",
  ]) {
    assert.match(
      volatilityFix,
      new RegExp(
        `create or replace function public\\.${functionName}[\\s\\S]*?language plpgsql\\s+volatile`,
      ),
    );
  }
  assert.doesNotMatch(
    volatilityFix,
    /list_received_introduction_requests[\s\S]*?language plpgsql\s+stable/,
  );
});
