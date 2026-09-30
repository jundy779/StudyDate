import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const cover = read("components/events/event-cover.tsx");
const studentCard = read("components/events/event-list-item.tsx");
const publicCard = read("components/events/public-event-card.tsx");
const studentDetail = read("app/app/events/[publicSlug]/page.tsx");
const publicDetail = read("app/(public-docs)/events/[publicSlug]/page.tsx");

test("ECUI-01 every event category receives a branded fallback cover", () => {
  for (const category of [
    "study_together",
    "coding_tech",
    "design",
    "languages",
    "thesis",
    "exam_prep",
    "workshop",
    "discussion",
    "networking",
    "community",
    "other",
  ]) {
    assert.match(cover, new RegExp(`${category}:`));
  }
  assert.match(cover, /StudyDate Event/);
  assert.match(cover, /EVENT_CATEGORY_LABELS\[category\]/);
});

test("ECUI-02 cover is local, decorative, and does not depend on remote images", () => {
  assert.match(cover, /aria-hidden="true"/);
  assert.doesNotMatch(cover, /https?:\/\/|<img|next\/image|storage\.from/);
  assert.match(cover, /overflow-hidden/);
  assert.match(cover, /break-words/);
  assert.match(cover, /line-clamp-2/);
});

test("ECUI-03 student and public event surfaces share the same cover", () => {
  for (const surface of [studentCard, publicCard, studentDetail, publicDetail]) {
    assert.match(surface, /EventCover/);
  }
  assert.match(studentDetail, /variant="hero"/);
  assert.match(publicDetail, /variant="hero"/);
});

test("ECUI-04 card layouts remain bounded on mobile", () => {
  assert.match(studentCard, /min-w-0/);
  assert.match(publicCard, /min-w-0/);
  assert.match(studentCard, /className="w-full"/);
  assert.match(publicCard, /className="w-full"/);
  assert.doesNotMatch(studentCard, /min-w-max|overflow-x-auto/);
  assert.doesNotMatch(publicCard, /min-w-max|overflow-x-auto/);
});
