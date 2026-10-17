import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEventSeriesInputs,
  parseEventSeriesCount,
} from "../lib/events/duplication.ts";

const base = {
  startsAtLocal: "2026-01-31T09:00",
  endsAtLocal: "2026-01-31T11:00",
  registrationClosesAt: "2026-01-30T20:00",
  title: "Belajar bareng",
};

test("series count is bounded between one and twelve", () => {
  assert.equal(parseEventSeriesCount("0"), 1);
  assert.equal(parseEventSeriesCount("6"), 6);
  assert.equal(parseEventSeriesCount("99"), 12);
  assert.equal(parseEventSeriesCount("nope"), 1);
});

test("weekly series keeps the local clock and duration", () => {
  const rows = buildEventSeriesInputs(base, "weekly", 3);
  assert.deepEqual(
    rows.map((row) => row.startsAtLocal),
    ["2026-01-31T09:00", "2026-02-07T09:00", "2026-02-14T09:00"],
  );
  assert.equal(rows[2]?.endsAtLocal, "2026-02-14T11:00");
  assert.equal(rows[1]?.registrationClosesAt, "2026-02-06T20:00");
});

test("monthly series clamps dates at the end of shorter months", () => {
  const rows = buildEventSeriesInputs(base, "monthly", 3);
  assert.deepEqual(
    rows.map((row) => row.startsAtLocal),
    ["2026-01-31T09:00", "2026-02-28T09:00", "2026-03-31T09:00"],
  );
});
