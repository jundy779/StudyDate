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
const lifecycleMigration = readFileSync(
  join(
    root,
    "supabase/migrations/202608100002_finalize_account_deletion_lifecycle.sql",
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
const worker = readFileSync(
  join(root, "scripts/process-account-deletions.mjs"),
  "utf8",
);
const pendingPage = readFileSync(
  join(root, "app/account/deletion-pending/page.tsx"),
  "utf8",
);
const browserAudit = readFileSync(
  join(root, "scripts/account-privacy-responsive-audit.mjs"),
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

test("deletion worker is service-only, leased, bounded, and retryable", () => {
  assert.doesNotMatch(lifecycle, /auth\.admin\.deleteUser|storage\.from|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(
    migration,
    /revoke all on table public\.account_deletion_requests[\s\S]*authenticated/,
  );
  assert.match(lifecycleMigration, /for update skip locked/);
  assert.match(lifecycleMigration, /interval '15 minutes'/);
  assert.match(lifecycleMigration, /retry_count = retry_count \+ 1/);
  assert.match(lifecycleMigration, /auth\.role\(\) <> 'service_role'/);
  assert.match(
    lifecycleMigration,
    /revoke all on function public\.cleanup_account_deletion_database[\s\S]*authenticated/,
  );
  assert.match(worker, /--limit must be an integer between 1 and 25/);
  assert.match(worker, /auth\.admin\.deleteUser/);
  assert.match(
    worker,
    /removeOwnedStorage\(job\)[\s\S]*cleanupDatabase\(job\)[\s\S]*deleteAuthUser\(job\)[\s\S]*completeJob\(job\)/,
  );
  assert.doesNotMatch(worker, /console\.(log|error)\([^)]*error/);
});

test("request is self-only, irreversible in Student UI, and failed state remains locked", () => {
  const requestFunction =
    lifecycleMigration.match(
      /create or replace function public\.request_my_student_account_deletion[\s\S]*?revoke all on function public\.request_my_student_account_deletion/,
    )?.[0] ?? "";
  assert.match(requestFunction, /actor uuid := auth\.uid\(\)/);
  assert.doesNotMatch(requestFunction, /p_user_id|cancel|reactivate/);
  assert.doesNotMatch(lifecycleMigration, /cancel_my_student_account_deletion/);
  assert.match(migration, /status in \('pending', 'processing', 'failed'\)/);
  assert.match(pendingPage, /Penghapusan akun masih diproses/);
  assert.doesNotMatch(pendingPage, /retry_count|failure_code|lease|Storage|database/);
});

test("Identity and Contact projections stop serving a deleting counterpart", () => {
  const identityProjection =
    lifecycleMigration.match(
      /create or replace function public\.get_completed_identity_reveal[\s\S]*?create or replace function public\.resolve_identity_reveal_photo_key/,
    )?.[0] ?? "";
  const identityMedia =
    lifecycleMigration.match(
      /create or replace function public\.resolve_identity_reveal_photo_key[\s\S]*?create or replace function public\.get_completed_contact_reveal_cipher/,
    )?.[0] ?? "";
  const contactProjection =
    lifecycleMigration.match(
      /create or replace function public\.get_completed_contact_reveal_cipher[\s\S]*?revoke all on function public\.get_completed_identity_reveal/,
    )?.[0] ?? "";
  assert.match(identityProjection, /is_account_deletion_locked\(counterpart_id\)/);
  assert.match(
    identityProjection,
    /is_account_deletion_locked\(counterpart_id\)[\s\S]*select\s+false,\s+null::timestamptz,\s+null::text,\s+null::text/,
  );
  assert.match(identityMedia, /is_account_deletion_locked\(owner_id\)/);
  assert.match(contactProjection, /is_account_deletion_locked\(counterpart_id\)/);
  assert.match(
    contactProjection,
    /is_account_deletion_locked\(counterpart_id\)[\s\S]*select false,\s+null::timestamptz/,
  );
  assert.match(contactProjection, /mine\.contact_ciphertext/);
  assert.match(contactProjection, /case when hide_counterpart then null else counterpart\.contact_ciphertext end/);
  assert.match(lifecycleMigration, /where participant_id = target_user_id/);
  assert.match(lifecycleMigration, /where owner_user_id = target_user_id/);
});

test("Storage cleanup is scoped to server-derived object references", () => {
  const inventory =
    lifecycleMigration.match(
      /create or replace function public\.list_account_deletion_storage_objects[\s\S]*?create or replace function public\.cleanup_account_deletion_database/,
    )?.[0] ?? "";
  assert.match(inventory, /identity-reveal-photos/);
  assert.match(inventory, /student-verification-evidence/);
  assert.match(inventory, /where version\.owner_user_id = target_user_id/);
  assert.match(inventory, /where request\.user_id = target_user_id/);
  assert.doesNotMatch(worker, /process\.argv.*object|p_object|p_bucket|prefix/);
  assert.match(worker, /objects\.slice\(index, index \+ 100\)/);
});

test("shared history uses tombstones without rewriting message bodies", () => {
  assert.match(lifecycleMigration, /'Akun dihapus'/);
  assert.match(lifecycleMigration, /anonymous_messages[\s\S]*on delete set null/);
  assert.match(lifecycleMigration, /study_circle_messages[\s\S]*on delete set null/);
  assert.match(lifecycleMigration, /campus_events[\s\S]*on delete set null/);
  assert.match(lifecycleMigration, /message\.body/);
  assert.doesNotMatch(lifecycleMigration, /update public\.(anonymous_messages|study_circle_messages)[\s\S]*body\s*=/);
  assert.match(lifecycleMigration, /then 'Akun dihapus' else profile\.public_alias/);
});

test("owned resources are finalized idempotently without transfer", () => {
  const cleanup =
    lifecycleMigration.match(
      /create or replace function public\.cleanup_account_deletion_database[\s\S]*?create or replace function public\.complete_account_deletion_job/,
    )?.[0] ?? "";
  assert.match(cleanup, /update public\.study_circles[\s\S]*status = 'archived'/);
  assert.match(cleanup, /where owner_user_id = target_user_id/);
  assert.match(cleanup, /update public\.campus_events[\s\S]*status = 'cancelled'/);
  assert.match(cleanup, /status = 'scheduled'[\s\S]*starts_at > timezone/);
  assert.doesNotMatch(cleanup, /set[\s\S]{0,120}(owner_user_id|organizer_user_id)\s*=/);
  assert.doesNotMatch(
    cleanup,
    /delete from public\.(study_circles|study_circle_messages|campus_events|anonymous_messages)\b/,
  );
  assert.match(
    cleanup,
    /delete from public\.campus_event_rsvps[\s\S]*where user_id = target_user_id/,
  );
});

test("verification private data is purged without decryption or client projection", () => {
  const cleanup =
    lifecycleMigration.match(
      /create or replace function public\.cleanup_account_deletion_database[\s\S]*?create or replace function public\.complete_account_deletion_job/,
    )?.[0] ?? "";
  assert.match(cleanup, /delete from public\.student_verification_requests/);
  assert.match(cleanup, /delete from public\.onboarding_academic_claims/);
  assert.match(cleanup, /delete from public\.profiles/);
  assert.match(cleanup, /delete from public\.privacy_preferences/);
  assert.match(cleanup, /delete from public\.user_consents/);
  assert.doesNotMatch(cleanup, /decrypt|nim_ciphertext|legal_name_ciphertext/);
  assert.doesNotMatch(worker, /nim|legal_name|ciphertext|auth_tag/);
});

test("moderation and security retention is centralized and bounded", () => {
  assert.match(lifecycleMigration, /create table public\.account_privacy_policy/);
  assert.match(lifecycleMigration, /moderation_retention_days smallint not null default 180/);
  assert.match(lifecycleMigration, /security_audit_retention_days smallint not null default 180/);
  assert.match(lifecycleMigration, /moderation_status in \('resolved', 'dismissed'\)/);
  assert.match(lifecycleMigration, /resolved_at[\s\S]*make_interval\(days => policy\.moderation_retention_days\)/);
  assert.match(
    lifecycleMigration,
    /introduction_events[\s\S]*account_deletion_request_id/,
  );
  assert.match(
    lifecycleMigration,
    /conversation_events[\s\S]*account_deletion_request_id/,
  );
  assert.match(
    lifecycleMigration,
    /study_circle_events[\s\S]*account_deletion_request_id/,
  );
  assert.match(
    lifecycleMigration,
    /campus_event_audit_events[\s\S]*account_deletion_request_id/,
  );
  assert.doesNotMatch(
    lifecycleMigration.match(
      /create or replace function public\.cleanup_account_deletion_database[\s\S]*?create or replace function public\.complete_account_deletion_job/,
    )?.[0] ?? "",
    /delete from public\.user_reports/,
  );
});

test("Auth finalization is last and completion requires Auth FK cleanup", () => {
  const completion =
    lifecycleMigration.match(
      /create or replace function public\.complete_account_deletion_job[\s\S]*?create or replace function public\.fail_account_deletion_job/,
    )?.[0] ?? "";
  assert.match(completion, /database_cleanup_at is not null/);
  assert.match(completion, /user_id is null/);
  assert.match(completion, /status = 'completed'/);
  assert.match(
    worker,
    /removeOwnedStorage\(job\)[\s\S]*cleanupDatabase\(job\)[\s\S]*deleteAuthUser\(job\)[\s\S]*completeJob\(job\)/,
  );
  assert.match(worker, /getUserById/);
  assert.match(worker, /not found/i);
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

test("responsive audit requires authenticated settings and opens the deletion dialog", () => {
  assert.match(
    browserAudit,
    /ACCOUNT_PRIVACY_AUDIT_STORAGE_STATE is required/,
  );
  assert.match(browserAudit, /settings heading/);
  assert.match(browserAudit, /Minta penghapusan akun/);
  assert.match(browserAudit, /closedWithEscape/);
  assert.match(browserAudit, /focusRestored/);
  assert.doesNotMatch(
    browserAudit,
    /unauthenticated settings must redirect to login/,
  );
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
