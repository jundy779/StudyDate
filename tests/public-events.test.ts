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

test("PUBE-01 public discovery exposes only official open scheduled events", () => {
  assert.match(publicService, /\.eq\("status", "scheduled"\)/);
  assert.match(publicService, /\.eq\("scope", "open"\)/);
  assert.match(publicService, /\.eq\("is_official", true\)/);
  assert.match(publicService, /\.gt\("starts_at"/);
  assert.match(publicService, /import "server-only"/);
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
