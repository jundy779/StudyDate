import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  staffHasCapability,
  type StaffCapabilityFlags,
} from "../lib/staff/capabilities.ts";
import {
  staffActionSchema,
  staffEmailAssignSchema,
} from "../lib/staff/validation.ts";

const opsMigration = readFileSync(
  new URL(
    "../supabase/migrations/202608170002_staff_operations_capabilities.sql",
    import.meta.url,
  ),
  "utf8",
);
const earlyAccessModerationMigration = readFileSync(
  new URL(
    "../supabase/migrations/202608250002_early_access_moderation_invitation_v1.sql",
    import.meta.url,
  ),
  "utf8",
);
const claimMigration = readFileSync(
  new URL(
    "../supabase/migrations/202608170001_early_access_account_claim.sql",
    import.meta.url,
  ),
  "utf8",
);
const authorization = readFileSync(
  new URL("../lib/staff/authorization.ts", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("../lib/staff/service.ts", import.meta.url),
  "utf8",
);
const earlyAccessPage = readFileSync(
  new URL("../app/staff/early-access/page.tsx", import.meta.url),
  "utf8",
);
const earlyAccessQueue = readFileSync(
  new URL("../components/staff/early-access-queue.tsx", import.meta.url),
  "utf8",
);
const earlyAccessActions = readFileSync(
  new URL("../app/staff/early-access/actions.ts", import.meta.url),
  "utf8",
);
const ownerEarlyAccessPage = readFileSync(
  new URL("../app/owner/early-access/page.tsx", import.meta.url),
  "utf8",
);
const usersPage = readFileSync(
  new URL("../app/staff/users/page.tsx", import.meta.url),
  "utf8",
);
const ownerStaffPage = readFileSync(
  new URL("../app/owner/staff/page.tsx", import.meta.url),
  "utf8",
);
const ownerStaffActions = readFileSync(
  new URL("../app/owner/staff/actions.ts", import.meta.url),
  "utf8",
);
const proxy = readFileSync(
  new URL("../lib/supabase/proxy.ts", import.meta.url),
  "utf8",
);
const navigation = readFileSync(
  new URL("../components/navigation/responsive-navigation.tsx", import.meta.url),
  "utf8",
);
const hardeningMigration = readFileSync(
  new URL(
    "../supabase/migrations/202608210011_launch_ops_and_reveal_media_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
const userDetailPage = readFileSync(
  new URL("../app/staff/users/[accountRef]/page.tsx", import.meta.url),
  "utf8",
);
const adminOverview = readFileSync(
  new URL("../app/admin/page.tsx", import.meta.url),
  "utf8",
);

function access(
  partial: Partial<StaffCapabilityFlags> & Pick<StaffCapabilityFlags, "role">,
): StaffCapabilityFlags {
  return {
    verificationReviewer: false,
    canEarlyAccessRead: false,
    canEarlyAccessReview: false,
    canUsersRead: false,
    canUsersSupport: false,
    ...partial,
  };
}

test("ops migration adds capability columns and least-privilege grant_admin", () => {
  assert.match(opsMigration, /can_early_access_read boolean not null default false/);
  assert.match(opsMigration, /can_users_read boolean not null default false/);
  assert.match(opsMigration, /can_users_support boolean not null default false/);
  assert.match(opsMigration, /verification_reviewer = false/);
  assert.match(opsMigration, /'grant_early_access'/);
  assert.match(opsMigration, /staff_has_ops_capability/);
  assert.match(opsMigration, /list_early_access_waitlist_ops/);
  assert.match(opsMigration, /list_student_account_ops/);
});

test("Early Access ops requires capability and hides claim UUID", () => {
  assert.match(opsMigration, /staff_has_ops_capability\('early_access\.read'\)/);
  assert.match(opsMigration, /Sudah diaktifkan/);
  assert.doesNotMatch(
    opsMigration,
    /returns table \([\s\S]*claimed_user_id/,
  );
  assert.match(earlyAccessPage, /requireStaffCapability\("early_access\.read"\)/);
  assert.doesNotMatch(earlyAccessPage, /claimed_user_id/);
});

test("User ops projection excludes NIM legal name evidence and chat", () => {
  assert.match(opsMigration, /staff_has_ops_capability\('users\.read'\)/);
  assert.match(opsMigration, /users support authorization required/);
  assert.match(opsMigration, /Belum diverifikasi/);
  assert.match(opsMigration, /Terverifikasi/);
  assert.doesNotMatch(opsMigration, /nim|legal_name|telegram|ciphertext/i);
  assert.match(usersPage, /requireStaffCapability\("users\.read"\)/);
  assert.match(usersPage, /users\.support/);
  assert.match(usersPage, />\s*Akun mahasiswa\s*</);
  assert.match(usersPage, /NIM, kontak, percakapan, foto/);
  assert.match(usersPage, /tidak tersedia di sini/);
  assert.match(usersPage, /Area Admin/);
  assert.doesNotMatch(usersPage, /Operasional staff|onboarding|membership|Tampil di People/);
  assert.doesNotMatch(opsMigration, /\bnim\b|legal_name|telegram_id|ciphertext/i);
});

test("Owner has all capabilities; admin defaults deny; support implies read", () => {
  const owner = access({ role: "owner" });
  assert.equal(staffHasCapability(owner, "early_access.read"), true);
  assert.equal(staffHasCapability(owner, "early_access.review"), true);
  assert.equal(staffHasCapability(owner, "users.read"), true);
  assert.equal(staffHasCapability(owner, "users.support"), true);
  assert.equal(staffHasCapability(owner, "staff.manage"), true);
  assert.equal(staffHasCapability(owner, "moderation.review"), true);

  const bareAdmin = access({ role: "admin" });
  assert.equal(staffHasCapability(bareAdmin, "early_access.read"), false);
  assert.equal(staffHasCapability(bareAdmin, "early_access.review"), false);
  assert.equal(staffHasCapability(bareAdmin, "users.read"), false);
  assert.equal(staffHasCapability(bareAdmin, "verification.review"), false);
  assert.equal(staffHasCapability(bareAdmin, "moderation.review"), false);
  assert.equal(staffHasCapability(bareAdmin, "staff.manage"), false);

  const support = access({ role: "admin", canUsersSupport: true });
  assert.equal(staffHasCapability(support, "users.read"), true);
  assert.equal(staffHasCapability(support, "users.support"), true);

  const earlyAccessReviewer = access({
    role: "admin",
    canEarlyAccessReview: true,
  });
  assert.equal(staffHasCapability(earlyAccessReviewer, "early_access.review"), true);
  assert.equal(staffHasCapability(earlyAccessReviewer, "early_access.read"), true);

  const reviewerOnly = access({
    role: "admin",
    verificationReviewer: true,
  });
  assert.equal(staffHasCapability(reviewerOnly, "verification.review"), true);
  assert.equal(staffHasCapability(reviewerOnly, "early_access.read"), false);
  assert.equal(staffHasCapability(reviewerOnly, "users.read"), false);
});

test("staff email assignment resolves server-side and rejects arbitrary capability strings", () => {
  assert.match(ownerStaffActions, /assignStaffMemberByEmail/);
  assert.match(ownerStaffPage, /Email akun StudyDate/);
  assert.doesNotMatch(ownerStaffPage, /Tambahkan admin via UUID|UUID akun Auth|Fallback UUID/);
  assert.doesNotMatch(ownerStaffPage, /placeholder="UUID akun yang sudah ada"/);
  assert.match(service, /auth\.admin\.listUsers/);
  assert.match(service, /Never returns UUID/);
  assert.equal(
    staffActionSchema.safeParse({
      targetUserId: "b1111111-1111-4111-8111-111111111111",
      action: "grant_admin",
    }).success,
    false,
  );
  assert.equal(
    staffEmailAssignSchema.safeParse({
      email: "  Staff@Example.com ",
      action: "grant_admin",
    }).success,
    true,
  );
  assert.equal(
    staffEmailAssignSchema.parse({
      email: "  Staff@Example.com ",
      action: "grant_admin",
    }).email,
    "staff@example.com",
  );
  assert.equal(
    staffEmailAssignSchema.safeParse({
      email: "staff@example.com",
      action: "grant_early_access_review",
    }).success,
    true,
  );
  assert.equal(
    staffEmailAssignSchema.safeParse({
      email: "staff@example.com",
      action: "grant_owner",
    }).success,
    false,
  );
  assert.equal(
    staffActionSchema.safeParse({
      targetUserId: "b1111111-1111-4111-8111-111111111111",
      action: "grant_early_access",
      capability: "users.read",
    }).success,
    false,
  );
});

test("invite fallback does not fabricate magic links or passwords", () => {
  assert.match(ownerStaffPage, /Belum ada akun StudyDate dengan email ini/);
  assert.doesNotMatch(service, /inviteUserByEmail|generateLink|signInWithOtp/);
  assert.doesNotMatch(ownerStaffActions, /inviteUserByEmail|password/);
});

test("proxy protects staff ops routes without protecting staff login", () => {
  assert.match(proxy, /\/staff\/early-access/);
  assert.match(proxy, /\/staff\/users/);
  assert.doesNotMatch(
    proxy,
    /pathname === "\/staff" \|\|[\s\S]*pathname\.startsWith\("\/staff\/"\)/,
  );
});

test("navigation exposes ops links for authorized staff", () => {
  assert.match(navigation, /\/staff\/early-access/);
  assert.match(navigation, /\/staff\/users/);
  assert.match(navigation, /canEarlyAccessRead/);
  assert.match(navigation, /canEarlyAccessReview/);
  assert.match(navigation, /\/owner\/early-access/);
  assert.match(authorization, /requireStaffCapability/);
  assert.match(authorization, /getPostAuthenticationDestination/);
});

test("ops RPCs revoke public/anon execute and keep waitlist table closed", () => {
  assert.match(
    opsMigration,
    /revoke all on function public\.list_early_access_waitlist_ops[\s\S]*from public, anon/,
  );
  assert.match(
    opsMigration,
    /revoke all on function public\.list_student_account_ops[\s\S]*from public, anon/,
  );
  assert.match(
    opsMigration,
    /revoke all on table public\.staff_ops_audit_events from anon, authenticated/,
  );
});

test("claim migration remains a dependency for activation labels", () => {
  assert.match(claimMigration, /claimed_user_id/);
  assert.match(claimMigration, /claimed_at/);
  assert.match(opsMigration, /filtered\.claimed_at/);
});

test("audit events are sanitized and capability changes are recorded", () => {
  assert.match(opsMigration, /early_access_viewed/);
  assert.match(opsMigration, /user_support_viewed/);
  assert.match(opsMigration, /staff_capability_changed/);
  assert.match(opsMigration, /subject_suffix/);
  assert.match(
    opsMigration,
    /insert into public\.staff_ops_audit_events \(\s*actor_user_id, event_type, subject_suffix\s*\)/,
  );
  assert.match(
    opsMigration,
    /insert into public\.staff_ops_audit_events \(actor_user_id, event_type\)/,
  );
});

test("Early Access moderation is one queue with owner-full and explicit staff review capability", () => {
  assert.match(earlyAccessModerationMigration, /can_early_access_review boolean not null default false/);
  assert.match(earlyAccessModerationMigration, /p_capability = 'early_access\.review'/);
  assert.match(earlyAccessModerationMigration, /membership\.role = 'owner'/);
  assert.match(earlyAccessModerationMigration, /manage_early_access_review_capability/);
  assert.match(ownerEarlyAccessPage, /requireOwner\(\)/);
  assert.match(ownerEarlyAccessPage, /basePath="\/owner\/early-access"/);
  assert.match(earlyAccessPage, /requireStaffCapability\("early_access\.read"\)/);
  assert.match(earlyAccessQueue, /staffHasCapability\(access, "early_access\.review"\)/);
  assert.match(earlyAccessQueue, /Mode baca saja/);
});

test("Early Access decisions approve or reject and invitation is server-side", () => {
  assert.match(earlyAccessModerationMigration, /status in \('waiting', 'approved', 'rejected', 'claimed'\)/);
  assert.match(earlyAccessModerationMigration, /review_early_access_entry/);
  assert.match(earlyAccessModerationMigration, /p_decision not in \('approve', 'reject'\)/);
  assert.match(earlyAccessModerationMigration, /prepare_early_access_invitation/);
  assert.match(earlyAccessModerationMigration, /mark_early_access_invitation_sent/);
  assert.match(earlyAccessModerationMigration, /waitlist_row\.status <> 'approved'/);
  assert.match(earlyAccessActions, /requireStaffCapability\("early_access\.review"\)/);
  assert.match(earlyAccessActions, /kind: "early-access"/);
  assert.match(earlyAccessActions, /nextPath: "\/onboarding"/);
  assert.match(earlyAccessQueue, /Setujui dan kirim email/);
  assert.match(earlyAccessQueue, /Kirim ulang undangan/);
  assert.match(earlyAccessQueue, /Tolak/);
  assert.doesNotMatch(earlyAccessActions, /studydateid@gmail\.com|admin@studydate\.id/i);
});

test("launch ops projection masks browse email and includes pre-onboarding accounts", () => {
  assert.match(hardeningMigration, /from auth\.users auth_user/);
  assert.match(
    hardeningMigration,
    /left join public\.profiles profile on profile\.user_id = auth_user\.id/,
  );
  assert.match(hardeningMigration, /public\.mask_account_email\(base\.auth_email\)/);
  assert.doesNotMatch(
    hardeningMigration,
    /when allow_full_email then base\.auth_email/,
  );
  assert.match(hardeningMigration, /coalesce\(base\.public_alias, 'Belum onboarding'\)/);
  assert.match(hardeningMigration, /public\.effective_membership_plan\(base\.user_id\)/);
});

test("student support detail is opaque, audited, and privacy-scoped", () => {
  assert.match(hardeningMigration, /student_account_ops_ref/);
  assert.match(hardeningMigration, /get_student_account_ops_detail/);
  assert.match(hardeningMigration, /student_account_viewed/);
  assert.match(hardeningMigration, /short_intro text/);
  assert.match(hardeningMigration, /membership_plan text/);
  assert.doesNotMatch(
    userDetailPage,
    /account\.(nim|legalName|telegram|instagram|linkedin|photo_object_key|user_id)/i,
  );
  assert.match(userDetailPage, /NIM, email lengkap, kontak, percakapan, foto identitas/);
  assert.match(userDetailPage, /Penyiapan akun|Paket akun|Tampil di pencarian teman/);
  assert.doesNotMatch(userDetailPage, />Onboarding<|>Membership<|Tampil di People|Volunteering|Networking/);
});

test("admin has a capability-aware operational landing page", () => {
  assert.match(adminOverview, /requireActiveStaff/);
  assert.match(adminOverview, /Ruang operasional Admin/);
  assert.match(adminOverview, /access\.canUsersRead/);
  assert.match(adminOverview, /access\.verificationReviewer/);
  assert.match(authorization, /if \(access\?\.role === "admin"\) return "\/admin"/);
  assert.match(navigation, /href: "\/admin"/);
});

test("owner audit includes sanitized operational access events", () => {
  assert.match(hardeningMigration, /list_staff_ops_audit_events/);
  assert.match(hardeningMigration, /right\(event\.actor_user_id::text, 8\)/);
  assert.doesNotMatch(
    hardeningMigration.slice(
      hardeningMigration.indexOf(
        "create or replace function public.list_staff_ops_audit_events",
      ),
    ),
    /auth_user\.email|profile\.short_intro/,
  );
});
