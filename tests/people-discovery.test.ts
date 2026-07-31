import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parsePeopleFilters,
  peopleAliasSchema,
} from "../lib/people/validation.ts";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202607310004_create_people_discovery.sql",
    import.meta.url,
  ),
  "utf8",
);
const service = readFileSync(
  new URL("../lib/people/service.ts", import.meta.url),
  "utf8",
);
const listPage = readFileSync(
  new URL("../app/app/people/page.tsx", import.meta.url),
  "utf8",
);
const detailPage = readFileSync(
  new URL("../app/app/people/[alias]/page.tsx", import.meta.url),
  "utf8",
);

test("People filters accept approved bounded values", () => {
  const result = parsePeopleFilters({
    campus: "  Kampus Contoh ",
    program: "Informatika",
    semester: "3",
    city: "Bandung",
    goal: "study",
    interest: "technology",
    after: "Partner #123456",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.campus, "Kampus Contoh");
    assert.equal(result.data.semester, 3);
  }
});

test("People filters reject unknown, oversized, and malformed values", () => {
  for (const params of [
    { goal: "dating" },
    { interest: "unknown" },
    { semester: "17" },
    { campus: "x".repeat(121) },
    { after: "4c8d8484-1234-4567-9876-123456789012" },
  ]) {
    assert.equal(parsePeopleFilters(params).success, false);
  }
});

test("detail route identifier is the public alias, never a UUID", () => {
  assert.equal(peopleAliasSchema.safeParse("Partner #184000").success, true);
  assert.equal(
    peopleAliasSchema.safeParse("4c8d8484-1234-4567-9876-123456789012")
      .success,
    false,
  );
  assert.match(detailPage, /peopleAliasSchema\.safeParse/);
  assert.doesNotMatch(detailPage, /user_id|auth\.users/);
});

test("discovery RPC returns an explicit privacy-safe projection", () => {
  const returnProjection = migration.match(
    /returns table \(([\s\S]*?)\)\s*language plpgsql/,
  );
  assert.ok(returnProjection);

  for (const safeField of [
    "public_alias",
    "campus",
    "study_program",
    "semester",
    "city_region",
    "short_intro",
    "interests",
    "connection_goals",
    "is_verified",
  ]) {
    assert.match(returnProjection[1], new RegExp(safeField));
  }

  for (const privateField of [
    "user_id",
    "first_name",
    "email",
    "nim",
    "onboarding_completed_at",
    "verification_status",
  ]) {
    assert.doesNotMatch(returnProjection[1], new RegExp(privateField));
  }
});

test("discovery eligibility excludes the requester and hidden or incomplete profiles", () => {
  assert.match(migration, /profile\.user_id <> current_user_id/);
  assert.match(migration, /profile\.is_discoverable = true/);
  assert.match(migration, /profile\.onboarding_completed_at is not null/);
  assert.match(migration, /requester\.onboarding_completed_at is not null/);
  assert.match(migration, /order by profile\.public_alias asc/);
  assert.match(migration, /least\(greatest\(coalesce\(p_limit, 13\), 1\), 13\)/);
});

test("RPC grants are authenticated-only and visibility is self-scoped", () => {
  for (const functionName of [
    "list_people_discovery_profiles",
    "get_people_discovery_profile",
    "set_people_discovery_visibility",
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${functionName}`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${functionName}`));
  }
  assert.match(migration, /current_user_id uuid := auth\.uid\(\)/);
  assert.match(
    migration,
    /update public\.profiles[\s\S]*where user_id = current_user_id/,
  );
  assert.doesNotMatch(migration, /p_user_id|p_target_user/);
});

test("application calls only dedicated People RPCs and server auth guards both pages", () => {
  assert.doesNotMatch(service, /\.from\(["']profiles["']\)[\s\S]*\.select\(["']\*["']/);
  assert.match(service, /rpc\("list_people_discovery_profiles"/);
  assert.match(service, /rpc\("get_people_discovery_profile"/);
  for (const page of [listPage, detailPage]) {
    assert.match(page, /getAuthenticatedUser/);
    assert.match(page, /onboarding_completed_at/);
  }
});

test("verification badge comes only from the database-safe boolean", () => {
  assert.match(migration, /profile\.verification_status = 'verified'/);
  assert.match(detailPage, /profile\.is_verified/);
  assert.doesNotMatch(detailPage, /Math\.random|fake|mock/i);
});
