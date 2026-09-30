import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  buildEventDuplicateDefaults,
  parseEventDuplicateCadence,
  type EventDuplicateSource,
} from "../lib/events/duplication.ts";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const createPage = read("app/app/events/create/page.tsx");
const actions = read("app/app/events/actions.ts");
const settings = read("app/app/events/[publicSlug]/manage/settings/page.tsx");

const source: EventDuplicateSource = {
  public_slug: "event-aaaaaaaaaaaaaaaaaaaaaaaa",
  title: "Belajar Bareng UI/UX",
  description: "Diskusi portofolio bersama di ruang publik kampus yang nyaman.",
  category: "design",
  scope: "open",
  starts_at: "2026-09-20T03:00:00.000Z",
  ends_at: "2026-09-20T05:00:00.000Z",
  timezone_name: "Asia/Jakarta",
  venue_category: "campus_public_area",
  venue_name: "Lobi Gedung Utama",
  venue_area: "Lantai satu dekat meja informasi",
  city: "Jakarta",
  capacity: 30,
  registration_mode: "approval",
  waitlist_enabled: true,
  registration_closes_at: "2026-09-19T03:00:00.000Z",
};

test("ED-01 duplicate suggests the next weekly slot and preserves duration", () => {
  const result = buildEventDuplicateDefaults(
    source,
    new Date("2026-09-15T00:00:00.000Z"),
  );

  assert.equal(result.starts_at, "2026-09-27T03:00:00.000Z");
  assert.equal(result.ends_at, "2026-09-27T05:00:00.000Z");
  assert.equal(result.registration_closes_at, null);
});

test("ED-02 duplicate copies only reusable event settings", () => {
  const result = buildEventDuplicateDefaults(
    source,
    new Date("2026-09-15T00:00:00.000Z"),
  );

  assert.equal(result.title, source.title);
  assert.equal(result.registration_mode, "approval");
  assert.equal(result.waitlist_enabled, true);
  assert.equal("public_slug" in result, false);
  assert.equal("participants" in result, false);
  assert.equal("team" in result, false);
  assert.equal("tickets" in result, false);
});

test("ED-03 old events roll forward safely instead of reusing a past date", () => {
  const result = buildEventDuplicateDefaults(
    source,
    new Date("2026-10-01T00:00:00.000Z"),
  );

  assert.ok(new Date(result.starts_at).getTime() >= Date.parse("2026-10-02T00:00:00.000Z"));
  assert.equal(
    new Date(result.ends_at).getTime() - new Date(result.starts_at).getTime(),
    2 * 60 * 60 * 1000,
  );
});

test("ED-04 duplicate source is permission-gated and creation stays explicit", () => {
  assert.match(createPage, /getCampusEventManagement\(duplicate, "team"\)/);
  assert.match(createPage, /buildEventDuplicateDefaults\(source, new Date\(\), cadence\)/);
  assert.match(createPage, /Periksa jadwal sebelum diterbitkan/);
  assert.doesNotMatch(createPage, /Duplikat acara/);
  assert.match(createPage, /Peserta, tim, tiket,\s+pertanyaan/);
  assert.match(settings, /Jadwalkan pertemuan berikutnya/);
  assert.match(settings, /cadence=weekly/);
  assert.match(settings, /cadence=monthly/);
  assert.match(actions, /eventSlugSchema\.safeParse\(formData\.get\("duplicateFrom"\)\)/);
  assert.match(actions, /parseEventDuplicateCadence/);
  assert.doesNotMatch(createPage, /createCampusEvent\(/);
});

test("ED-05 monthly cadence preserves local time and event duration", () => {
  const result = buildEventDuplicateDefaults(
    source,
    new Date("2026-09-15T00:00:00.000Z"),
    "monthly",
  );

  assert.equal(result.starts_at, "2026-10-20T03:00:00.000Z");
  assert.equal(result.ends_at, "2026-10-20T05:00:00.000Z");
});

test("ED-06 monthly cadence clamps safely to the last day of a short month", () => {
  const monthEndSource = {
    ...source,
    starts_at: "2026-01-31T03:00:00.000Z",
    ends_at: "2026-01-31T05:00:00.000Z",
  };
  const result = buildEventDuplicateDefaults(
    monthEndSource,
    new Date("2026-01-01T00:00:00.000Z"),
    "monthly",
  );

  assert.equal(result.starts_at, "2026-02-28T03:00:00.000Z");
  assert.equal(result.ends_at, "2026-02-28T05:00:00.000Z");
});

test("ED-07 unknown cadence falls back to the safe weekly option", () => {
  assert.equal(parseEventDuplicateCadence("monthly"), "monthly");
  assert.equal(parseEventDuplicateCadence("daily"), "weekly");
  assert.equal(parseEventDuplicateCadence(null), "weekly");
});
