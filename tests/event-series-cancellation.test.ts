import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../supabase/migrations/202610170003_event_series_cancellation.sql",
  import.meta.url,
);

test("series cancellation only supports clear bounded choices", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /p_scope not in \('following', 'all'\)/i);
  assert.match(sql, /event\.starts_at > timezone\('utc', now\(\)\)/i);
  assert.match(sql, /event\.series_position >= target\.series_position/i);
});

test("series cancellation requires management permission", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /event_can_manage_registrations\(target\.id, actor\)/i);
  assert.match(sql, /revoke all on function public\.cancel_campus_event_series_sessions/i);
  assert.match(sql, /grant execute on function public\.cancel_campus_event_series_sessions\(text, text\)\s+to authenticated/i);
});

test("series cancellation reuses the audited single-event flow", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /public\.cancel_campus_event\(candidate\.public_slug\)/i);
});
