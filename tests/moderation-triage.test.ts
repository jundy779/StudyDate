/**
 * Moderation triage contracts (migration 008 + Owner UI).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { z } from "zod";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/202608060008_create_moderation_triage_v1.sql"),
  "utf8",
);
const service = readFileSync(join(root, "lib/moderation/service.ts"), "utf8");
const inbox = readFileSync(join(root, "app/owner/moderation/page.tsx"), "utf8");
const detail = readFileSync(
  join(root, "app/owner/moderation/[reportId]/page.tsx"),
  "utf8",
);
const actions = readFileSync(
  join(root, "app/owner/moderation/actions.ts"),
  "utf8",
);
const validationSrc = readFileSync(
  join(root, "lib/moderation/validation.ts"),
  "utf8",
);
const authz = readFileSync(join(root, "lib/staff/authorization.ts"), "utf8");
const sop = readFileSync(
  join(root, "docs/operations/moderation-triage.md"),
  "utf8",
);

const moderationStatusUpdateSchema = z.object({
  reportId: z.string().uuid(),
  newStatus: z.enum(["under_review", "resolved", "dismissed"]),
  internalNote: z.string().max(500).optional(),
});

test("migration adds triage columns, events table, and owner-only RPCs", () => {
  assert.match(migration, /moderation_status/);
  assert.match(migration, /moderation_report_events/);
  assert.match(migration, /list_moderation_reports/);
  assert.match(migration, /get_moderation_report/);
  assert.match(migration, /update_moderation_report_status/);
  assert.match(migration, /count_unresolved_moderation_reports/);
  assert.match(migration, /is_current_active_staff\(array\['owner'\]/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /actor_user_id uuid := auth\.uid\(\)/);
  assert.doesNotMatch(migration, /p_reviewer_user_id|p_actor_user_id/);
});

test("status transitions are constrained server-side", () => {
  assert.match(migration, /under_review/);
  assert.match(migration, /invalid moderation transition/);
  assert.match(migration, /resolved_at/);
  assert.match(migration, /reviewed_at/);
  assert.match(migration, /timezone\('utc', now\(\)\)/);
});

test("projections stay privacy-safe", () => {
  assert.match(migration, /left\(msg\.body, 280\)/);
  assert.doesNotMatch(
    migration,
    /contact_ciphertext|encryption_key|mutual_interest|identity_reveal_photo/,
  );
  assert.doesNotMatch(
    inbox,
    /decryptContact|ciphertext|dangerouslySetInnerHTML/,
  );
  assert.doesNotMatch(
    detail,
    /decryptContact|ciphertext|dangerouslySetInnerHTML/,
  );
  assert.match(detail, /Cuplikan pesan terkait|Contact/i);
});

test("owner pages use requireOwner; actions ignore client reviewer identity", () => {
  assert.match(inbox, /requireOwner/);
  assert.match(detail, /requireOwner/);
  assert.match(actions, /requireOwner/);
  assert.match(actions, /moderationStatusUpdateSchema/);
  assert.match(validationSrc, /moderationStatusUpdateSchema/);
  assert.doesNotMatch(actions, /reviewerUserId|reviewer_id/);
  assert.match(authz, /app_metadata/);
  assert.doesNotMatch(authz, /user_metadata/);
});

test("client cannot supply trusted reviewer; schema bounds note and status", () => {
  assert.equal(
    moderationStatusUpdateSchema.safeParse({
      reportId: "11111111-1111-4111-8111-111111111111",
      newStatus: "under_review",
      internalNote: "ok",
    }).success,
    true,
  );
  assert.equal(
    moderationStatusUpdateSchema.safeParse({
      reportId: "not-a-uuid",
      newStatus: "under_review",
    }).success,
    false,
  );
  assert.equal(
    moderationStatusUpdateSchema.safeParse({
      reportId: "11111111-1111-4111-8111-111111111111",
      newStatus: "submitted",
    }).success,
    false,
  );
  assert.equal(
    moderationStatusUpdateSchema.safeParse({
      reportId: "11111111-1111-4111-8111-111111111111",
      newStatus: "resolved",
      internalNote: "x".repeat(501),
    }).success,
    false,
  );
});

test("service uses RPCs only; grants revoke anon/public on new table", () => {
  assert.match(service, /list_moderation_reports/);
  assert.match(service, /get_moderation_report/);
  assert.match(service, /update_moderation_report_status/);
  assert.match(
    migration,
    /revoke all on table public\.moderation_report_events from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /revoke all on function public\.list_moderation_reports/,
  );
});

test("SOP documents privacy boundary and queue ownership", () => {
  assert.equal(
    existsSync(join(root, "docs/operations/moderation-triage.md")),
    true,
  );
  assert.match(sop, /submitted → under_review → resolved/);
  assert.match(sop, /Contact Reveal plaintext/);
  assert.match(sop, /\/owner\/moderation/);
});
