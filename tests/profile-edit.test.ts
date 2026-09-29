import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  countCompletedProfileItems,
  getProfileCompletenessItems,
} from "../lib/profile/completeness.ts";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/202608070009_student_profile_self_edit.sql"),
  "utf8",
);
const interestsMigration = readFileSync(
  join(
    root,
    "supabase/migrations/202608070011_student_profile_interests_goals.sql",
  ),
  "utf8",
);
const settingsMigration = readFileSync(
  join(
    root,
    "supabase/migrations/202608100001_account_privacy_controls_v1.sql",
  ),
  "utf8",
);
const page = readFileSync(join(root, "app/app/profile/page.tsx"), "utf8");
const form = readFileSync(
  join(root, "components/profile/profile-edit-form.tsx"),
  "utf8",
);

test("profile self-edit migration hardens update RPC", () => {
  assert.match(migration, /avatar_mascot/);
  assert.match(migration, /update_my_student_profile/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /is_active_staff_user/);
  assert.doesNotMatch(migration, /identity-reveal-photos/);
});

test("settings migration replaces legacy identity editing with bounded fields", () => {
  assert.match(settingsMigration, /update_my_student_profile_settings/);
  assert.doesNotMatch(
    settingsMigration.match(
      /create or replace function public\.update_my_student_profile_settings[\s\S]*?revoke all on function public\.update_my_student_profile_settings/,
    )?.[0] ?? "",
    /p_first_name|p_last_name/,
  );
  assert.match(settingsMigration, /campus_options/);
  assert.match(settingsMigration, /study_program_options/);
});

test("profile interests/goals migration extends update RPC", () => {
  assert.match(interestsMigration, /p_interests text\[\]/);
  assert.match(interestsMigration, /p_connection_goals text\[\]/);
  assert.match(interestsMigration, /interests = cleaned_interests/);
  assert.match(interestsMigration, /connection_goals = cleaned_goals/);
});

test("profile edit UI separates mascot from clear-face photos", () => {
  assert.match(page, /\/app\/settings#profil/);
  assert.match(form, /Avatar & visibilitas/);
  assert.match(form, /berbagi nama dan foto/);
  assert.match(form, /PROFILE_MASCOT_OPTIONS/);
});

test("profile edit UI includes completeness, preview, and interests", () => {
  assert.match(form, /Kelengkapan/);
  assert.match(form, /Pratinjau People/);
  assert.match(form, /Tujuan & minat/);
  assert.match(form, /PeopleProfileCard/);
  assert.match(form, /CONNECTION_GOALS/);
  assert.match(form, /INTERESTS/);
  assert.match(form, /lg:grid-cols-/);
});

test("profile completeness checklist tracks expected items", () => {
  const incomplete = getProfileCompletenessItems({
    campus: "UMN",
    studyProgram: "Informatika",
    cityRegion: null,
    shortIntro: null,
    interests: [],
    connectionGoals: [],
    avatarMascot: null,
    isDiscoverable: false,
    linkedinUrl: null,
    instagramUsername: null,
  });
  assert.equal(countCompletedProfileItems(incomplete), 1);

  const complete = getProfileCompletenessItems({
    campus: "UMN",
    studyProgram: "Informatika",
    cityRegion: "Tangerang",
    shortIntro: "Hai",
    interests: ["technology"],
    connectionGoals: ["study"],
    avatarMascot: "front",
    isDiscoverable: true,
    linkedinUrl: "https://www.linkedin.com/in/andi",
    instagramUsername: "andi",
  });
  assert.equal(countCompletedProfileItems(complete), complete.length);
});

test("profile UI prioritizes required LinkedIn over optional Instagram", () => {
  assert.match(form, /LinkedIn/);
  assert.match(form, /wajib/);
  assert.match(form, /Instagram/);
  assert.match(form, /opsional/);
  assert.match(form, /linkedinUrl/);
});
