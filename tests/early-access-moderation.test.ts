import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  staffHasCapability,
  type StaffCapabilityFlags,
} from "../lib/staff/capabilities.ts";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read(
  "supabase/migrations/202608250002_early_access_moderation_invitation_v1.sql",
);
const ownerPage = read("app/owner/early-access/page.tsx");
const staffPage = read("app/staff/early-access/page.tsx");
const queue = read("components/staff/early-access-queue.tsx");
const actions = read("app/staff/early-access/actions.ts");
const loginRoute = read("app/api/auth/magic-link/route.ts");
const callback = read("app/auth/callback/route.ts");
const onboarding = read("app/onboarding/page.tsx");
const accessHelper = read("lib/early-access/access.ts");
const delivery = read("lib/auth/magic-link-delivery.ts");
const ownerStaffActions = read("app/owner/staff/actions.ts");

function adminFlags(
  overrides: Partial<StaffCapabilityFlags> = {},
): StaffCapabilityFlags {
  return {
    role: "admin",
    verificationReviewer: false,
    canEarlyAccessRead: false,
    canEarlyAccessReview: false,
    canUsersRead: false,
    canUsersSupport: false,
    ...overrides,
  };
}

test("Early Access lifecycle is moderated and claim is approved-only", () => {
  assert.match(
    migration,
    /status in \('waiting', 'approved', 'rejected', 'claimed'\)/,
  );
  assert.match(migration, /p_decision not in \('approve', 'reject'\)/);
  assert.match(migration, /waitlist_row\.status <> 'approved'/);
  assert.match(migration, /and status = 'approved'/);
  assert.match(migration, /claimed early access cannot be reviewed/);
});

test("Owner is full-access while Staff review is an explicit narrow capability", () => {
  const owner: StaffCapabilityFlags = {
    ...adminFlags(),
    role: "owner",
  };
  const reviewer = adminFlags({ canEarlyAccessReview: true });

  assert.equal(staffHasCapability(owner, "early_access.read"), true);
  assert.equal(staffHasCapability(owner, "early_access.review"), true);
  assert.equal(staffHasCapability(reviewer, "early_access.read"), true);
  assert.equal(staffHasCapability(reviewer, "early_access.review"), true);
  assert.equal(staffHasCapability(reviewer, "users.support"), false);
  assert.equal(staffHasCapability(reviewer, "staff.manage"), false);
  assert.match(migration, /manage_early_access_review_capability/);
  assert.match(ownerStaffActions, /manageEarlyAccessReviewCapability/);
});

test("Owner and Staff render the same moderation queue with separate guards", () => {
  assert.match(ownerPage, /requireOwner\(\)/);
  assert.match(ownerPage, /<EarlyAccessQueue/);
  assert.match(ownerPage, /basePath="\/owner\/early-access"/);
  assert.match(staffPage, /requireStaffCapability\("early_access\.read"\)/);
  assert.match(staffPage, /<EarlyAccessQueue/);
  assert.match(staffPage, /basePath="\/staff\/early-access"/);
  assert.match(queue, /Mode baca saja/);
});

test("Approve sends a branded one-time invitation and supports safe resend", () => {
  assert.match(actions, /reviewEarlyAccessEntry/);
  assert.match(actions, /decision: "approve"/);
  assert.match(actions, /kind: "early-access"/);
  assert.match(actions, /nextPath: "\/onboarding"/);
  assert.match(actions, /prepareEarlyAccessInvitation/);
  assert.match(actions, /markEarlyAccessInvitationSent/);
  assert.match(queue, /Approve & kirim email/);
  assert.match(queue, /Kirim ulang undangan/);
  assert.match(delivery, /MagicLinkEmailKind/);
});

test("Public login is enumeration-safe and new/pre-onboarding accounts require approval", () => {
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.match(migration, /profile\.onboarding_completed_at is not null/);
  assert.match(migration, /waitlist\.status in \('approved', 'claimed'\)/);
  assert.match(accessHelper, /admin\.rpc\("can_issue_student_magic_link"/);
  assert.match(loginRoute, /canReceiveStudentMagicLink/);
  assert.match(loginRoute, /return NextResponse\.json\(\{ ok: true \}\)/);
  assert.doesNotMatch(loginRoute, /status:\s*"approved"|status:\s*"waiting"/);
});

test("Claim gate is enforced in both callback and direct onboarding entry", () => {
  assert.match(callback, /claimEarlyAccessForCurrentUser/);
  assert.match(callback, /!claim\.earlyAccessClaimed/);
  assert.match(callback, /early_access_required/);
  assert.match(onboarding, /claimEarlyAccessForCurrentUser/);
  assert.match(onboarding, /!claim\.earlyAccessClaimed/);
  assert.match(onboarding, /early_access_required/);
});

test("released claimed accounts need a fresh moderation decision", () => {
  assert.match(migration, /normalize_early_access_review_lifecycle/);
  assert.match(migration, /old\.status = 'claimed'[\s\S]*new\.status = 'waiting'/);
  assert.match(migration, /new\.reviewed_at := null/);
  assert.match(migration, /new\.reviewed_by := null/);
  assert.match(migration, /new\.invitation_sent_at := null/);
});

test("Owner identity is never authorized by hard-coded email literals", () => {
  const authorizationSurface = [
    migration,
    actions,
    ownerPage,
    staffPage,
    ownerStaffActions,
    accessHelper,
  ].join("\n");
  assert.doesNotMatch(
    authorizationSurface,
    /studydateid@gmail\.com|admin@studydate\.id/i,
  );
});

const revisionMigration = read(
  "supabase/migrations/202608260001_early_access_revision_reasons_v1.sql",
);
const revisionRoute = read("app/api/early-access/revise/route.ts");
const revisionPage = read("app/early-access/revise/page.tsx");
const reviewTemplate = read("lib/email/early-access-review-template.ts");
const reviewDelivery = read("lib/email/early-access-review-delivery.ts");

test("Early Access supports revision reasons without conflating them with rejection", () => {
  assert.match(
    revisionMigration,
    /status in \('waiting', 'approved', 'needs_revision', 'rejected', 'claimed'\)/,
  );
  assert.match(revisionMigration, /review_reason_codes text\[\]/);
  assert.match(revisionMigration, /review_user_note text/);
  assert.match(revisionMigration, /review_internal_note text/);
  assert.match(revisionMigration, /p_decision not in \('approve', 'needs_revision', 'reject'\)/);
  assert.match(queue, /Minta perbaikan/);
  assert.match(queue, /Tolak & kirim email/);
  assert.match(actions, /decision: "needs_revision"/);
  assert.match(actions, /kind: "rejected"/);
});

test("revision links are opaque one-time tokens and only hashes are stored", () => {
  assert.match(actions, /randomBytes\(32\)/);
  assert.match(actions, /createHash\("sha256"\)/);
  assert.match(revisionMigration, /revision_token_hash/);
  assert.match(revisionMigration, /revision_token_expires_at/);
  assert.match(revisionRoute, /createHash\("sha256"\)/);
  assert.match(revisionRoute, /\.eq\("revision_token_hash", tokenHash\)/);
  assert.match(revisionRoute, /revision_token_hash: null/);
  assert.match(revisionPage, /EarlyAccessRevisionForm/);
  assert.match(revisionPage, /import \{ Suspense \} from "react"/);
  assert.match(revisionPage, /<Suspense fallback=\{<RevisionStateFallback \/>\}>/);
  assert.match(revisionPage, /<RevisionState searchParams=\{searchParams\} \/>/);
});

test("review email separates applicant-facing and internal notes", () => {
  assert.match(reviewTemplate, /Catatan dari tim StudyDate/);
  assert.match(reviewDelivery, /sendStudyDateEmail/);
  assert.doesNotMatch(reviewTemplate, /internalNote|review_internal_note/);
  assert.match(queue, /Catatan internal/);
});
