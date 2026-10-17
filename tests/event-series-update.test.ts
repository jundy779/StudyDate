import assert from "node:assert/strict";
import test from "node:test";

import { planEventSeriesUpdates } from "../lib/events/series-update.ts";

const update = {
  title: "Belajar Bareng Basis Data",
  description: "Belajar santai dan latihan soal basis data bersama mahasiswa.",
  category: "study_together" as const,
  registrationMode: "instant" as const,
  waitlistEnabled: true,
  startsAtLocal: "2026-11-08T10:00",
  endsAtLocal: "2026-11-08T12:00",
  timezone: "Asia/Jakarta" as const,
  venueCategory: "library" as const,
  venueName: "Perpustakaan Kampus",
  venueArea: "Lantai dua area baca umum",
  city: "Jakarta",
  capacity: 20,
  confirmsPublicPlace: true as const,
  confirmsExpectedOperating: true as const,
  confirmsNotPrivateResidence: true as const,
  confirmsNoPrivateLocationDisclosure: true as const,
};

const sessions = [1, 2, 3].map((position) => ({
  series_public_id: "series-123",
  cadence: "weekly" as const,
  public_slug: `event-${position}`,
  title: "Belajar",
  starts_at: `2026-11-${String(position).padStart(2, "0")}T03:00:00.000Z`,
  ends_at: `2026-11-${String(position).padStart(2, "0")}T05:00:00.000Z`,
  status: "scheduled" as const,
  series_position: position,
}));

test("current scope only changes the selected meeting", () => {
  const plan = planEventSeriesUpdates({
    sessions,
    targetSlug: "event-2",
    scope: "current",
    update,
    now: new Date("2026-10-01T00:00:00Z"),
  });
  assert.equal(plan.length, 1);
  assert.equal(plan[0]?.publicSlug, "event-2");
});

test("following scope changes the selected and later meetings", () => {
  const plan = planEventSeriesUpdates({
    sessions,
    targetSlug: "event-2",
    scope: "following",
    update,
    now: new Date("2026-10-01T00:00:00Z"),
  });
  assert.deepEqual(plan.map((item) => item.publicSlug), ["event-2", "event-3"]);
  assert.equal(plan[1]?.update.endsAtLocal > plan[1]?.update.startsAtLocal, true);
});

test("past or imminent meetings are skipped", () => {
  const plan = planEventSeriesUpdates({
    sessions,
    targetSlug: "event-2",
    scope: "all",
    update,
    now: new Date("2026-11-02T03:00:00Z"),
  });
  assert.deepEqual(plan.map((item) => item.publicSlug), ["event-3"]);
});
