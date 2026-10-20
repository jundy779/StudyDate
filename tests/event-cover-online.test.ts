import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  EVENT_ONLINE_VENUE_AREA,
  eventCoverUrl,
  eventPlaceLine,
  isAllowedMeetingUrl,
  meetingPlatformLabel,
  parseAttendanceMode,
} from "../lib/events/online.ts";
import {
  eventFormSchema,
  eventOnlineLinkSchema,
  eventUpdateSchema,
} from "../lib/events/validation.ts";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const migration = read("supabase/migrations/202610210003_event_cover_online_v1.sql");

const physicalEvent = {
  title: "Belajar bareng statistika",
  description: "Belajar bareng statistika dasar untuk ujian tengah semester.",
  category: "study_together",
  scope: "open",
  startsAtLocal: "2026-11-10T09:00",
  endsAtLocal: "2026-11-10T11:00",
  timezone: "Asia/Jakarta",
  venueCategory: "library",
  venueName: "Perpustakaan Pusat",
  venueArea: "Lantai satu, area baca umum",
  city: "Jakarta",
  capacity: 12,
  registrationMode: "instant",
  waitlistEnabled: false,
  registrationClosesAt: undefined,
  confirmsPublicPlace: true,
  confirmsExpectedOperating: true,
  confirmsNotPrivateResidence: true,
  confirmsNoPrivateLocationDisclosure: true,
};

const onlineEvent = {
  ...physicalEvent,
  venueCategory: "online",
  venueName: "Zoom",
  venueArea: EVENT_ONLINE_VENUE_AREA,
  city: "Online",
  confirmsPublicPlace: false,
  confirmsExpectedOperating: false,
  confirmsNotPrivateResidence: false,
  confirmsNoPrivateLocationDisclosure: false,
};

test("link rapat hanya dari platform yang diizinkan dan wajib https", () => {
  for (const url of [
    "https://meet.google.com/abc-defg-hij",
    "https://us02web.zoom.us/j/123456789?pwd=abc",
    "https://zoom.us/j/123456789",
    "https://teams.microsoft.com/l/meetup-join/abc",
    "https://www.youtube.com/live/abcdef",
    "https://kampus.webex.com/meet/abc",
    "https://meet.jit.si/StudyDateBelajar",
  ]) {
    assert.equal(isAllowedMeetingUrl(url), true, url);
  }
  for (const url of [
    "http://meet.google.com/abc-defg-hij",
    "https://evil.example.com/meet.google.com",
    "https://meet.google.com.evil.example/abc",
    "https://user@meet.google.com/abc",
    "javascript:alert(1)",
    "https://zoom.us/j/1 2",
    "https://zoomus",
    "",
  ]) {
    assert.equal(isAllowedMeetingUrl(url), false, url);
  }
  assert.equal(meetingPlatformLabel("https://us02web.zoom.us/j/1"), "Zoom");
  assert.equal(meetingPlatformLabel("https://meet.google.com/x"), "Google Meet");
});

test("daftar host di TypeScript sama dengan fungsi database", () => {
  for (const host of [
    "zoom.us",
    "meet.google.com",
    "teams.microsoft.com",
    "teams.live.com",
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
    "webex.com",
    "meet.jit.si",
  ]) {
    assert.match(migration, new RegExp(`'${host.replace(/\./g, "\\.")}'`));
  }
  assert.match(migration, /\(zoom\\\.us\|webex\\\.com\)/);
});

test("acara online tidak butuh konfirmasi tempat, acara fisik tetap wajib", () => {
  assert.equal(eventFormSchema.safeParse(onlineEvent).success, true);
  const { scope: _scope, ...onlineUpdate } = onlineEvent;
  void _scope;
  assert.equal(eventUpdateSchema.safeParse(onlineUpdate).success, true);
  assert.equal(eventFormSchema.safeParse(physicalEvent).success, true);
  const unconfirmed = eventFormSchema.safeParse({
    ...physicalEvent,
    confirmsNotPrivateResidence: false,
  });
  assert.equal(unconfirmed.success, false);
});

test("mode online dan hybrid wajib punya link yang valid", () => {
  assert.equal(
    eventOnlineLinkSchema.safeParse({ attendanceMode: "offline", onlineUrl: "" }).success,
    true,
  );
  assert.equal(
    eventOnlineLinkSchema.safeParse({ attendanceMode: "online", onlineUrl: "" }).success,
    false,
  );
  assert.equal(
    eventOnlineLinkSchema.safeParse({
      attendanceMode: "hybrid",
      onlineUrl: "https://evil.example.com/x",
    }).success,
    false,
  );
  assert.equal(
    eventOnlineLinkSchema.safeParse({
      attendanceMode: "hybrid",
      onlineUrl: "https://meet.google.com/abc-defg-hij",
    }).success,
    true,
  );
  assert.equal(parseAttendanceMode("bukan-mode"), "offline");
});

test("kartu acara tidak pernah memuat link, hanya keterangan", () => {
  assert.equal(
    eventPlaceLine({ venue_category: "online", venue_name: "Zoom", city: "Online" }),
    "Online lewat Zoom",
  );
  assert.equal(
    eventPlaceLine({
      venue_name: "Zoom",
      venue_area: EVENT_ONLINE_VENUE_AREA,
      city: "Online",
    }),
    "Online lewat Zoom",
  );
  assert.equal(
    eventPlaceLine({
      venue_category: "library",
      venue_name: "Perpustakaan",
      city: "Depok",
      attendance_mode: "hybrid",
    }),
    "Perpustakaan, Depok · bisa online",
  );
});

test("URL sampul hanya dibuat dari path yang formatnya benar", () => {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co/";
  try {
    assert.equal(
      eventCoverUrl("0123456789abcdef01234567/0123456789abcdef0123456789abcdef.webp"),
      "https://abc.supabase.co/storage/v1/object/public/event-covers/0123456789abcdef01234567/0123456789abcdef0123456789abcdef.webp",
    );
    assert.equal(eventCoverUrl("../secret.webp"), null);
    assert.equal(eventCoverUrl("0123456789abcdef01234567/x.png"), null);
    assert.equal(eventCoverUrl(null), null);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
  }
});

test("link online tersimpan privat dan hanya dibuka untuk peserta terdaftar", () => {
  assert.match(
    migration,
    /revoke all on table public\.campus_event_online_links from public, anon, authenticated/,
  );
  const getter = migration.match(
    /create or replace function public\.get_campus_event_online_link[\s\S]*?\$\$;/,
  )?.[0];
  assert.ok(getter);
  assert.match(getter, /rsvp\.status = 'going'/);
  assert.match(getter, /case when allowed and event_row\.status = 'scheduled' then link_row\.meeting_url else null end/);
  const setter = migration.match(
    /create or replace function public\.set_campus_event_online_link[\s\S]*?\$\$;/,
  )?.[0];
  assert.ok(setter);
  assert.match(setter, /can_manage_campus_event_content/);
  assert.match(setter, /campus_event_meeting_url_allowed/);
});

test("tempat fisik tetap wajib konfirmasi di database, online tidak", () => {
  for (const name of ["create_campus_event", "update_campus_event"]) {
    const fn = migration.match(
      new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`),
    )?.[0];
    assert.ok(fn, name);
    assert.match(fn, /p_venue_category <> 'online'/);
    assert.match(fn, /'online'/);
  }
});

test("sampul ditulis server saja, path terikat ke acara, bucket hanya WebP", () => {
  assert.match(migration, /values \('event-covers', 'event-covers', true, 2097152, array\['image\/webp'\]\)/);
  assert.match(migration, /split_part\(p_cover_path, '\/', 1\) <> substring\(event_row\.public_slug from 7\)/);
  assert.doesNotMatch(migration, /create policy[\s\S]*event-covers/);
  const route = read("app/api/events/[publicSlug]/cover/route.ts");
  assert.match(route, /processEventCover/);
  assert.match(route, /remove\(\[processed\.path\]\)/);
  const cover = read("lib/events/cover.ts");
  assert.match(cover, /\.webp\(/);
  assert.match(cover, /output\.exif/);
});

test("halaman publik dan sitemap tidak pernah membaca link rapat", () => {
  const publicService = read("lib/events/public-service.ts");
  assert.doesNotMatch(publicService, /meeting_url/);
  assert.match(publicService, /select\("event_id"\)/);
  for (const path of [
    "app/(public-docs)/events/[publicSlug]/page.tsx",
    "app/(public-docs)/events/[publicSlug]/opengraph-image.tsx",
    "app/(public-docs)/events/[publicSlug]/calendar.ics/route.ts",
    "app/sitemap.ts",
  ]) {
    assert.doesNotMatch(read(path), /meeting_url|meetingUrl|get_campus_event_online_link/, path);
  }
});
