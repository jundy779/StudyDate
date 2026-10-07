import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildIntroductionSuggestions } from "../lib/introductions/suggestions.ts";
import {
  buildSharedStudentContext,
  hasSharedStudentContext,
} from "../lib/people/shared-context.ts";
import { sortDiscoveryProfilesBySharedContext } from "../lib/people/recommendations.ts";
import type { DiscoveryProfile } from "../lib/people/service.ts";

const profileCard = readFileSync(
  new URL("../components/people/people-profile-card.tsx", import.meta.url),
  "utf8",
);
const detailPage = readFileSync(
  new URL("../app/app/people/[alias]/page.tsx", import.meta.url),
  "utf8",
);
const dashboard = readFileSync(
  new URL("../app/app/page.tsx", import.meta.url),
  "utf8",
);
const peoplePage = readFileSync(
  new URL("../app/app/people/page.tsx", import.meta.url),
  "utf8",
);
const peopleFilter = readFileSync(
  new URL("../components/people/people-filter-form.tsx", import.meta.url),
  "utf8",
);
const introductionDialog = readFileSync(
  new URL(
    "../components/introductions/send-introduction-dialog.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("shared student context finds useful similarities without a score", () => {
  const context = buildSharedStudentContext(
    {
      campus: "Universitas Contoh",
      study_program: "Informatika",
      interests: ["technology", "design", "technology"],
      connection_goals: ["study", "project"],
    },
    {
      campus: " universitas contoh ",
      study_program: "INFORMATIKA",
      interests: ["technology", "career"],
      connection_goals: ["community", "project"],
    },
  );

  assert.deepEqual(context.sharedInterestKeys, ["technology"]);
  assert.deepEqual(context.sharedGoalKeys, ["project"]);
  assert.equal(context.sameCampus, true);
  assert.equal(context.sameStudyProgram, true);
  assert.equal(hasSharedStudentContext(context), true);
});

test("message starters stay short, editable, and focused on student activities", () => {
  const suggestions = buildIntroductionSuggestions({
    sharedInterestLabels: ["Teknologi"],
    sharedGoalLabels: ["Kerja bareng proyek"],
  });

  assert.equal(suggestions.length, 3);
  for (const suggestion of suggestions) {
    assert.ok(suggestion.message.length >= 12);
    assert.ok(suggestion.message.length <= 300);
    assert.doesNotMatch(suggestion.message, /https?:|@|\b\d{8,}\b/i);
  }

  assert.match(introductionDialog, /Pilih contoh pesan/);
  assert.match(introductionDialog, /setMessage\(suggestion\.message\)/);
});

test("student dashboard brings the main social spaces together", () => {
  for (const href of [
    "/app/people",
    "/app/circles",
    "/app/events",
    "/app/introductions",
    "/app/messages",
  ]) {
    assert.match(dashboard, new RegExp(`href: "${href}"`));
  }
  assert.match(dashboard, /Semua ruang sosialmu/);
  assert.match(dashboard, /tanpa membuka nama asli/);
});

test("People pages explain similarities without dating-style scoring", () => {
  assert.match(profileCard, /SharedContextSummary/);
  assert.match(detailPage, /SharedContextSummary/);
  assert.doesNotMatch(
    [profileCard, detailPage].join("\n"),
    /persen cocok|compatibility score|match score|skor kecocokan/i,
  );
});


function discoveryProfile(
  alias: string,
  values: Partial<DiscoveryProfile> = {},
): DiscoveryProfile {
  return {
    public_alias: alias,
    campus: "Kampus Lain",
    study_program: "Informatika",
    semester: null,
    city_region: null,
    short_intro: null,
    interests: [],
    connection_goals: [],
    is_verified: false,
    study_status: null,
    study_status_expires_at: null,
    ...values,
  };
}

test("Paling nyambung prioritizes active and shared student context", () => {
  const ownProfile = {
    campus: "STT Terpadu Nurul Fikri",
    study_program: "Sistem Informasi",
    interests: ["technology", "business"],
    connection_goals: ["study", "collaboration"],
  };
  const ordered = sortDiscoveryProfilesBySharedContext(ownProfile, [
    discoveryProfile("Partner #000003", { interests: ["technology"] }),
    discoveryProfile("Partner #000002", {
      connection_goals: ["study"],
      study_status: "study_friend",
    }),
    discoveryProfile("Partner #000001", {
      connection_goals: ["study"],
    }),
  ]);

  assert.deepEqual(
    ordered.map((profile) => profile.public_alias),
    ["Partner #000002", "Partner #000001", "Partner #000003"],
  );
});

test("Paling nyambung is transparent, optional, and never shows a score", () => {
  assert.match(peoplePage, /Paling nyambung/);
  assert.match(peoplePage, /Urutan profil/);
  assert.match(peoplePage, /Tidak ada nilai kecocokan/);
  assert.match(peoplePage, /sortDiscoveryProfilesBySharedContext/);
  assert.match(peopleFilter, /name="order"/);
  assert.doesNotMatch(
    peoplePage,
    /[0-9]+% cocok|compatibility score|match score|skor kecocokan/i,
  );
});
