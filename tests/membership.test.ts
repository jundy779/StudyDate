import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { z } from "zod";
import {
  canUseFeature,
  getMembershipLimits,
  hasEntitlement,
  MEMBERSHIP_GRANT_DAYS,
  MEMBERSHIP_LIMITS,
} from "../lib/membership/limits.ts";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/202608170004_membership_entitlements_v1.sql"),
  "utf8",
);
const limits = readFileSync(join(root, "lib/membership/limits.ts"), "utf8");
const resolver = readFileSync(join(root, "lib/membership/resolver.ts"), "utf8");
const service = readFileSync(join(root, "lib/membership/service.ts"), "utf8");
const validation = readFileSync(
  join(root, "lib/membership/validation.ts"),
  "utf8",
);
const studentPage = readFileSync(
  join(root, "app/app/membership/page.tsx"),
  "utf8",
);
const ownerPage = readFileSync(
  join(root, "app/owner/memberships/page.tsx"),
  "utf8",
);
const ownerActions = readFileSync(
  join(root, "app/owner/memberships/actions.ts"),
  "utf8",
);
const peoplePage = readFileSync(join(root, "app/app/people/page.tsx"), "utf8");
const peopleCard = readFileSync(
  join(root, "components/people/people-profile-card.tsx"),
  "utf8",
);
const peopleDetail = readFileSync(
  join(root, "app/app/people/[alias]/page.tsx"),
  "utf8",
);
const filterForm = readFileSync(
  join(root, "components/people/people-filter-form.tsx"),
  "utf8",
);
const navigation = readFileSync(
  join(root, "components/navigation/responsive-navigation.tsx"),
  "utf8",
);
const capabilities = readFileSync(
  join(root, "lib/staff/capabilities.ts"),
  "utf8",
);
const identityReveal = readFileSync(
  join(root, "lib/identity-reveal/service.ts"),
  "utf8",
);
const contactReveal = readFileSync(
  join(root, "lib/contact-reveal/service.ts"),
  "utf8",
);
const introService = readFileSync(
  join(root, "lib/introductions/service.ts"),
  "utf8",
);
const peopleService = readFileSync(join(root, "lib/people/service.ts"), "utf8");
const circleService = readFileSync(join(root, "lib/circles/service.ts"), "utf8");
const claimMigration = readFileSync(
  join(root, "supabase/migrations/202608170001_early_access_account_claim.sql"),
  "utf8",
);
const deletionMigration = readFileSync(
  join(
    root,
    "supabase/migrations/202608100002_finalize_account_deletion_lifecycle.sql",
  ),
  "utf8",
);
const deactivateMigration = readFileSync(
  join(root, "supabase/migrations/202608070010_student_account_lifecycle.sql"),
  "utf8",
);
const quotaHotfix = readFileSync(
  join(
    root,
    "supabase/migrations/202608170005_fix_membership_quota_window_ambiguity.sql",
  ),
  "utf8",
);

class MembershipQuotaWindowModel {
  private readonly rows = new Map<string, number>();

  private windowStart(now: Date) {
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }

  private key(userId: string, action: string, now: Date) {
    return `${userId}:${action}:${this.windowStart(now)}`;
  }

  consume(
    userId: string | null,
    action: string,
    limit: number,
    now = new Date("2026-08-17T15:00:00.000Z"),
  ) {
    if (
      !userId ||
      action !== "people_discovery_daily" ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 1000
    ) {
      return false;
    }
    const key = this.key(userId, action, now);
    const current = this.rows.get(key) ?? 0;
    if (current >= limit) return false;
    this.rows.set(key, current + 1);
    return true;
  }

  count(
    userId: string,
    action: string,
    now = new Date("2026-08-17T15:00:00.000Z"),
  ) {
    return this.rows.get(this.key(userId, action, now)) ?? 0;
  }
}

test("Free is the default plan and Plus uses entitlements instead of a boolean", () => {
  assert.match(migration, /constraint membership_plans_code_allowed check \(code in \('free', 'plus'\)\)/);
  assert.match(migration, /constraint user_entitlements_plan_plus_only check \(plan_code = 'plus'\)/);
  assert.match(migration, /coalesce\(matched, 'free'\)/);
  assert.doesNotMatch(migration, /is_premium|premium_user|\bvip\b|\bgold\b/i);
  assert.doesNotMatch(limits, /is_premium|premium_user/);
  assert.equal(getMembershipLimits("free").peopleDiscoveryDaily, 10);
  assert.equal(getMembershipLimits("plus").peopleDiscoveryDaily, 40);
  assert.equal(hasEntitlement("free", "free"), true);
  assert.equal(hasEntitlement("free", "plus"), false);
  assert.equal(canUseFeature("free", "advancedDiscoveryFilters"), false);
  assert.equal(canUseFeature("plus", "advancedDiscoveryFilters"), true);
});

test("active Plus requires status, starts_at, and timestamp expiry without cron", () => {
  assert.match(
    migration,
    /entitlement\.status = 'active'[\s\S]*starts_at <= timezone\('utc', now\(\)\)[\s\S]*ends_at is null[\s\S]*ends_at > timezone\('utc', now\(\)\)/,
  );
  assert.doesNotMatch(migration, /pg_cron|cron\.schedule/i);
  assert.match(migration, /timezone\('utc', now\(\)\)/);
  assert.match(migration, /starts_at timestamptz not null/);
});

test("future, expired, and revoked Plus fall back to Free", () => {
  assert.match(migration, /starts_at <= timezone\('utc', now\(\)\)/);
  assert.match(migration, /status in \('active', 'expired', 'revoked'\)/);
  assert.match(resolver, /plan_code !== "plus"/);
  assert.match(resolver, /plan: "free"/);
  assert.match(studentPage, /Paket Plus kamu telah berakhir/);
});

test("overlapping active Plus rows are prevented and resolver is deterministic", () => {
  assert.match(migration, /user_entitlements_one_active_plus_idx/);
  assert.match(
    migration,
    /order by entitlement\.ends_at desc nulls first, entitlement\.starts_at desc/,
  );
  assert.match(migration, /greatest\(current_row\.ends_at, next_end\)/);
  assert.match(migration, /if current_row\.ends_at is null/);
});

test("students cannot insert or self-upgrade entitlements", () => {
  assert.match(
    migration,
    /revoke all on table public\.user_entitlements from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /revoke all on function public\.manage_user_membership\(uuid, text, integer\)[\s\S]*from public, anon, authenticated/,
  );
  assert.match(resolver, /rpc\("get_my_membership"\)/);
  assert.doesNotMatch(resolver, /\.from\(["']user_entitlements["']\)/);
  assert.doesNotMatch(studentPage, /manage_user_membership|grant_plus/);
});

test("membership authority is request-cached server RPC, not client state", () => {
  assert.match(resolver, /import "server-only"/);
  assert.match(resolver, /cache\(async/);
  assert.doesNotMatch(resolver, /localStorage|user_metadata/);
  assert.doesNotMatch(studentPage, /localStorage|is_premium/);
});

test("product quotas are centralized and enforced in RPCs", () => {
  assert.equal(MEMBERSHIP_LIMITS.free.introductionRequestsDaily, 3);
  assert.equal(MEMBERSHIP_LIMITS.plus.activeIntroductions, 10);
  assert.equal(MEMBERSHIP_LIMITS.free.createdCirclesActive, 1);
  assert.equal(MEMBERSHIP_LIMITS.plus.joinedCirclesActive, 10);
  assert.match(migration, /people_discovery_daily' then 10/);
  assert.match(migration, /people_discovery_daily' then 40/);
  assert.match(migration, /discovery quota reached/);
  assert.match(migration, /introduction quota reached/);
  assert.match(migration, /circle ownership quota reached/);
  assert.match(migration, /circle membership quota reached/);
  assert.match(peopleService, /discovery quota reached/);
  assert.match(introService, /quota reached/);
  assert.match(circleService, /ownership quota/);
  assert.doesNotMatch(peoplePage, /if \(isPremium\)/);
});

test("security rate limits stay independent of Plus capacity", () => {
  assert.match(migration, /sent_last_hour >= 5/);
  assert.match(migration, /sent_last_day >= 15/);
  assert.match(migration, /consume_study_circle_rate_limit\([\s\S]*'create_day', 2/);
  assert.match(migration, /consume_study_circle_rate_limit\([\s\S]*'membership_day', 30/);
  assert.match(migration, /introduction rate limited/);
  assert.match(introService, /RATE_LIMIT_MESSAGE/);
  assert.match(peopleDetail, /quota_reached/);
});

test("advanced discovery filters are ignored for Free on the server", () => {
  assert.match(migration, /membership_allows_advanced_discovery/);
  assert.match(migration, /filter_semester := null/);
  assert.match(filterForm, /advancedEnabled/);
  assert.match(peoplePage, /advancedEnabled=\{limits\.advancedDiscoveryFilters\}/);
});

test("downgrade copy is non-destructive", () => {
  assert.match(circleService, /Circle yang ada tetap aman/);
  assert.match(studentPage, /yang sudah ada tetap aman/);
  assert.doesNotMatch(migration, /delete from public\.study_circles/);
  assert.doesNotMatch(migration, /delete from public\.introduction_requests/);
});

test("safety, reveal, and verification are not membership-gated", () => {
  assert.doesNotMatch(identityReveal, /effective_membership_plan|getMyMembership|is_premium/);
  assert.doesNotMatch(contactReveal, /effective_membership_plan|getMyMembership|is_premium/);
  assert.doesNotMatch(migration, /block_student_by_alias[\s\S]{0,80}membership_plan_limit/);
  assert.match(studentPage, /Blokir, laporkan, pusat keamanan/);
  assert.doesNotMatch(peopleCard, /StudyDate Plus|Plus badge|isPlus/);
  assert.doesNotMatch(peopleDetail, /Plus badge|isPlus|plan === "plus"/);
});

test("student membership UI has no checkout or payment provider", () => {
  assert.match(navigation, /href: "\/app\/membership"/);
  assert.match(navigation, /label: "StudyDate Plus"/);
  assert.match(studentPage, /StudyDate Plus segera tersedia/);
  assert.match(studentPage, /Tidak ada checkout pada halaman ini/);
  assert.doesNotMatch(studentPage, /autogopay|qris|checkout_url|harga Rp/i);
  assert.doesNotMatch(migration, /autogopay|checkout_url|qris|AUTOGOPAY/i);
});

test("Owner grant is email-only with bounded durations and audit", () => {
  assert.match(ownerPage, /Email akun Auth/);
  assert.doesNotMatch(ownerPage, /UUID akun|targetUserId|p_target_user_id/);
  assert.doesNotMatch(ownerActions, /targetUserId|p_target_user_id/);
  assert.match(service, /lookup_membership_ops/);
  assert.match(service, /manage_user_membership_by_email/);
  assert.doesNotMatch(service, /email_display/);
  assert.match(migration, /duration not in \(7, 30, 90\)/);
  assert.match(migration, /membership_granted/);
  assert.match(migration, /membership_extended/);
  assert.match(migration, /membership_revoked/);
  assert.match(migration, /substring\(profile\.public_alias from '\[0-9\]\{6\}\$'\)/);
  assert.doesNotMatch(migration, /right\(p_target_user_id::text/);
  assert.match(validation, /durationDays/);
  assert.match(validation, /MEMBERSHIP_GRANT_DAYS/);
  assert.deepEqual([...MEMBERSHIP_GRANT_DAYS], [7, 30, 90]);
  const grantSchema = z
    .object({
      email: z.string().trim().toLowerCase().email(),
      durationDays: z.coerce
        .number()
        .refine((value) => (MEMBERSHIP_GRANT_DAYS as readonly number[]).includes(value)),
    })
    .strict();
  assert.equal(
    grantSchema.safeParse({ email: "owner@example.com", durationDays: 14 }).success,
    false,
  );
  assert.equal(
    grantSchema.parse({ email: "  Owner@Example.com ", durationDays: 7 }).email,
    "owner@example.com",
  );
});

test("Admin does not receive memberships.manage and Owner route is owner-only", () => {
  assert.doesNotMatch(capabilities, /memberships\.manage|memberships\.read/);
  assert.match(ownerPage, /requireOwner/);
  assert.match(navigation, /href: "\/owner\/memberships"/);
  assert.match(
    navigation,
    /if \(role === "admin"\)[\s\S]*return items;[\s\S]*\/owner\/memberships/,
  );
});

test("account deletion purges entitlements; deactivation does not", () => {
  assert.match(migration, /purge_membership_for_deleted_profile/);
  assert.match(migration, /delete from public\.user_entitlements where user_id = old\.user_id/);
  assert.match(deletionMigration, /delete from public\.profiles/);
  assert.match(deactivateMigration, /deactivate_my_student_account/);
  assert.doesNotMatch(deactivateMigration, /user_entitlements/);
});

test("Early Access claim does not auto-grant Plus", () => {
  assert.doesNotMatch(claimMigration, /user_entitlements|grant_plus|plan_code/);
  assert.match(migration, /early_access_promo/);
});

test("consume_membership_quota hotfix removes window_start ambiguity", () => {
  assert.match(
    migration,
    /^\s+window_start timestamptz := date_trunc\('day', timezone\('utc', now\(\)\)\);/m,
  );
  assert.doesNotMatch(
    quotaHotfix,
    /^\s+window_start timestamptz := date_trunc\('day', timezone\('utc', now\(\)\)\);/m,
  );
  assert.match(
    quotaHotfix,
    /v_quota_window_start timestamptz := date_trunc\('day', timezone\('utc', now\(\)\)\)/,
  );
  assert.match(
    quotaHotfix,
    /create or replace function public\.consume_membership_quota\(\s*p_user_id uuid,\s*p_action text,\s*p_limit integer\s*\)/,
  );
  assert.match(quotaHotfix, /returns boolean/);
  assert.match(quotaHotfix, /security definer/);
  assert.match(quotaHotfix, /set search_path = ''/);
  assert.match(
    quotaHotfix,
    /values \(\s*p_user_id,\s*p_action,\s*v_quota_window_start,\s*1/,
  );
  assert.match(
    quotaHotfix,
    /on conflict \(user_id, action, window_start\) do update/,
  );
  assert.match(quotaHotfix, /where usage\.hit_count < p_limit/);
  assert.match(
    quotaHotfix,
    /revoke all on function public\.consume_membership_quota\(uuid, text, integer\)/,
  );
  assert.doesNotMatch(quotaHotfix, /window_end/);
  assert.doesNotMatch(quotaHotfix, /autogopay|qris|checkout/i);
  assert.equal(MEMBERSHIP_LIMITS.free.peopleDiscoveryDaily, 10);
  assert.equal(MEMBERSHIP_LIMITS.plus.peopleDiscoveryDaily, 40);
});

test("quota window increments once, rejects overflow, and resets next UTC day", () => {
  const freeLimit = MEMBERSHIP_LIMITS.free.peopleDiscoveryDaily;
  const plusLimit = MEMBERSHIP_LIMITS.plus.peopleDiscoveryDaily;
  const day = new Date("2026-08-17T15:00:00.000Z");
  const nextDay = new Date("2026-08-18T00:00:00.000Z");
  const free = new MembershipQuotaWindowModel();
  const plus = new MembershipQuotaWindowModel();

  assert.equal(free.consume("student-free", "people_discovery_daily", freeLimit, day), true);
  assert.equal(free.count("student-free", "people_discovery_daily", day), 1);

  for (let index = 1; index < freeLimit; index += 1) {
    assert.equal(free.consume("student-free", "people_discovery_daily", freeLimit, day), true);
  }
  assert.equal(free.count("student-free", "people_discovery_daily", day), freeLimit);
  assert.equal(free.consume("student-free", "people_discovery_daily", freeLimit, day), false);
  assert.equal(free.count("student-free", "people_discovery_daily", day), freeLimit);
  assert.equal(free.consume("student-free", "people_discovery_daily", freeLimit, nextDay), true);
  assert.equal(free.count("student-free", "people_discovery_daily", nextDay), 1);

  for (let index = 0; index < plusLimit; index += 1) {
    assert.equal(plus.consume("student-plus", "people_discovery_daily", plusLimit, day), true);
  }
  assert.equal(plus.count("student-plus", "people_discovery_daily", day), plusLimit);
  assert.equal(plus.consume("student-plus", "people_discovery_daily", plusLimit, day), false);
  assert.equal(plus.consume(null, "people_discovery_daily", freeLimit, day), false);
  assert.match(peopleService, /discovery quota reached/);
  assert.match(migration, /if not public\.consume_membership_quota\(/);
});
