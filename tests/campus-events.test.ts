import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { CampusEventBehaviorModel } from "../lib/events/behavior-model.ts";
import {
  eventFiltersSchema,
  eventFormSchema,
  eventReportSchema,
  eventSlugSchema,
  eventUpdateSchema,
} from "../lib/events/validation.ts";

const root = process.cwd();
const baseSql = readFileSync(
  join(root, "supabase/migrations/202608090003_create_campus_events_v1.sql"),
  "utf8",
);
const detailFixSql = readFileSync(
  join(
    root,
    "supabase/migrations/202608090004_fix_campus_event_detail_projection.sql",
  ),
  "utf8",
);
const sql = `${baseSql}\n${detailFixSql}`;
const service = readFileSync(join(root, "lib/events/service.ts"), "utf8");
const packageJson = readFileSync(join(root, "package.json"), "utf8");
const NOW = Date.UTC(2026, 7, 9, 0, 0);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const A = "a";
const B = "b";
const C = "c";
const D = "d";

function seed() {
  const model = new CampusEventBehaviorModel(NOW);
  model.addUser({ id: A, alias: "Partner #100001", campus: "Kampus A" });
  model.addUser({
    id: B,
    alias: "Partner #100002",
    campus: "Kampus A",
    verified: true,
  });
  model.addUser({ id: C, alias: "Partner #100003", campus: "Kampus B" });
  model.addUser({ id: D, alias: "Partner #100004", campus: "Kampus A" });
  return model;
}

function create(model = seed(), overrides = {}) {
  const slug = model.create(A, {
    title: "Belajar Bareng",
    description: "Belajar bersama di tempat umum kampus yang nyaman.",
    scope: "open",
    startsAt: NOW + 3 * HOUR,
    endsAt: NOW + 5 * HOUR,
    capacity: 3,
    ...overrides,
  });
  return { model, slug };
}

const validForm = {
  title: "Belajar Bareng",
  description: "Belajar bersama di perpustakaan kampus yang terbuka.",
  category: "study_together",
  scope: "open",
  startsAtLocal: "2026-08-10T09:00",
  endsAtLocal: "2026-08-10T11:00",
  timezone: "Asia/Jakarta",
  venueCategory: "library",
  venueName: "Perpustakaan Pusat",
  venueArea: "Lantai satu, area baca umum",
  city: "Jakarta",
  capacity: 12,
  registrationMode: "instant",
  waitlistEnabled: true,
  registrationClosesAt: undefined,
  confirmsPublicPlace: true,
  confirmsExpectedOperating: true,
  confirmsNotPrivateResidence: true,
  confirmsNoPrivateLocationDisclosure: true,
} as const;

test("CE-01 hanya mahasiswa onboarded non-staff yang eligible", () => {
  const eligibility = sql.match(
    /create or replace function public\.is_campus_event_student[\s\S]*?\$\$;/,
  )?.[0];
  assert.ok(eligibility);
  assert.match(eligibility, /is_eligible_introduction_student\(p_user_id\)/);
  assert.doesNotMatch(eligibility, /verification_status/);
});
test("CE-02 organizer selalu berasal dari auth.uid", () => {
  const { model } = create();
  assert.throws(
    () =>
      model.create(B, {
        organizerId: A,
        title: "Event Aman",
        scope: "open",
        startsAt: NOW + 3 * HOUR,
        endsAt: NOW + 4 * HOUR,
      }),
    /derived/,
  );
  assert.doesNotMatch(sql, /p_organizer_user_id/);
});
test("CE-03 creator otomatis RSVP going dan menghitung kapasitas", () => {
  const { model, slug } = create();
  assert.equal(model.detail(A, slug).attendeeCount, 1);
});
test("CE-04 organizer tidak dapat membatalkan RSVP sendiri", () => {
  const { model, slug } = create();
  assert.throws(() => model.cancelRsvp(A, slug), /organizer rsvp/);
});
test("CE-05 slug event opaque 24 hex", () => {
  assert.equal(eventSlugSchema.safeParse(`event-${"a".repeat(24)}`).success, true);
  assert.match(sql, /\^event-\[0-9a-f\]\{24\}\$/);
});
test("CE-06 judul/deskripsi strict plain text", () => {
  assert.equal(eventFormSchema.safeParse(validForm).success, true);
  assert.equal(
    eventFormSchema.safeParse({ ...validForm, title: "<b>Event</b>" }).success,
    false,
  );
});
test("CE-07 kategori dibatasi allowlist", () => {
  assert.equal(
    eventFormSchema.safeParse({ ...validForm, category: "party" }).success,
    false,
  );
});
test("CE-08 scope hanya open atau campus", () => {
  assert.equal(
    eventFormSchema.safeParse({ ...validForm, scope: "private" }).success,
    false,
  );
});
test("CE-09 campus scope diturunkan server dan tidak diedit", () => {
  assert.match(sql, /case when p_scope = 'campus' then actor_campus else null end/);
  assert.equal("scope" in eventUpdateSchema.shape, false);
});
test("CE-10 zona waktu hanya tiga zona Indonesia", () => {
  assert.equal(
    eventFormSchema.safeParse({ ...validForm, timezone: "UTC" }).success,
    false,
  );
  assert.match(sql, /at time zone p_timezone_name/);
});
test("CE-11 start harus sebelum end", () => {
  assert.equal(
    eventFormSchema.safeParse({
      ...validForm,
      startsAtLocal: "2026-08-10T11:00",
      endsAtLocal: "2026-08-10T09:00",
    }).success,
    false,
  );
});
test("CE-12 durasi minimum 30 menit", () => {
  const model = seed();
  assert.throws(
    () =>
      model.create(A, {
        title: "Event",
        scope: "open",
        startsAt: NOW + 3 * HOUR,
        endsAt: NOW + 3 * HOUR + 29 * 60_000,
      }),
    /duration/,
  );
});
test("CE-13 durasi maksimum 12 jam", () => {
  const model = seed();
  assert.throws(
    () =>
      model.create(A, {
        title: "Event",
        scope: "open",
        startsAt: NOW + 3 * HOUR,
        endsAt: NOW + 16 * HOUR,
      }),
    /duration/,
  );
});
test("CE-14 event minimal dua jam ke depan", () => {
  const model = seed();
  assert.throws(
    () =>
      model.create(A, {
        title: "Event",
        scope: "open",
        startsAt: NOW + HOUR,
        endsAt: NOW + 2 * HOUR,
      }),
    /too soon/,
  );
});
test("CE-15 event maksimal 180 hari", () => {
  const model = seed();
  assert.throws(
    () =>
      model.create(A, {
        title: "Event",
        scope: "open",
        startsAt: NOW + 181 * DAY,
        endsAt: NOW + 181 * DAY + HOUR,
      }),
    /too far/,
  );
});
test("CE-16 status lampau diturunkan tanpa enum completed", () => {
  assert.match(sql, /target\.ends_at <= timezone\('utc', now\(\)\)/);
  assert.doesNotMatch(sql, /status in \([^)]*completed/);
});
test("CE-17 kategori venue dibatasi lokasi publik", () => {
  assert.equal(
    eventFormSchema.safeParse({ ...validForm, venueCategory: "home" }).success,
    false,
  );
});
test("CE-18 field venue memiliki batas panjang", () => {
  assert.equal(
    eventFormSchema.safeParse({ ...validForm, venueArea: "pendek" }).success,
    false,
  );
});
test("CE-19 empat konfirmasi safety wajib true", () => {
  assert.equal(
    eventFormSchema.safeParse({
      ...validForm,
      confirmsNotPrivateResidence: false,
    }).success,
    false,
  );
});
test("CE-20 hanya safety_confirmed_at yang disimpan", () => {
  const table = sql.match(/create table public\.campus_events[\s\S]*?\n\);/)?.[0];
  assert.ok(table);
  assert.match(table, /safety_confirmed_at/);
  assert.doesNotMatch(table, /confirms_public_place/);
});
test("CE-21 detector menolak kos dan rumah pribadi", () => {
  assert.match(sql, /kos\|kamar kos\|rumah pribadi/);
});
test("CE-22 detector membolehkan area publik hotel tanpa membolehkan kamar", () => {
  const detector = sql.match(
    /create or replace function public\.campus_event_has_private_venue[\s\S]*?\$\$;/,
  )?.[0];
  assert.ok(detector);
  assert.match(detector, /kamar hotel\|hotel room/);
  assert.doesNotMatch(detector, /\\mhotel\\M/);
});
test("CE-23 kapasitas hanya 3 sampai 200", () => {
  assert.equal(eventFormSchema.safeParse({ ...validForm, capacity: 2 }).success, false);
  assert.equal(eventFormSchema.safeParse({ ...validForm, capacity: 201 }).success, false);
});
test("CE-24 organizer maksimal lima event upcoming aktif", () => {
  assert.match(sql, /active_owned >= 5/);
});
test("CE-25 user maksimal sepuluh RSVP upcoming aktif", () => {
  assert.match(sql, /active_rsvps >= 10/);
});
test("CE-26 create dibatasi tiga per hari", () => {
  assert.match(sql, /'create_day', 3, 86400/);
});
test("CE-27 RSVP dan cancel berbagi limit 30 per hari", () => {
  assert.equal((sql.match(/'rsvp_day', 30, 86400/g) ?? []).length >= 2, true);
});
test("CE-28 edit dibatasi 20 per hari", () => {
  assert.match(sql, /'edit_day', 20, 86400/);
});
test("CE-29 laporan dibatasi tiga per jam dan sepuluh per hari", () => {
  assert.match(sql, /'report_hour', 3, 3600/);
  assert.match(sql, /'report_day', 10, 86400/);
});
test("CE-30 RSVP mengunci event sebelum hitung kapasitas", () => {
  const fn = sql.match(
    /create or replace function public\.rsvp_campus_event[\s\S]*?create or replace function public\.cancel_campus_event_rsvp/,
  )?.[0];
  assert.ok(fn);
  assert.match(fn, /where event\.public_slug = p_public_slug for update/);
  assert.ok(
    fn.indexOf("for update") <
      fn.indexOf("select count(*)::integer into going_count"),
  );
});
test("CE-31 dua attempt bersamaan pada final slot hanya menerima satu peserta", async () => {
  const { model, slug } = create();
  model.rsvp(B, slug);
  const accepted = await model.concurrentFinalSlotAttempts(slug, [C, D]);
  assert.equal(accepted.length, 1);
  assert.equal(model.detail(A, slug).attendeeCount, 3);
});
test("CE-32 duplicate going idempotent", () => {
  const { model, slug } = create();
  assert.equal(model.rsvp(B, slug), true);
  assert.equal(model.rsvp(B, slug), false);
});
test("CE-33 RSVP cancelled dapat aktif kembali", () => {
  const { model, slug } = create();
  model.rsvp(B, slug);
  model.cancelRsvp(B, slug);
  assert.equal(model.rsvp(B, slug), true);
});
test("CE-34 cancel RSVP hanya row milik actor", () => {
  assert.match(sql, /where event_id = target\.id and user_id = actor and status = 'going'/);
});
test("CE-35 cancel RSVP tidak menghapus evidence", () => {
  assert.doesNotMatch(sql, /delete from public\.campus_event_rsvps/);
});
test("CE-36 discovery hanya scheduled upcoming", () => {
  assert.match(sql, /event\.status = 'scheduled'[\s\S]*event\.starts_at > timezone/);
});
test("CE-37 discovery memakai search category scope dan keyset bounded", () => {
  assert.match(sql, /p_search text default null/);
  assert.match(sql, /p_category text default null/);
  assert.match(sql, /\(event\.starts_at, event\.public_slug\)/);
  assert.match(sql, /least\(greatest\(coalesce\(p_limit, 13\), 1\), 31\)/);
});
test("CE-38 discovery campus scope ditegakkan server", () => {
  const { model, slug } = create(seed(), { scope: "campus" });
  assert.equal(model.discover(C).some((event) => event.slug === slug), false);
  assert.equal(model.discover(B).some((event) => event.slug === slug), true);
});
test("CE-39 discovery tidak memakai ranking", () => {
  assert.doesNotMatch(sql, /rank\(|score|popularity/i);
});
test("CE-40 detail scheduled cancelled dan past dipertahankan", () => {
  const { model, slug } = create();
  model.cancelEvent(A, slug);
  assert.equal(model.detail(B, slug).status, "cancelled");
});
test("CE-41 archived hanya organizer atau RSVP history", () => {
  const { model, slug } = create();
  model.rsvp(B, slug);
  model.cancelEvent(A, slug);
  model.archive(A, slug);
  assert.equal(model.detail(B, slug).status, "archived");
  assert.throws(() => model.detail(C, slug), /unavailable/);
});
test("CE-42 detail publik berisi count tanpa attendee list", () => {
  const detail = detailFixSql.match(
    /create or replace function public\.get_campus_event[\s\S]*?revoke all on function public\.get_campus_event/,
  )?.[0];
  assert.ok(detail);
  assert.match(detail, /going_count/);
  assert.match(detail, /organizer_alias text/);
  assert.match(
    detail,
    /organizer_profile\.verification_status = 'verified',\s*target\.status,\s*target\.ends_at <=/,
  );
  assert.doesNotMatch(
    detail.match(/returns table \(([\s\S]*?)\)\nlanguage/)?.[1] ?? "",
    /\b(user_id|email|first_name|contact|uuid)\b/i,
  );
});
test("CE-43 attendee list hanya organizer atau RSVP going", () => {
  const { model, slug } = create();
  assert.throws(() => model.listAttendees(B, slug), /rsvp/);
  model.rsvp(B, slug);
  assert.equal(model.listAttendees(B, slug).length, 2);
});
test("CE-44 attendee projection adalah allowlist aman", () => {
  const projection = sql.match(/create or replace function public\.list_campus_event_attendees[\s\S]*?returns table \(([\s\S]*?)\)\nlanguage/)?.[1];
  assert.ok(projection);
  assert.doesNotMatch(projection, /\b(user_id|email|first_name|photo|contact|uuid)\b/i);
  assert.match(projection, /public_alias[\s\S]*rsvped_at/);
});
test("CE-45 block mengecualikan counterpart tanpa alasan", () => {
  const { model, slug } = create();
  model.rsvp(B, slug);
  model.block(A, B);
  assert.equal(model.listAttendees(A, slug).some((row) => row.public_alias === "Partner #100002"), false);
  assert.doesNotMatch(service, /block_reason/);
});
test("CE-46 block dengan organizer mencegah RSVP", () => {
  const { model, slug } = create();
  model.block(A, B);
  assert.throws(() => model.rsvp(B, slug), /unavailable/);
});
test("CE-47 tidak menulis flow privat atau notifications", () => {
  const { model, slug } = create();
  model.rsvp(B, slug);
  assert.equal(model.privateFlowWrites(), 0);
  assert.doesNotMatch(sql, /insert into public\.(conversation|introduction|user_notifications|identity|contact|mutual)/i);
});
test("CE-48 edit hanya organizer scheduled lebih dari dua jam", () => {
  const { model, slug } = create();
  assert.throws(
    () => model.update(B, slug, { startsAt: NOW + 4 * HOUR, endsAt: NOW + 5 * HOUR, capacity: 3 }),
    /unavailable/,
  );
  assert.match(sql, /target\.starts_at <= timezone\('utc', now\(\)\) \+ interval '2 hours'/);
  model.rsvp(B, slug);
  assert.throws(
    () =>
      model.update(A, slug, {
        startsAt: NOW + 4 * HOUR,
        endsAt: NOW + 5 * HOUR,
        capacity: 4,
      }),
    /schedule venue locked/,
  );
  assert.match(sql, /schedule venue locked after rsvp/);
});
test("CE-49 kapasitas edit tidak dapat di bawah going count", () => {
  const { model, slug } = create();
  model.rsvp(B, slug);
  model.rsvp(C, slug);
  assert.throws(
    () => model.update(A, slug, { startsAt: NOW + 4 * HOUR, endsAt: NOW + 5 * HOUR, capacity: 2 }),
    /capacity below/,
  );
});
test("CE-50 cancel hanya upcoming scheduled dan tanpa restore", () => {
  const { model, slug } = create();
  model.cancelEvent(A, slug);
  assert.throws(() => model.cancelEvent(A, slug), /unavailable/);
  assert.doesNotMatch(service, /restoreCampusEvent/);
});
test("CE-51 archive hanya setelah cancel atau event berakhir", () => {
  const { model, slug } = create();
  assert.throws(() => model.archive(A, slug), /unavailable/);
  model.cancelEvent(A, slug);
  model.archive(A, slug);
  assert.equal(model.get(slug).status, "archived");
});
test("CE-52 report event dan organizer terpisah serta anti self-report", () => {
  const { model, slug } = create();
  model.report(B, slug, "event");
  assert.equal(model.latestReport()?.kind, "event");
  model.report(B, slug, "event_organizer");
  assert.equal(model.latestReport()?.kind, "event_organizer");
  assert.throws(() => model.report(A, slug, "event"), /self/);
});
test("CE-53 report menyimpan snapshot bounded dan moderasi signature tetap", () => {
  assert.match(sql, /campus_event_description_excerpt/);
  assert.match(sql, /left\(target\.description, 280\)/);
  assert.match(sql, /create or replace function public\.list_moderation_reports\(\s*p_status text default null, p_limit integer default 50/);
  assert.match(sql, /referenced_message_excerpt text/);
});
test("CE-54 seluruh tabel RLS tanpa direct grants dan RPC hardened", () => {
  for (const table of [
    "campus_events",
    "campus_event_rsvps",
    "campus_event_audit_events",
    "campus_event_rate_limits",
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table}[\\s\\S]{0,80}public, anon, authenticated`));
  }
  assert.doesNotMatch(sql, /execute\s+format|dynamic sql/i);
  assert.equal((sql.match(/security definer/g) ?? []).length > 10, true);
  assert.equal((sql.match(/set search_path = ''/g) ?? []).length > 10, true);
});
test("CE-55 validation/service/script lengkap dan verification tidak wajib", () => {
  assert.equal(eventFiltersSchema.safeParse({}).success, true);
  assert.equal(eventReportSchema.safeParse({
    publicSlug: `event-${"a".repeat(24)}`,
    reasonCode: "unsafe_location",
    details: "Lokasi tampak bukan tempat umum.",
  }).success, true);
  for (const fn of [
    "listCampusEvents", "getCampusEvent", "createCampusEvent",
    "updateCampusEvent", "registerForCampusEvent", "cancelCampusEventRsvp",
    "cancelCampusEvent", "archiveCampusEvent", "listCampusEventAttendees",
    "reportCampusEvent", "reportCampusEventOrganizer",
  ]) assert.match(service, new RegExp(fn));
  assert.match(packageJson, /"test:events"/);
  assert.doesNotMatch(sql, /verification_status\s*=\s*'verified'\s+and/);
  assert.match(sql, /not public\.is_campus_event_student\(target\.organizer_user_id\)/);
});
