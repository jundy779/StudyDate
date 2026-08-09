import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/202608070010_student_account_lifecycle.sql"),
  "utf8",
);
const settingsMigration = readFileSync(
  join(
    root,
    "supabase/migrations/202608100001_account_privacy_controls_v1.sql",
  ),
  "utf8",
);
const lifecycle = readFileSync(join(root, "lib/account/lifecycle.ts"), "utf8");
const danger = readFileSync(
  join(root, "components/profile/account-danger-zone.tsx"),
  "utf8",
);
const privacy = readFileSync(
  join(root, "content/public-docs/privacy.ts"),
  "utf8",
);

test("account lifecycle migration supports soft deactivate and staff FK", () => {
  assert.match(migration, /deactivated_at/);
  assert.match(migration, /deactivate_my_student_account/);
  assert.match(migration, /reactivate_my_student_account/);
  assert.match(migration, /is_active_staff_user/);
  assert.match(migration, /on delete set null/);
  assert.match(migration, /staff_members_created_by_fkey/);
});

test("deletion request privacy-locks without destructive cleanup", () => {
  assert.match(lifecycle, /request_my_student_account_deletion/);
  assert.match(lifecycle, /ACCOUNT_DELETE_CONFIRMATION/);
  assert.match(lifecycle, /getCurrentStaffAccess/);
  assert.doesNotMatch(lifecycle, /auth\.admin\.deleteUser|storage\.from/);
  assert.match(settingsMigration, /account_deletion_requests/);
  assert.match(settingsMigration, /is_discoverable = false/);
});

test("profile danger zone exposes student-only account controls", () => {
  assert.match(danger, /Status akun/);
  assert.match(danger, /Nonaktifkan akun/);
  assert.match(danger, /Minta penghapusan akun/);
  assert.match(danger, /ACCOUNT_DELETE_CONFIRMATION/);
});

test("privacy documents self-service deactivation and reviewed deletion", () => {
  assert.match(privacy, /penghapusan-akun/);
  assert.match(privacy, /permintaan penghapusan/i);
  assert.match(privacy, /dinonaktifkan sementara/i);
  assert.doesNotMatch(
    privacy,
    /belum tersedia tombol penghapusan akun mandiri/i,
  );
});
