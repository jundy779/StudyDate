import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildOnboardingPrefillFromClaim,
  mapEarlyAccessHintsToOnboarding,
  parseClaimRpcPayload,
  sanitizeClaimPrefill,
  simulateConcurrentWaitlistClaims,
  toClientClaimState,
} from "../lib/early-access/claim-state.ts";
import { INTERESTS } from "../lib/onboarding/constants.ts";

const claimMigration = readFileSync(
  new URL(
    "../supabase/migrations/202608170001_early_access_account_claim.sql",
    import.meta.url,
  ),
  "utf8",
);
const moderationMigration = readFileSync(
  new URL(
    "../supabase/migrations/202608250002_early_access_moderation_invitation_v1.sql",
    import.meta.url,
  ),
  "utf8",
);
const waitlistMigration = readFileSync(
  new URL(
    "../supabase/migrations/202607300001_create_early_access_waitlist.sql",
    import.meta.url,
  ),
  "utf8",
);
const callback = readFileSync(
  new URL("../app/auth/callback/route.ts", import.meta.url),
  "utf8",
);
const onboardingPage = readFileSync(
  new URL("../app/onboarding/page.tsx", import.meta.url),
  "utf8",
);
const onboardingForm = readFileSync(
  new URL("../components/onboarding/onboarding-form.tsx", import.meta.url),
  "utf8",
);
const claimService = readFileSync(
  new URL("../lib/early-access/claim.ts", import.meta.url),
  "utf8",
);
const earlyAccessRoute = readFileSync(
  new URL("../app/api/early-access/route.ts", import.meta.url),
  "utf8",
);
const studentMagicLinkRoute = readFileSync(
  new URL("../app/api/auth/magic-link/route.ts", import.meta.url),
  "utf8",
);
const earlyAccessAccess = readFileSync(
  new URL("../lib/early-access/access.ts", import.meta.url),
  "utf8",
);

test("claim migration adds claimed columns and uniqueness without rewriting history", () => {
  assert.match(claimMigration, /claimed_user_id uuid null/);
  assert.match(claimMigration, /references auth\.users \(id\) on delete set null/);
  assert.match(claimMigration, /claimed_at timestamptz null/);
  assert.match(claimMigration, /status in \('waiting', 'claimed'\)/);
  assert.match(
    claimMigration,
    /early_access_waitlist_claimed_user_unique/,
  );
  assert.match(claimMigration, /early_access_waitlist_claim_consistency/);
  assert.doesNotMatch(claimMigration, /drop table public\.early_access_waitlist/i);
});

test("claim RPC is SECURITY DEFINER, auth.uid-bound, and not public/anon executable", () => {
  assert.match(
    claimMigration,
    /create or replace function public\.claim_early_access_for_me\(\)/,
  );
  assert.match(claimMigration, /security definer/);
  assert.match(claimMigration, /set search_path = ''/);
  assert.match(claimMigration, /actor uuid := auth\.uid\(\)/);
  assert.match(claimMigration, /from auth\.users auth_user/);
  assert.match(claimMigration, /lower\(waitlist\.email\) = normalized_email/);
  assert.match(claimMigration, /for update/);
  assert.match(
    claimMigration,
    /revoke all on function public\.claim_early_access_for_me\(\)[\s\S]*?from public, anon, authenticated;/,
  );
  assert.match(
    claimMigration,
    /grant execute on function public\.claim_early_access_for_me\(\)[\s\S]*?to authenticated;/,
  );
  assert.doesNotMatch(
    claimMigration,
    /grant execute on function public\.claim_early_access_for_me\(\)[\s\S]*?to anon;/,
  );
  assert.doesNotMatch(claimMigration, /p_user_id/);
  assert.doesNotMatch(claimMigration, /p_email/);
});

test("latest claim requires an approved moderation decision", () => {
  assert.match(moderationMigration, /status in \('waiting', 'approved', 'rejected', 'claimed'\)/);
  assert.match(moderationMigration, /waitlist_row\.status <> 'approved'/);
  assert.match(moderationMigration, /and status = 'approved'/);
  assert.match(moderationMigration, /reviewed_at timestamptz null/);
  assert.match(moderationMigration, /review_early_access_entry/);
  assert.match(moderationMigration, /early_access\.review/);
});

test("waitlist table stays closed to anon/authenticated direct access", () => {
  assert.match(
    waitlistMigration,
    /revoke all on table public\.early_access_waitlist from anon, authenticated;/,
  );
  assert.match(
    claimMigration,
    /revoke all on table public\.early_access_waitlist from anon, authenticated;/,
  );
  assert.match(
    moderationMigration,
    /revoke all on table public\.early_access_waitlist from anon, authenticated;/,
  );
});

test("deletion cleanup releases claim without deleting waitlist consent history", () => {
  assert.match(
    claimMigration,
    /update public\.early_access_waitlist[\s\S]*claimed_user_id = null[\s\S]*status = 'waiting'[\s\S]*where claimed_user_id = target_user_id;/,
  );
  assert.doesNotMatch(
    claimMigration,
    /delete from public\.early_access_waitlist/,
  );
});

test("re-released claims require a fresh Early Access review", () => {
  assert.match(moderationMigration, /normalize_early_access_review_lifecycle/);
  assert.match(moderationMigration, /old\.status = 'claimed'[\s\S]*new\.status = 'waiting'/);
  assert.match(moderationMigration, /new\.reviewed_at := null/);
  assert.match(moderationMigration, /new\.reviewed_by := null/);
  assert.match(moderationMigration, /new\.invitation_sent_at := null/);
});

test("auth callback claims only after session and lifecycle gates", () => {
  assert.match(callback, /await claimEarlyAccessForCurrentUser\(\)/);
  const claimIndex = callback.indexOf("await claimEarlyAccessForCurrentUser()");
  const deletionIndex = callback.indexOf('redirect("/account/deletion-pending")');
  const deactivateIndex = callback.indexOf('redirect("/account/reactivate")');
  const onboardingIndex = callback.indexOf('redirect("/onboarding")');
  assert.ok(claimIndex > deletionIndex);
  assert.ok(claimIndex > deactivateIndex);
  assert.ok(onboardingIndex > claimIndex);
  assert.match(callback, /isAllowedStudentEmail/);
  assert.match(callback, /!claim\.earlyAccessClaimed/);
  assert.match(callback, /early_access_required/);
});

test("claim service never accepts client email or user id arguments", () => {
  assert.match(claimService, /claim_early_access_for_me/);
  assert.doesNotMatch(claimService, /p_email|user_id:|email:/);
  assert.match(claimService, /server-only/);
});

test("unauthenticated early-access route cannot claim or enumerate waitlist", () => {
  assert.doesNotMatch(earlyAccessRoute, /claim_early_access/);
  assert.doesNotMatch(earlyAccessRoute, /\.select\(/);
  assert.match(earlyAccessRoute, /\.insert\(/);
});

test("matching claim outcomes are idempotent and sanitized for the client", () => {
  const first = toClientClaimState("claimed_now", {
    campus: "Universitas Indonesia",
    interestHints: ["people", "groups"],
  });
  const second = toClientClaimState("already_claimed_by_self", {
    campus: "Universitas Indonesia",
    interestHints: ["people", "groups"],
  });

  assert.equal(first.earlyAccessClaimed, true);
  assert.equal(second.earlyAccessClaimed, true);
  assert.equal(first.showWelcomeBack, true);
  assert.equal(second.showConflictSupport, false);
  assert.deepEqual(first.prefill?.interestHints, ["people", "groups"]);
});

test("email normalization for claim matching trims and lowercases", () => {
  const race = simulateConcurrentWaitlistClaims("  Student@Example.com ", [
    { userId: "user-a", email: "student@example.com" },
  ]);
  assert.deepEqual(race.outcomes, ["claimed_now"]);

  const mismatch = simulateConcurrentWaitlistClaims("student@example.com", [
    { userId: "user-a", email: "  Other@Example.com " },
  ]);
  assert.deepEqual(mismatch.outcomes, ["not_waitlisted"]);
});

test("client cannot choose another email or user id through claim state parsing", () => {
  const spoofed = parseClaimRpcPayload({
    outcome: "claimed_now",
    prefill: {
      campus: "Kampus",
      interestHints: ["people"],
      email: "victim@gmail.com",
      claimed_user_id: "00000000-0000-0000-0000-000000000099",
      id: "00000000-0000-0000-0000-000000000001",
      source: "hero",
    },
  });

  assert.equal(spoofed.earlyAccessClaimed, true);
  assert.equal(spoofed.prefill?.campus, "Kampus");
  assert.equal(
    JSON.stringify(spoofed).includes("victim@gmail.com"),
    false,
  );
  assert.equal(JSON.stringify(spoofed).includes("00000000"), false);
  assert.equal(JSON.stringify(spoofed).includes("hero"), false);
});

test("non-waitlist and conflict outcomes stay closed", () => {
  assert.equal(
    toClientClaimState("not_waitlisted", null).earlyAccessClaimed,
    false,
  );
  assert.equal(
    toClientClaimState("not_eligible", null).showWelcomeBack,
    false,
  );
  const conflict = toClientClaimState("already_claimed_other", {
    campus: "X",
    interestHints: ["people"],
  });
  assert.equal(conflict.earlyAccessClaimed, false);
  assert.equal(conflict.prefill, null);
  assert.equal(conflict.showConflictSupport, true);
});

test("concurrent claim attempts associate a waitlist row with at most one user", () => {
  const result = simulateConcurrentWaitlistClaims("naya@gmail.com", [
    { userId: "user-a", email: "naya@gmail.com" },
    { userId: "user-b", email: "naya@gmail.com" },
    { userId: "user-a", email: "naya@gmail.com" },
  ]);

  assert.deepEqual(result.winners, ["user-a"]);
  assert.deepEqual(result.outcomes, [
    "claimed_now",
    "already_claimed_other",
    "already_claimed_by_self",
  ]);
});

test("prefill maps only compatible Early Access fields and never profile topic interests", () => {
  const mapped = mapEarlyAccessHintsToOnboarding({
    campus: "  Institut Teknologi Bandung  ",
    interestHints: ["people", "groups", "events"],
  });

  assert.ok(mapped);
  assert.equal(mapped.campus, "Institut Teknologi Bandung");
  assert.equal(mapped.preferences.groupFirst, true);
  assert.deepEqual(mapped.connectionGoals, [
    "friendship",
    "campus_activities",
  ]);

  const profileInterestValues = INTERESTS.map((item) => item.value);
  for (const goal of mapped.connectionGoals) {
    assert.equal(profileInterestValues.includes(goal as never), false);
  }

  const onboarding = buildOnboardingPrefillFromClaim(
    toClientClaimState("claimed_now", {
      campus: "ITB",
      interestHints: ["groups"],
    }),
  );
  assert.equal(onboarding?.earlyAccessClaimed, true);
  assert.equal(onboarding?.preferences.groupFirst, true);
  assert.deepEqual(onboarding?.connectionGoals, []);
});

test("sanitizeClaimPrefill drops unknown interest hints", () => {
  const sanitized = sanitizeClaimPrefill({
    campus: " UI ",
    interestHints: ["people", "technology", "groups", "people"],
  });
  assert.deepEqual(sanitized?.interestHints, ["people", "groups"]);
  assert.equal(sanitized?.campus, "UI");
});

test("onboarding still requires consents and does not auto-complete from claim", () => {
  assert.match(onboardingForm, /consents\.terms/);
  assert.match(onboardingForm, /consents\.privacy/);
  assert.match(onboardingForm, /communityGuidelines/);
  assert.match(onboardingPage, /earlyAccessPrefill/);
  assert.match(onboardingForm, /Selamat datang kembali/);
  assert.match(onboardingForm, /Akses Awal kamu sudah terhubung/);
  assert.doesNotMatch(onboardingForm, /Daftar ulang|Buat akun lagi|Registrasi ulang/);
  assert.doesNotMatch(onboardingForm, /Early Access Member/);
  assert.doesNotMatch(onboardingPage, /createUser|signUp|admin\.createUser/);
  assert.match(onboardingPage, /!claim\.earlyAccessClaimed/);
  assert.match(onboardingPage, /early_access_required/);
});

test("new accounts are invitation-gated while completed accounts can still log in", () => {
  assert.doesNotMatch(moderationMigration, /insert into auth\.users/i);
  assert.doesNotMatch(claimService, /createUser|inviteUserByEmail/);
  assert.match(moderationMigration, /can_issue_student_magic_link/);
  assert.match(moderationMigration, /auth\.role\(\) <> 'service_role'/);
  assert.match(moderationMigration, /profile\.onboarding_completed_at is not null/);
  assert.match(moderationMigration, /waitlist\.status in \('approved', 'claimed'\)/);
  assert.match(earlyAccessAccess, /admin\.rpc\("can_issue_student_magic_link"/);
  assert.match(studentMagicLinkRoute, /canReceiveStudentMagicLink/);
  assert.match(studentMagicLinkRoute, /return NextResponse\.json\(\{ ok: true \}\)/);
  assert.match(callback, /!claim\.earlyAccessClaimed/);
});

test("claim RPC payload never returns source attribution to the browser mapper", () => {
  const parsed = parseClaimRpcPayload({
    outcome: "claimed_now",
    prefill: {
      campus: "UI",
      interestHints: ["events"],
      source: "final-cta",
      consent_version: "v1",
    },
  });
  const serialized = JSON.stringify(parsed);
  assert.equal(serialized.includes("final-cta"), false);
  assert.equal(serialized.includes("consent_version"), false);
  assert.equal(serialized.includes("v1"), false);
});
