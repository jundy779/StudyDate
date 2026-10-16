import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const migration = read("supabase/migrations/202610160001_event_blast_v1.sql");
const manage = read("app/app/events/[publicSlug]/manage/page.tsx");
const detail = read("app/app/events/[publicSlug]/page.tsx");
const actions = read("app/app/events/actions.ts");
const service = read("lib/events/service.ts");
const validation = read("lib/events/validation.ts");
const notifications = read("lib/notifications/constants.ts");

test("event blast storage is private and permission-gated", () => {
  assert.match(migration, /create table public\.campus_event_announcements/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.campus_event_announcements/);
  assert.match(migration, /event_can_manage_registrations\(event_row\.id, actor\)/);
  assert.match(migration, /rsvp\.status = 'going'/);
  assert.doesNotMatch(migration, /grant (select|insert|update|delete).*campus_event_announcements/i);
});

test("event blast delivery is bounded, deduplicated, and preference-aware", () => {
  assert.match(migration, /client_idempotency_key/);
  assert.match(migration, /announcement_day', 5, 86400/);
  assert.match(migration, /on conflict \(dedupe_key\) do nothing/);
  assert.match(migration, /EVENT_ANNOUNCEMENT/);
  assert.match(migration, /not preference\.in_app_enabled/);
  assert.match(migration, /recipient_count/);
});

test("event blast input is validated again on the server", () => {
  assert.match(validation, /eventAnnouncementSchema/);
  assert.match(validation, /EVENT_ANNOUNCEMENT_TITLE_MAX/);
  assert.match(validation, /EVENT_ANNOUNCEMENT_BODY_MAX/);
  assert.match(actions, /eventAnnouncementSchema\.safeParse/);
  assert.match(actions, /createCampusEventAnnouncement/);
  assert.match(service, /create_campus_event_announcement/);
});

test("event blast UI is fail-closed behind a server flag", () => {
  assert.match(manage, /process\.env\.EVENT_BLAST_ENABLED === "true"/);
  assert.match(detail, /process\.env\.EVENT_BLAST_ENABLED === "true"/);
  assert.match(manage, /Kirim kabar ke peserta/);
  assert.match(detail, /Kabar dari penyelenggara/);
  assert.match(notifications, /EVENT_ANNOUNCEMENT/);
  assert.doesNotMatch(manage, /NEXT_PUBLIC_EVENT_BLAST/);
  assert.doesNotMatch(detail, /NEXT_PUBLIC_EVENT_BLAST/);
});
