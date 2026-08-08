import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  CAMPUS_OPTIONS,
  SEED_CAMPUS_LABELS,
  mergeCampusLabels,
} from "../lib/onboarding/options/campuses.ts";
import { filterOnboardingOptions } from "../lib/onboarding/options/shared.ts";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/202608070002_create_campus_options_v1.sql"),
  "utf8",
);
const service = readFileSync(join(root, "lib/campus/service.ts"), "utf8");
const ownerPage = readFileSync(
  join(root, "app/owner/campuses/page.tsx"),
  "utf8",
);
const adminPage = readFileSync(
  join(root, "app/admin/campuses/page.tsx"),
  "utf8",
);
const onboardingRoute = readFileSync(
  join(root, "app/api/onboarding/route.ts"),
  "utf8",
);

test("campus_options migration hardens catalog and staff RPCs", () => {
  assert.match(migration, /create table if not exists public\.campus_options/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.campus_options/);
  assert.match(migration, /list_approved_campus_options/);
  assert.match(migration, /suggest_campus_option/);
  assert.match(migration, /list_staff_campus_options/);
  assert.match(migration, /manage_campus_option/);
  assert.match(
    migration,
    /is_current_active_staff\(array\['owner', 'admin'\]/,
  );
  assert.match(
    migration,
    /Sekolah Tinggi Teknologi Terpadu Nurul Fikri/,
  );
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
});

test("seed campuses include Nurul Fikri and stay searchable", () => {
  assert.ok(
    SEED_CAMPUS_LABELS.includes(
      "Sekolah Tinggi Teknologi Terpadu Nurul Fikri",
    ),
  );
  assert.ok(
    filterOnboardingOptions(CAMPUS_OPTIONS, "nurul fikri").some(
      (option) =>
        option.label === "Sekolah Tinggi Teknologi Terpadu Nurul Fikri",
    ),
  );
  const merged = mergeCampusLabels(SEED_CAMPUS_LABELS, [
    "Universitas Contoh Baru",
  ]);
  assert.ok(
    merged.some((option) => option.label === "Universitas Contoh Baru"),
  );
});

test("app wires campus catalog for staff and onboarding suggestions", () => {
  assert.match(service, /list_approved_campus_options/);
  assert.match(service, /suggest_campus_option/);
  assert.match(service, /manage_campus_option/);
  assert.match(service, /compareCampusName|localeCompare/);
  assert.match(ownerPage, /requireActiveStaff/);
  assert.match(adminPage, /requireActiveStaff/);
  assert.match(onboardingRoute, /suggestCampusOption/);
});

test("campus sort migration orders catalog by name A-Z", () => {
  const sortMigration = readFileSync(
    join(root, "supabase/migrations/202608070003_sort_campus_options_by_name.sql"),
    "utf8",
  );
  assert.match(sortMigration, /order by campus\.name/);
  assert.doesNotMatch(
    sortMigration,
    /suggestion_count desc[\s\S]*campus\.name/,
  );
});
