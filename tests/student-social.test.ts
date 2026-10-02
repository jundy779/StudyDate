import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildIntroductionSuggestions } from "../lib/introductions/suggestions.ts";
import {
  buildSharedStudentContext,
  hasSharedStudentContext,
} from "../lib/people/shared-context.ts";

const profileCard = readFileSync(
  new URL("../components/people/people-profile-card.tsx", import.meta.url),
  "utf8",
);
const detailPage = readFileSync(
  new URL("../app/app/people/[alias]/page.tsx", import.meta.url),
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

test("People pages explain similarities without dating-style scoring", () => {
  assert.match(profileCard, /SharedContextSummary/);
  assert.match(detailPage, /SharedContextSummary/);
  assert.doesNotMatch(
    [profileCard, detailPage].join("\n"),
    /persen cocok|compatibility score|match score|skor kecocokan/i,
  );
});
