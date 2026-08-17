import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { CircleEventNotificationModel } from "../lib/notifications/circle-event-behavior-model.ts";
import {
  getNotificationCopy,
  NOTIFICATION_TYPES,
} from "../lib/notifications/constants.ts";
import { NotificationBehaviorModel } from "../lib/notifications/behavior-model.ts";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/202608170006_circle_event_notifications_v1.sql",
  ),
  "utf8",
);
const originalMigration = readFileSync(
  join(
    root,
    "supabase/migrations/202608070013_create_notifications_v1.sql",
  ),
  "utf8",
);
const service = readFileSync(
  join(root, "lib/notifications/service.ts"),
  "utf8",
);
const copy = readFileSync(
  join(root, "lib/notifications/constants.ts"),
  "utf8",
);
const item = readFileSync(
  join(root, "components/notifications/notification-item.tsx"),
  "utf8",
);
const membershipMigration = readFileSync(
  join(
    root,
    "supabase/migrations/202608170004_membership_entitlements_v1.sql",
  ),
  "utf8",
);

const OWNER = "owner";
const MEMBER = "member";
const OTHER = "other";
const UNRELATED = "unrelated";
const STAFF = "staff";
const CIRCLE_SLUG = `circle-${"ab".repeat(12)}`;
const EVENT_SLUG = `event-${"cd".repeat(12)}`;

function seed() {
  const model = new CircleEventNotificationModel();
  model.seedStudent(OWNER);
  model.seedStudent(MEMBER);
  model.seedStudent(OTHER);
  model.seedStudent(UNRELATED);
  model.seedStudent(STAFF);
  model.seedStaff(STAFF);
  return model;
}

test("SQL extends existing notification taxonomy without a second inbox", () => {
  assert.match(migration, /CIRCLE_MEMBER_JOINED/);
  assert.match(migration, /EVENT_SCHEDULE_CHANGED/);
  assert.match(migration, /EVENT_LOCATION_CHANGED/);
  assert.match(migration, /EVENT_CANCELLED/);
  assert.doesNotMatch(migration, /create table public\.(circle|event)_notifications/i);
  assert.match(
    migration,
    /target_path ~ '\^\/app\/circles\/circle-\[0-9a-f\]\{24\}\$'/,
  );
  assert.match(
    migration,
    /target_path ~ '\^\/app\/events\/event-\[0-9a-f\]\{24\}\$'/,
  );
  assert.match(migration, /insert into public\.user_notifications \([\s\S]*select/i);
  assert.match(migration, /on conflict \(dedupe_key\) do nothing/);
  assert.match(migration, /is_notification_student/);
  assert.match(
    migration,
    /session_user not in \('postgres', 'supabase_admin', 'authenticator'\)/,
  );
  assert.doesNotMatch(migration, /pg_cron|cron\.schedule/i);
  assert.doesNotMatch(migration, /consume_membership_quota/);
  assert.doesNotMatch(
    migration,
    /resend|smtp|signInWithOtp|sendMessage|web-push|fcm/i,
  );
  assert.doesNotMatch(migration, /grant execute on function public\.fanout_/);
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.notify_study_circle/,
  );
  assert.match(
    migration,
    /drop function if exists public\.list_my_notifications\(integer, timestamptz, text, boolean\)/,
  );
  assert.match(
    migration,
    /grant execute on function public\.list_my_notifications\(integer, timestamptz, text, boolean\)/,
  );
  assert.doesNotMatch(migration, /circle_join_requested|EVENT_REMINDER/);
  assert.match(membershipMigration, /consume_membership_quota/);
  assert.doesNotMatch(
    originalMigration,
    /CIRCLE_MEMBER_JOINED|EVENT_CANCELLED/,
  );
});

test("Circle join notifies host only, never the joiner or unrelated users", () => {
  const model = seed();
  const circle = model.createCircle(OWNER, {
    slug: CIRCLE_SLUG,
    name: "Belajar Bareng Basis Data",
  });
  assert.equal(model.list(OWNER).length, 0);
  assert.equal(model.joinCircle(MEMBER, circle.id), true);
  assert.equal(model.joinCircle(MEMBER, circle.id), false);

  assert.equal(model.list(MEMBER).length, 0);
  assert.equal(model.list(UNRELATED).length, 0);
  assert.equal(model.list(OWNER).length, 1);
  assert.equal(model.list(OWNER)[0].type, "CIRCLE_MEMBER_JOINED");
  assert.equal(model.list(OWNER)[0].targetPath, `/app/circles/${CIRCLE_SLUG}`);
  assert.equal(model.unreadCount(OWNER), 1);
  assert.doesNotMatch(
    JSON.stringify(model.list(OWNER)),
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|@gmail\.com|\bNIM\b/i,
  );
});

test("Circle leave does not notify; removal notifies only the removed member", () => {
  const model = seed();
  const circle = model.createCircle(OWNER, {
    slug: CIRCLE_SLUG,
    name: "Belajar Kalkulus Mingguan",
  });
  model.joinCircle(MEMBER, circle.id);
  model.joinCircle(OTHER, circle.id);
  const afterJoins = model.list(OWNER).length;
  assert.equal(model.leaveCircle(OTHER, circle.id), true);
  assert.equal(model.list(OWNER).length, afterJoins);
  assert.equal(model.list(OTHER).length, 0);

  model.removeMember(OWNER, circle.id, MEMBER);
  assert.equal(model.list(MEMBER).length, 1);
  assert.equal(model.list(MEMBER)[0].type, "CIRCLE_MEMBER_REMOVED");
  assert.equal(model.list(OTHER).length, 0);
  assert.equal(model.list(OWNER).filter((row) => row.type === "CIRCLE_MEMBER_REMOVED").length, 0);
});

test("Meaningful Circle name/topic updates notify members, not the owner", () => {
  const model = seed();
  const circle = model.createCircle(OWNER, {
    slug: CIRCLE_SLUG,
    name: "Circle Lama",
  });
  model.joinCircle(MEMBER, circle.id);
  model.joinCircle(OTHER, circle.id);

  model.updateCircle(OWNER, circle.id, {
    description: "Deskripsi Circle untuk belajar bersama di kampus diperbaiki.",
    memberLimit: 12,
  });
  assert.equal(
    model.list(MEMBER).filter((row) => row.type === "CIRCLE_UPDATED").length,
    0,
  );

  model.updateCircle(OWNER, circle.id, { name: "Circle Baru" });
  model.updateCircle(OWNER, circle.id, { name: "Circle Baru" });
  assert.equal(
    model.list(MEMBER).filter((row) => row.type === "CIRCLE_UPDATED").length,
    1,
  );
  assert.equal(
    model.list(OWNER).filter((row) => row.type === "CIRCLE_UPDATED").length,
    0,
  );
  assert.equal(
    model.list(UNRELATED).filter((row) => row.type === "CIRCLE_UPDATED").length,
    0,
  );
});

test("Circle archive notifies active members once and skips the owner", () => {
  const model = seed();
  const circle = model.createCircle(OWNER, {
    slug: CIRCLE_SLUG,
    name: "Belajar Kalkulus Mingguan",
  });
  model.joinCircle(MEMBER, circle.id);
  model.joinCircle(OTHER, circle.id);
  model.leaveCircle(OTHER, circle.id);

  assert.equal(model.archiveCircle(OWNER, circle.id), true);
  assert.equal(model.archiveCircle(OWNER, circle.id), false);
  assert.equal(
    model.list(MEMBER).filter((row) => row.type === "CIRCLE_ARCHIVED").length,
    1,
  );
  assert.equal(
    model.list(OTHER).filter((row) => row.type === "CIRCLE_ARCHIVED").length,
    0,
  );
  assert.equal(
    model.list(OWNER).filter((row) => row.type === "CIRCLE_ARCHIVED").length,
    0,
  );
  const copyText = getNotificationCopy(model.list(MEMBER)[0]);
  assert.match(copyText.title, /ditutup/i);
  assert.doesNotMatch(copyText.description, /dikeluarkan karena|alasan moderasi/i);
});

test("Event registration confirms the participant, not the organizer or crowd", () => {
  const model = seed();
  const event = model.createEvent(OWNER, {
    slug: EVENT_SLUG,
    title: "Workshop SQL Kampus",
    startsAt: "2026-08-20T10:00:00.000Z",
    endsAt: "2026-08-20T12:00:00.000Z",
    venueName: "Perpustakaan Pusat",
    city: "Depok",
  });
  assert.equal(model.list(OWNER).length, 0);
  assert.equal(model.rsvpEvent(MEMBER, event.id), true);
  assert.equal(model.rsvpEvent(MEMBER, event.id), false);
  assert.equal(model.list(MEMBER)[0].type, "EVENT_REGISTERED");
  assert.equal(model.list(MEMBER)[0].targetPath, `/app/events/${EVENT_SLUG}`);
  assert.equal(model.list(OWNER).length, 0);
  assert.equal(model.list(UNRELATED).length, 0);
});

test("Event schedule and location changes notify going participants only", () => {
  const model = seed();
  const event = model.createEvent(OWNER, {
    slug: EVENT_SLUG,
    title: "Workshop SQL Kampus",
    startsAt: "2026-08-20T10:00:00.000Z",
    endsAt: "2026-08-20T12:00:00.000Z",
    venueName: "Perpustakaan Pusat",
    city: "Depok",
  });
  model.rsvpEvent(MEMBER, event.id);
  model.rsvpEvent(OTHER, event.id);
  model.cancelRsvp(OTHER, event.id);

  model.updateEvent(OWNER, event.id, {
    description: "Deskripsi event belajar di tempat publik kampus, diperjelas.",
  });
  assert.equal(
    model.list(MEMBER).filter((row) => row.type === "EVENT_SCHEDULE_CHANGED").length,
    0,
  );

  model.updateEvent(OWNER, event.id, {
    startsAt: "2026-08-21T10:00:00.000Z",
    endsAt: "2026-08-21T12:00:00.000Z",
  });
  model.updateEvent(OWNER, event.id, {
    startsAt: "2026-08-21T10:00:00.000Z",
    endsAt: "2026-08-21T12:00:00.000Z",
  });
  model.updateEvent(OWNER, event.id, {
    venueName: "Kafe Kampus Terbuka",
    city: "Depok",
  });

  const memberTypes = model.list(MEMBER).map((row) => row.type);
  assert.equal(memberTypes.filter((type) => type === "EVENT_SCHEDULE_CHANGED").length, 1);
  assert.equal(memberTypes.filter((type) => type === "EVENT_LOCATION_CHANGED").length, 1);
  assert.equal(model.list(OWNER).length, 0);
  assert.equal(
    model.list(OTHER).filter((row) => row.type === "EVENT_SCHEDULE_CHANGED").length,
    0,
  );
  assert.equal(
    model.list(UNRELATED).filter((row) => row.type === "EVENT_LOCATION_CHANGED").length,
    0,
  );
  const scheduleCopy = getNotificationCopy(
    model.list(MEMBER).find((row) => row.type === "EVENT_SCHEDULE_CHANGED")!,
  );
  assert.match(scheduleCopy.description, /Sekarang:/);
  assert.doesNotMatch(
    JSON.stringify(model.list(MEMBER)),
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|telegram id|nim/i,
  );
});

test("Event cancellation notifies active going participants and keeps unread semantics", () => {
  const model = seed();
  const event = model.createEvent(OWNER, {
    slug: EVENT_SLUG,
    title: "Workshop SQL Kampus",
    startsAt: "2026-08-20T10:00:00.000Z",
    endsAt: "2026-08-20T12:00:00.000Z",
    venueName: "Perpustakaan Pusat",
    city: "Depok",
  });
  model.rsvpEvent(MEMBER, event.id);
  assert.equal(model.unreadCount(MEMBER), 1);
  model.cancelEvent(OWNER, event.id);
  const cancelled = model.list(MEMBER).filter((row) => row.type === "EVENT_CANCELLED");
  assert.equal(cancelled.length, 1);
  assert.equal(model.unreadCount(MEMBER), 2);
  assert.equal(model.markRead(UNRELATED, cancelled[0].publicId), false);
  assert.equal(model.markRead(MEMBER, cancelled[0].publicId), true);
  assert.equal(model.unreadCount(MEMBER), 1);
  assert.equal(model.list(OWNER).length, 0);
});

test("Fan-out stays host/participant scoped even with a synthetic member batch", () => {
  const model = seed();
  const circle = model.createCircle(OWNER, {
    slug: CIRCLE_SLUG,
    name: "Batch Circle",
  });
  const event = model.createEvent(OWNER, {
    slug: EVENT_SLUG,
    title: "Batch Event",
    startsAt: "2026-08-20T10:00:00.000Z",
    endsAt: "2026-08-20T12:00:00.000Z",
    venueName: "Aula Publik",
    city: "Jakarta",
  });

  for (let index = 0; index < 40; index += 1) {
    const userId = `batch-${index}`;
    model.seedStudent(userId);
    model.joinCircle(userId, circle.id);
    model.rsvpEvent(userId, event.id);
  }

  assert.equal(model.list(OWNER).length, 40);
  model.archiveCircle(OWNER, circle.id);
  model.cancelEvent(OWNER, event.id);
  assert.equal(
    model.list(OWNER).filter((row) => row.type === "CIRCLE_ARCHIVED").length,
    0,
  );
  assert.equal(
    model.rows.filter((row) => row.type === "CIRCLE_ARCHIVED").length,
    40,
  );
  assert.equal(
    model.rows.filter((row) => row.type === "EVENT_CANCELLED").length,
    40,
  );
  assert.match(migration, /from public\.study_circle_memberships membership/);
  assert.match(migration, /from public\.campus_event_rsvps rsvp/);
  assert.doesNotMatch(migration, /for membership in/i);
});

test("Existing introduction notifications still render and new types stay exhaustive", () => {
  const intro = new NotificationBehaviorModel();
  intro.seedStudent("student-a");
  intro.seedStudent("student-b");
  intro.sendIntroduction("student-a", "student-b", "request-1");
  const received = intro.list("student-b")[0];
  assert.equal(getNotificationCopy(received).title, "Perkenalan baru");
  assert.equal(NOTIFICATION_TYPES.includes("INTRODUCTION_RECEIVED"), true);
  assert.equal(NOTIFICATION_TYPES.includes("CIRCLE_ARCHIVED"), true);
  assert.match(copy, /case "CIRCLE_MEMBER_JOINED"/);
  assert.match(copy, /const exhaustive: never = item\.type/);
  assert.match(service, /circle-\[0-9a-f\]\{24\}/);
  assert.match(service, /event-\[0-9a-f\]\{24\}/);
  assert.doesNotMatch(service, /recipient_user_id|dedupe_key|metadata/);
  assert.doesNotMatch(copy, /\bNIM\b|legal name|nomor telepon/i);
  assert.match(item, /Belum dibaca/);
  assert.match(item, /focus-ring/);
  assert.match(item, /min-w-0/);
  assert.match(item, /w-full/);
  assert.match(item, /aria-hidden="true"/);
});
