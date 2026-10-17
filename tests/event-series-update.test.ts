import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const actionUrl = new URL("../app/app/events/actions.ts", import.meta.url);
const formUrl = new URL("../components/events/event-form.tsx", import.meta.url);

test("series update offers clear choices for ordinary users", async () => {
  const source = await readFile(formUrl, "utf8");
  for (const label of [
    "Pertemuan ini saja",
    "Pertemuan ini dan setelahnya",
    "Semua pertemuan yang akan datang",
  ]) {
    assert.ok(source.includes(label), `missing label: ${label}`);
  }
});

test("series update never changes finished or imminent sessions", async () => {
  const source = await readFile(actionUrl, "utf8");
  assert.match(source, /session\.status !== "scheduled"/);
  assert.match(source, /Date\.now\(\) \+ 2 \* 60 \* 60 \* 1000/);
});

test("series update preserves spacing and reports partial progress", async () => {
  const source = await readFile(actionUrl, "utf8");
  assert.match(source, /startShift/);
  assert.match(source, /shiftedLocalTimestamp/);
  assert.match(source, /updatedCount[^?]+pertemuan berhasil diubah/s);
});
