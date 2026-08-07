/**
 * P1-02 moderation boundary tests (pre-migration).
 * Full triage RPCs require a separate migration — see
 * docs/operations/moderation-triage-migration-preflight.md
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

const introMigration = readFileSync(
  join(root, "supabase/migrations/202608060001_create_introduction_requests_v1.sql"),
  "utf8",
);
const chatMigration = readFileSync(
  join(root, "supabase/migrations/202608060003_create_anonymous_chat_v1.sql"),
  "utf8",
);
const ownerModerationPage = readFileSync(
  join(root, "app/owner/moderation/page.tsx"),
  "utf8",
);
const authz = readFileSync(join(root, "lib/staff/authorization.ts"), "utf8");
const preflight = readFileSync(
  join(root, "docs/operations/moderation-triage-migration-preflight.md"),
  "utf8",
);
const sop = readFileSync(
  join(root, "docs/operations/moderation-triage.md"),
  "utf8",
);

test("user_reports remains RPC-insert only without moderation status columns", () => {
  assert.match(introMigration, /create table public\.user_reports/);
  assert.match(introMigration, /revoke all on table public\.user_reports/);
  assert.doesNotMatch(
    introMigration,
    /moderation_status|internal_note|reviewer_user_id|reviewed_at|resolved_at/,
  );
  const userReportsAlter = chatMigration.match(
    /alter table public\.user_reports[\s\S]*?;/,
  );
  assert.ok(userReportsAlter);
  assert.doesNotMatch(
    userReportsAlter[0],
    /moderation_status|internal_note|reviewer_user_id/,
  );
});

test("report submission RPCs bind auth.uid and do not accept reviewer identity", () => {
  assert.match(introMigration, /report_introduction_request\(/);
  assert.match(chatMigration, /report_conversation\(/);
  assert.match(introMigration, /reporter_id[\s\S]*auth\.uid|current_user_id uuid := auth\.uid/);
  assert.doesNotMatch(introMigration, /p_reviewer|p_moderation_status|p_reporter_id/);
  assert.doesNotMatch(chatMigration, /p_reviewer|p_moderation_status|p_reporter_id/);
});

test("owner moderation route is server-gated and does not expose reveal/chat dumps", () => {
  assert.match(ownerModerationPage, /requireOwner/);
  assert.doesNotMatch(
    ownerModerationPage,
    /decryptContact|ciphertext|dangerouslySetInnerHTML|get_completed_contact/,
  );
  assert.doesNotMatch(
    ownerModerationPage,
    /anonymous_messages|one-sided|selected_by_me/,
  );
  assert.match(ownerModerationPage, /migrasi/i);
});

test("staff authorization ignores user_metadata for privilege", () => {
  assert.match(authz, /app_metadata/);
  assert.doesNotMatch(authz, /user_metadata/);
  assert.match(authz, /get_current_staff_membership/);
});

test("moderation SOP and migration preflight docs exist and forbid broad surveillance", () => {
  assert.equal(existsSync(join(root, "docs/operations/moderation-triage.md")), true);
  assert.equal(
    existsSync(
      join(root, "docs/operations/moderation-triage-migration-preflight.md"),
    ),
    true,
  );
  assert.match(preflight, /REQUIRED BEFORE P1-02/);
  assert.match(preflight, /Do not apply in this task/i);
  assert.match(sop, /must \*\*not\*\* automatically gain/i);
  assert.match(sop, /Contact Reveal plaintext/);
});

test("no moderation triage migration file was added in this closure", () => {
  assert.equal(
    existsSync(
      join(
        root,
        "supabase/migrations/202608060008_create_moderation_triage_v1.sql",
      ),
    ),
    false,
  );
});
