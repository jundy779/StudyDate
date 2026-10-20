import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  NOTIFICATION_PREFERENCE_LABELS,
  NOTIFICATION_TYPES,
} from "../lib/notifications/constants.ts";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const migration = read("supabase/migrations/202610210002_circle_calendar_v1.sql");

function returnsTable(name: string) {
  return (
    migration.match(
      new RegExp(`function public\\.${name}\\([\\s\\S]*?returns table \\(([\\s\\S]*?)\\)\\s*\\nlanguage`),
    )?.[1] ?? ""
  );
}

test("calendar projections never expose follower identities", () => {
  for (const name of [
    "get_study_circle_calendar",
    "list_study_circle_calendar_events",
    "list_my_followed_calendar_events",
  ]) {
    const projection = returnsTable(name);
    assert.ok(projection, name);
    assert.doesNotMatch(projection, /\b(user_id|alias|email|first_name|photo|organizer)\b/i, name);
  }
  assert.match(migration, /revoke all on table public\.study_circle_calendar_follows\s+from public, anon, authenticated/);
});

test("following respects circle visibility, blocks, ownership, and rate limits", () => {
  assert.match(migration, /function public\.can_view_study_circle[\s\S]*?users_are_blocked/);
  assert.match(migration, /target\.owner_user_id = actor[\s\S]*?not public\.can_view_study_circle/);
  assert.match(migration, /consume_campus_event_rate_limit\(actor, 'calendar_follow', 30, 3600\)/);
  assert.match(migration, /function public\.can_view_listed_campus_event[\s\S]*?is_educational_event_category/);
});

test("follower notifications respect preferences and visibility", () => {
  const trigger = migration.slice(migration.indexOf("function public.notify_circle_calendar_followers"));
  assert.match(trigger, /'CIRCLE_EVENT_PUBLISHED'/);
  assert.match(trigger, /follow\.user_id <> event_row\.organizer_user_id/);
  assert.match(trigger, /can_view_listed_campus_event\(event_row\.id, follow\.user_id\)/);
  assert.match(trigger, /preference\.notification_type = 'CIRCLE_EVENT_PUBLISHED'/);
  assert.match(trigger, /on conflict \(dedupe_key\) do nothing/);
});

test("event announcements can actually be sent", () => {
  assert.match(migration, /'checkin_mutation_minute', 'announcement_day', 'calendar_follow'/);
  assert.match(migration, /\(#\[a-z\]\[a-z0-9-\]\{0,39\}\)\?\$/);
  assert.match(migration, /set recipient_count = greatest\(announcement\.recipient_count, inserted_count\)/);
});

test("notification types stay in sync with the database and have readable labels", () => {
  // Bandingkan dengan migration terakhir yang mendefinisikan ulang daftar jenis notifikasi.
  const latestTypeMigration = readdirSync(join(process.cwd(), "supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => read(`supabase/migrations/${name}`))
    .filter((sql) => /add constraint user_notifications_type_allowed/.test(sql))
    .at(-1) ?? "";
  for (const type of NOTIFICATION_TYPES) {
    assert.match(latestTypeMigration, new RegExp(`'${type}'`), type);
    assert.ok(NOTIFICATION_PREFERENCE_LABELS[type], type);
    assert.doesNotMatch(NOTIFICATION_PREFERENCE_LABELS[type], /_/);
  }
  assert.doesNotMatch(read("app/app/settings/page.tsx"), /replaceAll\("_", " "\)/);
});

test("calendar UI explains that following is not membership", () => {
  const ui = read("components/circles/circle-calendar.tsx");
  assert.match(ui, /Daftar pengikut tidak\s+ditampilkan/);
  assert.match(ui, /tidak\s+sama dengan bergabung ke Circle/);
});
