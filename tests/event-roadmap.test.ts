import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  eventCircleLinkSchema,
  eventMessageReportSchema,
  eventMessageSchema,
  eventTicketCheckInSchema,
} from "../lib/events/validation.ts";
import { NOTIFICATION_TYPES } from "../lib/notifications/constants.ts";

const root = process.cwd();
const readMigration = (name: string) =>
  readFileSync(join(root, "supabase/migrations", name), "utf8");
const quota = readMigration("202608210003_event_membership_quotas.sql");
const scheduler = readMigration("202608210004_event_scheduler_reminders.sql");
const preferences = readMigration("202608210005_notification_preferences.sql");
const association = readMigration("202608210006_circle_event_association.sql");
const waitlist = readMigration("202608210007_event_waitlist.sql");
const chat = readMigration("202608210008_event_chat.sql");
const tickets = `${readMigration("202608210009_event_ticketing_checkin.sql")}\n${readMigration(
  "202608220003_event_ticket_checkin_v2.sql",
)}`;
const waitlistFix = readMigration(
  "202608210010_fix_event_waitlist_candidate_ambiguity.sql",
);

test("Event Free/Plus quotas are serialized and server-enforced", () => {
  assert.match(quota, /created_events_active' then 5/);
  assert.match(quota, /created_events_active' then 2/);
  assert.match(quota, /joined_events_active' then 10/);
  assert.match(quota, /joined_events_active' then 5/);
  assert.match(quota, /pg_advisory_xact_lock/);
  assert.match(quota, /before insert or update of status, starts_at/);
});

test("reminders are durable, deduped, gated for deployment, and use preferences", () => {
  assert.match(scheduler, /primary key \(event_id, user_id, reminder_kind\)/);
  assert.match(scheduler, /event\.starts_at > timezone\('utc', now\(\)\)/);
  assert.match(scheduler, /EVENT_REMINDER_24H/);
  assert.match(scheduler, /EVENT_REMINDER_2H/);
  assert.match(scheduler, /perform public\.emit_user_notification/);
  assert.match(scheduler, /grant execute on function public\.product_scheduler_tick\(\) to service_role/);
  assert.doesNotMatch(scheduler, /cron\.schedule/);
  assert.match(preferences, /not preference\.in_app_enabled/);
});

test("notification preferences remain in-app only", () => {
  assert.match(preferences, /email_enabled = false/);
  assert.match(preferences, /telegram_enabled = false/);
  assert.match(preferences, /web_push_enabled = false/);
  assert.match(preferences, /EVENT_WAITLIST_PROMOTED/);
});

test("Circle association is organizer-owned and optional", () => {
  assert.match(association, /event\.organizer_user_id = actor/);
  assert.match(association, /circle\.owner_user_id = actor/);
  assert.match(association, /if p_circle_public_slug is null then/);
  assert.equal(
    eventCircleLinkSchema.safeParse({
      eventPublicSlug: `event-${"a".repeat(24)}`,
      circlePublicSlug: `circle-${"b".repeat(24)}`,
    }).success,
    true,
  );
});

test("waitlist promotion is FIFO, locked, scoped, and quota-aware", () => {
  assert.match(waitlist, /order by waiting\.joined_at, waiting\.user_id/);
  assert.match(waitlist, /event\.scope = 'campus'/);
  assert.match(waitlist, /event_membership_limit/);
  assert.match(waitlist, /campus_events_sync_waitlist_lifecycle/);
  assert.match(waitlist, /new\.capacity > old\.capacity/);
  assert.match(waitlist, /set status = 'cancelled'/);
  assert.match(waitlist, /EVENT_WAITLIST_PROMOTED/);
  assert.match(waitlistFix, /queue_candidate record/);
  assert.doesNotMatch(
    waitlistFix,
    /select \* into event_row from public\.campus_events candidate/,
  );
  assert.equal(NOTIFICATION_TYPES.includes("EVENT_WAITLIST_PROMOTED"), true);
});

test("Event chat uses participant gate, contact filter, idempotency, and rate limits", () => {
  assert.match(chat, /is_active_campus_event_participant/);
  assert.match(chat, /introduction_message_has_contact/);
  assert.match(chat, /message_minute/);
  assert.match(chat, /message_day/);
  assert.match(
    chat,
    /p_bucket not in \([\s\S]*'message_minute', 'message_day'/,
  );
  assert.equal(
    eventMessageSchema.safeParse({
      publicSlug: `event-${"a".repeat(24)}`,
      body: "Sampai bertemu di area baca.",
      idempotencyKey: "abcdefghijklmnop",
    }).success,
    true,
  );
  assert.match(chat, /report_campus_event_message/);
  assert.match(chat, /campus_event_message_excerpt/);
  assert.equal(
    eventMessageReportSchema.safeParse({
      publicSlug: `event-${"a".repeat(24)}`,
      messagePublicId: "b".repeat(32),
      reasonCode: "spam",
    }).success,
    true,
  );
});

test("tickets are opaque, one-time issued, and time-bounded for organizer check-in", () => {
  assert.match(tickets, /p_ticket_hash text/);
  assert.match(tickets, /digest\(p_ticket_token, 'sha256'\)/);
  assert.match(tickets, /event_row\.starts_at - interval '2 hours'/);
  assert.match(tickets, /event_row\.ends_at \+ interval '2 hours'/);
  assert.match(tickets, /registration\.checked_in_at is not null/);
  assert.match(tickets, /get_my_campus_event_ticket_state/);
  assert.match(tickets, /active_registration_idx/);
  assert.equal(
    eventTicketCheckInSchema.safeParse({
      publicSlug: `event-${"a".repeat(24)}`,
      ticketToken: `SDT1.${"c".repeat(43)}`,
    }).success,
    true,
  );
});
