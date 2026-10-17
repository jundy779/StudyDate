import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../supabase/migrations/202610170002_event_series_v2.sql",
  import.meta.url,
);

test("event series migration is private by default", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table public\.campus_event_series from public, anon, authenticated/i);
  assert.match(sql, /revoke all on function public\.attach_campus_event_series/i);
  assert.match(sql, /grant execute on function public\.attach_campus_event_series\(text\[\], text\)\s+to authenticated/i);
});

test("event series enforces bounded and unique positions", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /series_position between 1 and 12/i);
  assert.match(sql, /unique\s+on public\.campus_events \(series_id, series_position\)/i);
  assert.match(sql, /not between 2 and 12/i);
});

test("series listing requires event management access", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /public\.event_can_manage_registrations\(target\.id, actor\)/i);
});
