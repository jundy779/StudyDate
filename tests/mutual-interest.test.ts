import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MUTUAL_INTEREST_COPY } from "../lib/mutual-interest/constants.ts";
import { mutualInterestActionSchema } from "../lib/mutual-interest/validation.ts";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202608060004_create_mutual_interest_v1.sql",
    import.meta.url,
  ),
  "utf8",
);
const chatMigration = readFileSync(
  new URL(
    "../supabase/migrations/202608060003_create_anonymous_chat_v1.sql",
    import.meta.url,
  ),
  "utf8",
);
const service = readFileSync(
  new URL("../lib/mutual-interest/service.ts", import.meta.url),
  "utf8",
);
const panel = readFileSync(
  new URL("../components/messages/mutual-interest-panel.tsx", import.meta.url),
  "utf8",
);
const room = readFileSync(
  new URL("../components/messages/conversation-room.tsx", import.meta.url),
  "utf8",
);
const pollRoute = readFileSync(
  new URL("../app/api/messages/[publicId]/route.ts", import.meta.url),
  "utf8",
);
const actions = readFileSync(
  new URL("../app/app/messages/actions.ts", import.meta.url),
  "utf8",
);

test("mutual interest migration is local-forward and does not rewrite prior chat", () => {
  assert.match(
    migration,
    /202608060004|create table if not exists public\.conversation_mutual_interests/,
  );
  assert.match(migration, /conversation_mutual_interests/);
  assert.match(migration, /mutual_interest_at/);
  assert.doesNotMatch(migration, /drop table public\.anonymous_messages/i);
  assert.doesNotMatch(migration, /truncate /i);
});

test("eligibility requires active shell, both messengers, non-staff, not blocked", () => {
  assert.match(migration, /is_conversation_eligible_for_mutual_interest/);
  assert.match(migration, /shell\.status <> 'active'|status <> 'active'/);
  assert.match(migration, /is_eligible_introduction_student/);
  assert.match(migration, /users_are_blocked/);
  assert.match(migration, /sender_messages < 1 or recipient_messages < 1/);
  assert.match(migration, /introduction_request_id is null/);
});

test("one-sided interest is never projected to the counterpart", () => {
  assert.match(
    migration,
    /never inspect or return whether the counterpart has selected/i,
  );
  assert.match(migration, /project_mutual_interest_state/);
  assert.doesNotMatch(
    migration,
    /counterpart.*selected_by|other_participant_selected|selected_by_them/i,
  );
  assert.doesNotMatch(panel, /seseorang ingin|someone likes|match|❤️|heart/i);
  assert.doesNotMatch(panel, /Like|Match|kompatibilitas|countdown/i);
});

test("safe MutualInterestState shape is the only client contract", () => {
  assert.match(service, /selectedByMe/);
  assert.match(service, /canWithdraw/);
  assert.match(service, /mutualAt/);
  assert.doesNotMatch(service, /counterpart|otherSelected|interestedAt/i);
  assert.match(pollRoute, /mutualInterest/);
  assert.match(pollRoute, /selectedByMe/);
  assert.doesNotMatch(pollRoute, /counterpart_selected|other_selected/i);
});

test("select and withdraw use auth.uid and public id only", () => {
  assert.match(migration, /select_mutual_interest\(p_public_id text\)/);
  assert.match(migration, /withdraw_mutual_interest\(p_public_id text\)/);
  assert.match(migration, /get_mutual_interest_state\(p_public_id text\)/);
  assert.match(migration, /current_user_id uuid := auth\.uid\(\)/);
  assert.doesNotMatch(
    migration,
    /create or replace function public\.select_mutual_interest\([^)]*p_participant/,
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.select_mutual_interest\([^)]*p_user_id/,
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.select_mutual_interest\([^)]*p_mutual/,
  );
  assert.match(actions, /selectMutualInterestAction/);
  assert.match(actions, /withdrawMutualInterestAction/);
  assert.equal(
    mutualInterestActionSchema.safeParse({
      publicId: "ab".repeat(16),
    }).success,
    true,
  );
  assert.equal(
    mutualInterestActionSchema.safeParse({
      publicId: "not-a-public-id",
    }).success,
    false,
  );
});
test("mutual completion is atomic and records sanitized event only", () => {
  assert.match(migration, /active_count >= 2/);
  assert.match(migration, /mutual_interest_at = now_utc/);
  assert.match(migration, /mutual_interest_reached/);
  assert.doesNotMatch(
    migration,
    /event_type in \([\s\S]*mutual_interest_selected/,
  );
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
});

test("withdraw is allowed only before mutual completion", () => {
  assert.match(
    migration,
    /if shell\.mutual_interest_at is not null[\s\S]*project_mutual_interest_state/,
  );
  assert.match(migration, /withdrawn_at = now_utc/);
  assert.match(panel, /Batalkan pilihan|withdrawCta/);
  assert.match(panel, /canWithdraw/);
});

test("RLS revoke and authenticated-only grants", () => {
  assert.match(
    migration,
    /alter table public\.conversation_mutual_interests enable row level security/,
  );
  assert.match(
    migration,
    /revoke all on table public\.conversation_mutual_interests[\s\S]*from public, anon, authenticated/,
  );
  for (const name of [
    "get_mutual_interest_state",
    "select_mutual_interest",
    "withdraw_mutual_interest",
  ]) {
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${name}\\(text\\) from public, anon`),
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${name}\\(text\\) to authenticated`),
    );
  }
});

test("UI copy stays calm and privacy-first", () => {
  assert.equal(MUTUAL_INTEREST_COPY.selectCta, "Kenal Lebih Jauh");
  assert.equal(MUTUAL_INTEREST_COPY.privacyNote, "Pilihanmu tetap privat");
  assert.equal(MUTUAL_INTEREST_COPY.mutualTitle, "Mutual interest tercapai");
  assert.match(MUTUAL_INTEREST_COPY.mutualBody, /tetap menjaga privasi/i);
  assert.match(MUTUAL_INTEREST_COPY.mutualBody, /tahap terpisah/i);
  assert.match(room, /MutualInterestPanel/);
  assert.doesNotMatch(room, /Identity Reveal|Reveal identitas|buka kontak/i);
});

test("identity and contact fields are absent from mutual interest storage", () => {
  assert.doesNotMatch(
    migration,
    /first_name|legal_name|\bnim\b|telegram|whatsapp|instagram|email|phone|photo/i,
  );
  assert.match(
    migration,
    /conversation_id uuid not null[\s\S]*participant_id uuid not null/,
  );
});

test("chat foundation remains prerequisite", () => {
  assert.match(chatMigration, /anonymous_messages/);
  assert.match(chatMigration, /awaiting_chat', 'active', 'ended', 'blocked'/);
});
