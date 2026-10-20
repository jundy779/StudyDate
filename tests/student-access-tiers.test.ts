import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { isSchoolEmail } from "../lib/auth/allowed-email-domains.ts";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const migration = read("supabase/migrations/202610200001_student_access_tiers_v1.sql");
const access = read("lib/account/student-access.ts");

test("school email detection matches the database rule", () => {
  assert.equal(isSchoolEmail("siswa@smkn1.sch.id"), true);
  assert.equal(isSchoolEmail("guru@SCH.ID"), true);
  assert.equal(isSchoolEmail("mhs@student.ui.ac.id"), false);
  assert.equal(isSchoolEmail("andi@gmail.com"), false);
  assert.equal(isSchoolEmail("palsu@sch.id.evil.com"), false);
  assert.equal(isSchoolEmail(null), false);
  assert.match(migration, /= 'sch\.id'[\s\S]*like '%\.sch\.id'/);
});

test("verification requirement is a server-side switch that defaults off", () => {
  assert.match(migration, /values \('require_student_verification', false\)/);
  assert.match(migration, /on conflict \(key\) do nothing/);
  assert.match(migration, /revoke all on table public\.platform_settings from public, anon, authenticated/);
  assert.match(
    migration,
    /owner_set_student_verification_requirement[\s\S]*is_current_active_staff\(array\['owner'\]::text\[\], false\)/,
  );
});

test("shared guards apply school and verification rules", () => {
  assert.match(
    migration,
    /function public\.is_eligible_introduction_student[\s\S]*?is_base_student_account\(p_user_id\)\s+and not public\.is_school_email_account\(p_user_id\)\s+and public\.passes_student_verification_gate\(p_user_id\)/,
  );
  assert.match(
    migration,
    /function public\.is_study_circle_student[\s\S]*?not public\.is_school_email_account\(p_user_id\)\s+and public\.passes_student_verification_gate\(p_user_id\)/,
  );
  assert.match(
    migration,
    /function public\.is_campus_event_student[\s\S]*?public\.is_school_email_account\(p_user_id\)\s+or public\.passes_student_verification_gate\(p_user_id\)/,
  );
  assert.match(
    migration,
    /function public\.is_event_organizer_eligible[\s\S]*?and not public\.is_school_email_account\(p_user_id\)/,
  );
});

test("school accounts can only register for educational events", () => {
  assert.match(migration, /create trigger campus_event_rsvps_school_account_category/);
  assert.match(migration, /event not available for school account/);
  assert.match(migration, /actor_is_school or public\.is_educational_event_category/);
  const sqlCategories = migration
    .match(/is_educational_event_category\(p_category text\)[\s\S]*?p_category in \(([\s\S]*?)\)/)?.[1]
    ?.match(/'([a-z_]+)'/g)
    ?.map((value) => value.replaceAll("'", ""));
  const tsCategories = access
    .match(/EDUCATIONAL_EVENT_CATEGORIES = \[([\s\S]*?)\]/)?.[1]
    ?.match(/"([a-z_]+)"/g)
    ?.map((value) => value.replaceAll('"', ""));
  assert.deepEqual(sqlCategories, tsCategories);
});

test("app list filter accepts every event category in the database constraint", () => {
  for (const category of ["seminar", "meetup", "hackathon"]) {
    assert.match(migration, new RegExp(`'${category}'`));
  }
});

test("pages redirect instead of exposing locked features", () => {
  for (const path of [
    "app/app/people/page.tsx",
    "app/app/introductions/page.tsx",
    "app/app/messages/page.tsx",
    "app/app/circles/page.tsx",
  ]) {
    assert.match(read(path), /await requireSocialFeatureAccess\(\);/, path);
  }
  assert.match(read("app/app/events/page.tsx"), /await requireEventFeatureAccess\(\);/);
  assert.match(access, /redirect\("\/app\/events\?akses=sekolah"\)/);
  assert.match(access, /redirect\("\/app\/verification\?wajib=1"\)/);
  assert.match(read("app/owner/actions.ts"), /!readiness\.enabled \|\| !readiness\.manualCardReady/);
});
