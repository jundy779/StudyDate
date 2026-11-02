import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/202611020001_realtime_user_event_signals_v1.sql");
const channel = read("components/realtime/private-channel.ts");
const userSignals = read("components/realtime/use-user-signals.ts");
const staffLive = read("components/realtime/event-staff-live.tsx");
const refresh = read("components/realtime/signal-refresh.tsx");
const bell = read("components/notifications/notification-bell.tsx");
const shell = read("components/events/event-management-shell.tsx");
const detail = read("app/app/events/[publicSlug]/page.tsx");

test("user topics use a random key, never the account id", () => {
  assert.match(migration, /topic_key text not null unique default encode\(extensions\.gen_random_bytes\(16\), 'hex'\)/);
  assert.match(migration, /revoke all on table public\.user_realtime_topics from public, anon, authenticated/);
  assert.match(migration, /return 'user:' \|\| key;/);
  assert.doesNotMatch(migration, /'user:' \|\| new\.recipient_user_id/);
});

test("only the owner of a topic or event staff can receive, and nobody can send from the browser", () => {
  assert.match(migration, /topic\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /event_can_check_in\(event_row\.id, \(select auth\.uid\(\)\)\)/);
  assert.match(migration, /event_can_manage_registrations\(event_row\.id, \(select auth\.uid\(\)\)\)/);
  assert.equal((migration.match(/for select/g) ?? []).length, 2);
  assert.doesNotMatch(migration, /for insert/);
});

test("signals carry no personal data and never block the durable write", () => {
  assert.match(migration, /jsonb_build_object\('type', new\.notification_type\)/);
  assert.match(migration, /'registration_changed'/);
  assert.equal((migration.match(/when others then/g) ?? []).length, 2);
  assert.doesNotMatch(migration, /new\.metadata|new\.target_path|registration_answers'/);
  assert.match(migration, /new\.status is not distinct from old\.status\s+and new\.checked_in_at is not distinct from old\.checked_in_at/);
});

test("client subscribes to private channels and keeps polling as a slower fallback", () => {
  assert.match(channel, /private: true/);
  assert.match(channel, /\^user:\[0-9a-f\]\{32\}\$/);
  assert.match(userSignals, /events: \["notification"\]/);
  assert.match(bell, /live \? LIVE_POLL_INTERVAL_MS : POLL_INTERVAL_MS/);
  assert.match(bell, /const LIVE_POLL_INTERVAL_MS = 180_000;/);
  assert.match(refresh, /if \(document\.hidden\)/);
  assert.match(staffLive, /topic: `event-staff:\$\{publicSlug\}`/);
  assert.match(shell, /<EventStaffLive publicSlug=\{event\.public_slug\} \/>/);
  assert.match(detail, /<SignalRefresh types=\{EVENT_DETAIL_SIGNAL_TYPES\} \/>/);
});
