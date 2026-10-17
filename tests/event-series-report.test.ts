import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const pageUrl = new URL(
  "../app/app/events/[publicSlug]/manage/report/page.tsx",
  import.meta.url,
);

test("series report stays behind the database readiness flag", async () => {
  const source = await readFile(pageUrl, "utf8");
  assert.match(source, /EVENT_SERIES_ENABLED === "true"/);
  assert.match(source, /listCampusEventSeriesSessions/);
});

test("series report uses plain student-facing labels", async () => {
  const source = await readFile(pageUrl, "utf8");
  for (const label of [
    "Ringkasan semua pertemuan",
    "Pertemuan",
    "Pendaftaran",
    "Diterima",
    "Sudah hadir",
  ]) {
    assert.ok(source.includes(label), `missing label: ${label}`);
  }
  assert.doesNotMatch(source, />\s*(scope|aggregate|series_position|RPC)\s*</i);
});

test("series report keeps participant identity private", async () => {
  const source = await readFile(pageUrl, "utf8");
  assert.match(source, /Data pribadi peserta tetap tidak ditampilkan/);
  assert.doesNotMatch(source, /participant_email|phone_number|full_name/);
});
