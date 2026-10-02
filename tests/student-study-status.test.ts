import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getStudyStatusLabel,
  isStudyStatus,
  STUDY_STATUS_OPTIONS,
} from "../lib/people/study-status.ts";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202610020003_temporary_student_study_status_v1.sql",
    import.meta.url,
  ),
  "utf8",
);
const peoplePage = readFileSync(
  new URL("../app/app/people/page.tsx", import.meta.url),
  "utf8",
);
const profileCard = readFileSync(
  new URL("../components/people/people-profile-card.tsx", import.meta.url),
  "utf8",
);
const peopleActions = readFileSync(
  new URL("../app/app/people/actions.ts", import.meta.url),
  "utf8",
);
const peopleService = readFileSync(
  new URL("../lib/people/service.ts", import.meta.url),
  "utf8",
);

test("student study statuses use a small human-language allowlist", () => {
  assert.deepEqual(
    STUDY_STATUS_OPTIONS.map((option) => option.value),
    ["study_friend", "discussion_friend", "project_friend"],
  );
  assert.equal(isStudyStatus("study_friend"), true);
  assert.equal(isStudyStatus("dating"), false);
  assert.equal(getStudyStatusLabel("study_friend"), "Lagi cari teman belajar");
  assert.equal(getStudyStatusLabel(null), null);
});

test("study status is self-owned, temporary, and safely projected", () => {
  assert.match(migration, /actor uuid := auth\.uid\(\)/);
  assert.match(migration, /where profile\.user_id = actor/);
  assert.match(migration, /interval '24 hours'/);
  assert.match(
    migration,
    /profile\.study_status_expires_at > timezone\('utc', now\(\)\)/,
  );
  assert.match(migration, /is_eligible_introduction_student\(actor\)/);
  assert.match(migration, /consume_membership_quota/);
  assert.doesNotMatch(
    migration,
    /grant select[\s\S]*profiles[\s\S]*study_status/i,
  );
});

test("People UI explains expiry and hides controls until the RPC exists", () => {
  assert.match(peoplePage, /ownStudyStatus\.supported/);
  assert.match(peoplePage, /Status ini tampil selama 24 jam, lalu hilang sendiri\./);
  assert.match(peoplePage, /Tidak pasang status/);
  assert.match(profileCard, /getStudyStatusLabel\(profile\.study_status\)/);
  assert.match(profileCard, /Clock3/);
  assert.match(peopleActions, /isStudyStatus\(rawStatus\)/);
  assert.match(peopleService, /capabilityMissing/);
  assert.match(peopleService, /supported: false/);
});
