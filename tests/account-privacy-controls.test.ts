import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/202608100001_account_privacy_controls_v1.sql",
  ),
  "utf8",
);
const settingsPage = readFileSync(
  join(root, "app/app/settings/page.tsx"),
  "utf8",
);
const blockList = readFileSync(
  join(root, "components/settings/blocked-students-list.tsx"),
  "utf8",
);
const profileService = readFileSync(
  join(root, "lib/profile/service.ts"),
  "utf8",
);
const lifecycle = readFileSync(join(root, "lib/account/lifecycle.ts"), "utf8");
const guard = readFileSync(join(root, "lib/account/guard.ts"), "utf8");
const verification = readFileSync(
  join(root, "lib/verification/readiness.ts"),
  "utf8",
);

test("profile settings mutation is actor-scoped and excludes protected identity", () => {
  assert.match(migration, /update_my_student_profile_settings/);
  assert.match(migration, /actor uuid := auth\.uid\(\)/);
  assert.doesNotMatch(
    migration.match(
      /create or replace function public\.update_my_student_profile_settings[\s\S]*?revoke all on function public\.update_my_student_profile_settings/,
    )?.[0] ?? "",
    /p_user_id|first_name\s*=|last_name\s*=|verification_status\s*=|staff_members\s+set/,
  );
  assert.doesNotMatch(
    profileService,
    /first_name|last_name|user_id,|nim|cipher|verification evidence/i,
  );
  assert.match(migration, /campus_options/);
  assert.match(migration, /study_program_options/);
  assert.match(migration, /invalid semester/);
});

test("direct profile forgery is revoked and settings RPC grant is narrow", () => {
  assert.match(migration, /revoke update on table public\.profiles from authenticated/);
  assert.match(
    migration,
    /revoke all on function public\.update_my_student_profile_settings[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.update_my_student_profile_settings[\s\S]*to authenticated/,
  );
});

test("discoverability is a future-discovery filter, not relationship deletion", () => {
  assert.match(migration, /set_people_discovery_visibility/);
  assert.match(migration, /is_discoverable = p_is_discoverable/);
  assert.match(migration, /profile\.is_discoverable = true/);
  assert.doesNotMatch(
    migration.match(
      /create or replace function public\.set_people_discovery_visibility[\s\S]*?revoke all on function public\.set_people_discovery_visibility/,
    )?.[0] ?? "",
    /delete from public\.(introduction_requests|conversation_shells|conversation_identity_reveals|conversation_contact_reveals|study_circle_memberships|campus_event_rsvps)/,
  );
});

test("block projection is current-user-owned and privacy safe", () => {
  const listFunction =
    migration.match(
      /create or replace function public\.list_my_blocked_students[\s\S]*?create or replace function public\.unblock_my_blocked_student/,
    )?.[0] ?? "";
  assert.match(listFunction, /block\.blocker_id = actor/);
  assert.match(listFunction, /public_alias text/);
  assert.doesNotMatch(
    listFunction,
    /blocked_id uuid|blocker_id uuid|first_name|last_name|email|nim|cipher|contact|counterpart/,
  );
  assert.match(migration, /block\.blocker_id = actor[\s\S]*block\.blocked_id = target/);
  assert.match(blockList, /tidak otomatis memulihkan percakapan/);
  assert.match(blockList, /role="dialog"/);
  assert.match(blockList, /event\.key === "Escape"/);
});

test("pending deletion request is idempotent and immediately privacy-locks account", () => {
  assert.match(migration, /user_id uuid unique/);
  assert.match(migration, /on conflict \(user_id\) do nothing/);
  assert.match(migration, /is_discoverable = false/);
  assert.match(migration, /deactivated_at = coalesce/);
  assert.match(migration, /status in \('pending', 'processing', 'completed', 'failed'\)/);
  assert.match(guard, /deletionStatus === "pending"/);
  assert.match(guard, /account\/deletion-pending/);
});

test("shared eligibility gate blocks direct social RPC bypass after deletion request", () => {
  const eligibility =
    migration.match(
      /create or replace function public\.is_eligible_introduction_student[\s\S]*?\$\$;/,
    )?.[0] ?? "";
  assert.match(eligibility, /profile\.deactivated_at is null/);
  assert.match(eligibility, /staff\.status = 'active'/);
  assert.match(eligibility, /account_deletion_requests/);
  assert.match(eligibility, /status in \('pending', 'processing', 'failed'\)/);
});

test("deletion cleanup remains non-destructive pending Owner policy", () => {
  assert.match(migration, /Cleanup processing is intentionally not exposed/);
  assert.doesNotMatch(lifecycle, /auth\.admin\.deleteUser|storage\.from|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(
    migration,
    /delete from public\.(anonymous_messages|study_circle_messages|campus_events|conversation_identity_reveals|conversation_contact_reveals|user_reports)/,
  );
  assert.match(
    migration,
    /revoke all on table public\.account_deletion_requests[\s\S]*authenticated/,
  );
});

test("settings projection and copy contain no forbidden privacy fields", () => {
  assert.match(settingsPage, /Pengaturan/);
  assert.match(settingsPage, /Privat secara default/);
  assert.match(settingsPage, /Alias anonim dibuat untuk menjaga/);
  assert.doesNotMatch(
    settingsPage,
    /service_role|auth token|cookie|magic link|nim_ciphertext|contact_ciphertext|photo_object_key|one-sided consent|UUID/,
  );
  assert.match(settingsPage, /maskEmail/);
});

test("Student Verification remains globally disabled by default", () => {
  assert.match(
    verification,
    /process\.env\.STUDENT_VERIFICATION_ENABLED === "true"/,
  );
  assert.doesNotMatch(
    migration.match(
      /create or replace function public\.request_my_student_account_deletion[\s\S]*?revoke all on function public\.get_my_account_deletion_status/,
    )?.[0] ?? "",
    /STUDENT_VERIFICATION_ENABLED|verification_status = 'verified'/,
  );
});
