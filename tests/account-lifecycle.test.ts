import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/202608070010_student_account_lifecycle.sql"),
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

test("permanent delete purges storage and auth user", () => {
  assert.match(lifecycle, /student-verification-evidence|VERIFICATION_BUCKET/);
  assert.match(lifecycle, /IDENTITY_REVEAL_PHOTO_BUCKET/);
  assert.match(lifecycle, /auth\.admin\.deleteUser/);
  assert.match(lifecycle, /early_access_waitlist/);
  assert.match(lifecycle, /api_rate_limits/);
  assert.match(lifecycle, /HAPUS PERMANEN|PERMANENT_DELETE_CONFIRMATION/);
  assert.match(lifecycle, /getCurrentStaffAccess/);
});

test("profile danger zone exposes student-only account controls", () => {
  assert.match(danger, /Zona Berbahaya/);
  assert.match(danger, /Nonaktifkan akun/);
  assert.match(danger, /Hapus Akun Permanen/);
  assert.match(danger, /PERMANENT_DELETE_CONFIRMATION/);
});

test("privacy documents self-service deactivation and permanent delete", () => {
  assert.match(privacy, /penghapusan-akun/);
  assert.match(privacy, /hapus permanen/i);
  assert.match(privacy, /dinonaktifkan sementara/i);
  assert.doesNotMatch(
    privacy,
    /belum tersedia tombol penghapusan akun mandiri/i,
  );
});
