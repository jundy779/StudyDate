import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const publicService = read("lib/events/public-service.ts");
const publicList = read("app/(public-docs)/events/page.tsx");
const publicDetail = read("app/(public-docs)/events/[publicSlug]/page.tsx");
const adminEvents = read("app/admin/events/page.tsx");
const staffService = read("lib/events/staff-service.ts");
const navigation = read("components/navigation/responsive-navigation.tsx");
const calendar = read("lib/events/calendar.ts");
const calendarRoute = read(
  "app/(public-docs)/events/[publicSlug]/calendar.ics/route.ts",
);
const publicActions = read("components/events/public-event-actions.tsx");
const publicCard = read("components/events/public-event-card.tsx");
const publicEventList = read("components/events/public-event-list.tsx");
const savedEventButton = read("components/events/saved-event-button.tsx");
const savedEvents = read("lib/events/saved-events.ts");

test("PUBE-01 public discovery exposes only official open scheduled events", () => {
  assert.match(publicService, /\.eq\("status", "scheduled"\)/);
  assert.match(publicService, /\.eq\("scope", "open"\)/);
  assert.match(publicService, /\.eq\("is_official", true\)/);
  assert.match(publicService, /\.gt\("starts_at"/);
  assert.match(publicService, /import "server-only"/);
  assert.match(publicService, /registration_open/);
  assert.doesNotMatch(publicDetail, /Date\.now\(\)/);
  assert.doesNotMatch(publicService, /NEXT_PUBLIC_.*SERVICE|serviceRoleKey|SUPABASE_SERVICE_ROLE_KEY/);
});

test("PUBE-02 public pages keep registration and participant data behind login", () => {
  assert.match(publicList, /Detail acara dapat dibaca tanpa harus masuk/);
  assert.match(publicDetail, /Masuk untuk mendaftar/);
  assert.match(publicDetail, /Daftar peserta tetap privat/);
  assert.match(publicDetail, /href="\/login"/);
  assert.doesNotMatch(publicDetail, /campus_event_rsvps|user_id|email|nomor|kontak pribadi/i);
});

test("PUBE-03 event navigation is available to public visitors and admins", () => {
  assert.match(navigation, /href: "\/admin\/events"/);
  assert.match(adminEvents, /await requireActiveStaff\(\)/);
  assert.match(adminEvents, /current="events"/);
  assert.match(adminEvents, /Penandaan acara resmi tetap menjadi keputusan Owner/);
});

test("PUBE-04 staff listing stays server-only and contains no attendee identities", () => {
  assert.match(staffService, /import "server-only"/);
  assert.match(staffService, /select\("event_id"\)/);
  assert.doesNotMatch(staffService, /legal_name|email|nim|phone|contact/);
});

test("PUBE-05 public detail supports calendar export and safe sharing", () => {
  assert.match(publicDetail, /PublicEventActions/);
  assert.match(publicDetail, /calendar\.ics/);
  assert.match(calendar, /BEGIN:VCALENDAR/);
  assert.match(calendar, /BEGIN:VEVENT/);
  assert.match(calendar, /calendar\.google\.com\/calendar\/render/);
  assert.match(calendarRoute, /text\/calendar; charset=utf-8/);
  assert.match(calendarRoute, /getPublicCampusEvent/);
  assert.doesNotMatch(calendarRoute, /force-dynamic/);
  assert.match(publicActions, /navigator\.share/);
  assert.match(publicActions, /navigator\.clipboard/);
  assert.match(publicActions, /aria-live="polite"/);
});


test("PUBE-06 visitors can save events locally and revisit the saved list", () => {
  assert.match(publicList, /saved=1/);
  assert.match(publicList, /Tersimpan/);
  assert.match(publicEventList, /useSyncExternalStore/);
  assert.match(publicEventList, /Belum ada acara yang kamu simpan/);
  assert.match(publicCard, /SavedEventButton/);
  assert.match(publicActions, /SavedEventButton/);
  assert.match(savedEventButton, /aria-pressed/);
  assert.match(savedEventButton, /SAVED_EVENTS_CHANGED_EVENT/);
  assert.match(read("lib/events/saved-events.ts"), /studydate:saved-events-changed/);
  assert.match(savedEvents, /studydate:saved-events:v1/);
  assert.match(savedEvents, /MAX_SAVED_EVENTS = 100/);
  assert.doesNotMatch(savedEvents, /supabase|fetch\(/i);
});
