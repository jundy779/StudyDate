import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  SEED_STUDY_PROGRAM_LABELS,
  STUDY_PROGRAM_OPTIONS,
} from "../lib/onboarding/options/study-programs.ts";
import { filterOnboardingOptions } from "../lib/onboarding/options/shared.ts";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/202608070004_create_study_program_options_v1.sql",
  ),
  "utf8",
);
const service = readFileSync(join(root, "lib/study-program/service.ts"), "utf8");
const ownerPage = readFileSync(
  join(root, "app/owner/study-programs/page.tsx"),
  "utf8",
);
const onboardingRoute = readFileSync(
  join(root, "app/api/onboarding/route.ts"),
  "utf8",
);

test("study_program_options migration mirrors campus catalog hardening", () => {
  assert.match(
    migration,
    /create table if not exists public\.study_program_options/,
  );
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.study_program_options/);
  assert.match(migration, /list_approved_study_program_options/);
  assert.match(migration, /suggest_study_program_option/);
  assert.match(migration, /list_staff_study_program_options/);
  assert.match(migration, /manage_study_program_option/);
  assert.match(migration, /order by program\.name/);
  assert.match(migration, /Teknik Informatika/);
});

test("seed study programs stay searchable A-Z", () => {
  assert.ok(SEED_STUDY_PROGRAM_LABELS.includes("Teknik Informatika"));
  assert.ok(
    filterOnboardingOptions(STUDY_PROGRAM_OPTIONS, "sistem informasi").some(
      (option) => option.label === "Sistem Informasi",
    ),
  );
  const labels = STUDY_PROGRAM_OPTIONS.map((option) => option.label);
  assert.deepEqual(
    labels,
    [...labels].sort((left, right) =>
      left.localeCompare(right, "id-ID", {
        sensitivity: "base",
        numeric: true,
      }),
    ),
  );
});

test("app wires study program catalog for staff and onboarding", () => {
  assert.match(service, /list_approved_study_program_options/);
  assert.match(service, /suggest_study_program_option/);
  assert.match(ownerPage, /requireActiveStaff/);
  assert.match(onboardingRoute, /suggestStudyProgramOption/);
});
