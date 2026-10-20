import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { staffActionSchema, staffEmailAssignSchema } from "../lib/staff/validation.ts";
import { getSafeAuthenticatedDestination } from "../lib/auth/redirect.ts";

const migration = readFileSync(new URL("../supabase/migrations/202607310005_create_staff_roles_and_admin_shell.sql", import.meta.url), "utf8");
const authorization = readFileSync(new URL("../lib/staff/authorization.ts", import.meta.url), "utf8");
const callback = readFileSync(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");
const studentLogin = readFileSync(new URL("../app/api/auth/magic-link/route.ts", import.meta.url), "utf8");
const staffLogin = readFileSync(new URL("../app/api/auth/staff-magic-link/route.ts", import.meta.url), "utf8");
const ownerPage = readFileSync(new URL("../app/owner/page.tsx", import.meta.url), "utf8");
const staffPage = readFileSync(new URL("../app/owner/staff/page.tsx", import.meta.url), "utf8");
const adminPage = readFileSync(new URL("../app/admin/verifications/page.tsx", import.meta.url), "utf8");
const reviewService = readFileSync(new URL("../lib/verification/review.ts", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("../scripts/bootstrap-owner.mjs", import.meta.url), "utf8");

test("new normal users remain students without an active trusted membership", () => {
  assert.match(authorization, /if \(error \|\| !membership/);
  assert.match(authorization, /return null/);
  assert.doesNotMatch(authorization, /user_metadata\?\.role/);
});

test("owner and admin pages use independent server guards", () => {
  assert.match(ownerPage, /requireOwner\(\)/);
  assert.match(staffPage, /requireOwner\(\)/);
  assert.match(adminPage, /requireVerificationReviewer\(\)/);
  assert.match(authorization, /access\.role !== "owner"/);
});

test("trusted authorization requires matching app metadata and active database membership", () => {
  assert.match(migration, /staff\.status = 'active'/);
  assert.match(migration, /auth\.jwt\(\) -> 'app_metadata' ->> 'role'/);
  assert.match(migration, /verification_reviewer[\s\S]*staff\.verification_reviewer/);
  assert.match(authorization, /claimRole !== membership\.role/);
  assert.match(authorization, /claimReviewer !== membership\.verification_reviewer/);
});

test("user_metadata cannot grant staff or reviewer access", () => {
  assert.doesNotMatch(migration, /user_metadata/);
  assert.doesNotMatch(authorization, /user_metadata/);
  assert.match(reviewService, /user_metadata\?\.verification_reviewer === true/);
});

test("client input cannot choose a role or owner action", () => {
  assert.equal(staffActionSchema.safeParse({ targetUserId: "b1111111-1111-4111-8111-111111111111", action: "grant_admin", role: "owner" }).success, false);
  assert.equal(staffActionSchema.safeParse({ targetUserId: "b1111111-1111-4111-8111-111111111111", action: "grant_admin" }).success, false);
  assert.equal(staffActionSchema.safeParse({ targetUserId: "b1111111-1111-4111-8111-111111111111", action: "create_owner" }).success, false);
  assert.doesNotMatch(staffPage, /Tambahkan admin via UUID|UUID akun Auth/);
  assert.doesNotMatch(migration, /manage_staff_member\([\s\S]*p_role/);
});

test("admin cannot promote itself, create an owner, or manage staff", () => {
  assert.match(migration, /is_current_active_staff\(array\['owner'\]/);
  assert.match(migration, /p_target_user_id = actor_user_id/);
  assert.doesNotMatch(migration, /'grant_owner'|'create_owner'/);
});

test("staff changes are atomic, constrained, and audited", () => {
  for (const event of ["owner_bootstrapped", "admin_granted", "admin_deactivated", "admin_reactivated", "reviewer_granted", "reviewer_removed"]) assert.match(migration, new RegExp(event));
  assert.match(migration, /update auth\.users[\s\S]*raw_app_meta_data/);
  assert.match(migration, /insert into public\.staff_role_events/);
  assert.match(migration, /staff_members_single_owner_idx/);
});

test("ops migration makes grant_admin least-privilege without auto reviewer", () => {
  const ops = readFileSync(
    new URL(
      "../supabase/migrations/202608170002_staff_operations_capabilities.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(ops, /can_early_access_read/);
  assert.match(ops, /verification_reviewer', staff\.verification_reviewer/);
  assert.match(ops, /values \(\s*p_target_user_id, 'admin', 'active', false,/);
  assert.equal(
    staffEmailAssignSchema.safeParse({
      email: "ops@example.com",
      action: "grant_admin",
    }).success,
    true,
  );
});

test("owner bootstrap is service-only, UUID-based, idempotent, and interactive", () => {
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.match(migration, /grant execute on function public\.bootstrap_initial_owner\(uuid\)\s+to service_role/);
  assert.match(migration, /on conflict do nothing/);
  assert.match(bootstrap, /matches\.length !== 1/);
  assert.match(bootstrap, /maskedEmail/);
  assert.match(bootstrap, /user\.id\.slice\(-8\)/);
  assert.match(bootstrap, /BOOTSTRAP OWNER/);
  assert.doesNotMatch(bootstrap, /studydateid@gmail\.com/i);
});

test("student and staff login flows remain separate and enumeration-safe", () => {
  assert.match(studentLogin, /allowCreateUser: true/);
  assert.match(staffLogin, /allowCreateUser: false/);
  assert.match(staffLogin, /GENERIC_RESPONSE/);
  assert.doesNotMatch(studentLogin, /signInWithOtp/);
  assert.doesNotMatch(staffLogin, /signInWithOtp/);
  assert.match(studentLogin, /deliverStudyDateMagicLink/);
  assert.match(staffLogin, /deliverStudyDateMagicLink/);
  assert.match(callback, /requestedDestination === "\/staff"/);
  assert.equal(getSafeAuthenticatedDestination("/staff"), "/staff");
  assert.equal(getSafeAuthenticatedDestination("https://evil.example"), "/app");
});

test("non-staff destination fails safely after authentication", () => {
  assert.match(authorization, /return "\/app"/);
  assert.doesNotMatch(staffLogin, /staff_members|verification_reviewer/);
});

test("verification reviewer requires both trusted sources and protected RPC", () => {
  assert.match(reviewService, /\.from\("staff_members"\)/);
  assert.match(reviewService, /membership\.status !== "active"/);
  assert.match(migration, /finalize_staff_verification_review/);
  assert.match(migration, /self review is not allowed/);
  assert.match(migration, /combined verification required/);
  assert.match(migration, /grant execute on function public\.finalize_staff_verification_review[\s\S]*to authenticated/);
});

test("active staff cannot appear in People or enable discoverability", () => {
  const exclusions = migration.match(/not exists \([\s\S]*?public\.staff_members staff[\s\S]*?staff\.status = 'active'[\s\S]*?\)/g);
  assert.ok((exclusions?.length ?? 0) >= 2);
  assert.match(migration, /staff profiles are not discoverable/);
});

test("staff tables have RLS, no direct grants, and sanitized audit output", () => {
  for (const table of ["staff_members", "staff_role_events"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
  }
  assert.match(migration, /right\(event\.target_user_id::text, 8\)/);
  const eventTable = migration.match(
    /create table public\.staff_role_events \(([\s\S]*?)\r?\n\);/,
  );
  assert.ok(eventTable);
  assert.doesNotMatch(eventTable[1], /email|payload|token|path/);
});
