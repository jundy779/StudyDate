import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  EVENT_TICKET_TOKEN_PATTERN,
} from "../lib/events/constants.ts";
import {
  getNotificationCopy,
  NOTIFICATION_TYPES,
  type NotificationType,
} from "../lib/notifications/constants.ts";
import {
  createEventTicketMaterial,
  deriveEventTicketToken,
} from "../lib/events/ticket-crypto-core.ts";
import {
  eventQuestionCreateSchema,
  eventFormSchema,
  eventRegistrationAnswersSchema,
  eventRegistrationListSchema,
  eventTeamInviteSchema,
  eventTicketCheckInSchema,
} from "../lib/events/validation.ts";

const root = process.cwd();
const service = readFileSync(join(root, "lib/events/service.ts"), "utf8");
const actions = readFileSync(
  join(root, "app/app/events/actions.ts"),
  "utf8",
);
const limits = readFileSync(
  join(root, "lib/membership/limits.ts"),
  "utf8",
);
const envExample = readFileSync(join(root, ".env.example"), "utf8");
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/202608220002_event_organizer_registration_v2.sql",
  ),
  "utf8",
);
const slug = `event-${"a".repeat(24)}`;
const id = "b".repeat(32);

test("EV2S-01 validators enforce safe questions and bounded answers", () => {
  assert.equal(
    eventQuestionCreateSchema.safeParse({
      publicSlug: slug,
      questionType: "single_select",
      prompt: "Pilih sesi yang ingin diikuti",
      options: ["Sesi pagi", "Sesi siang"],
      isRequired: true,
    }).success,
    true,
  );
  for (const prompt of [
    "Masukkan NIM kamu",
    "Apa password akunmu?",
    "Tulis alamat rumah",
    "Sebutkan program studi",
    "Masukkan email aktif",
    "Apa username Telegram kamu?",
  ]) {
    assert.equal(
      eventQuestionCreateSchema.safeParse({
        publicSlug: slug,
        questionType: "short_text",
        prompt,
        options: [],
        isRequired: false,
      }).success,
      false,
    );
  }
  assert.equal(
    eventRegistrationAnswersSchema.safeParse({
      [id]: "a".repeat(501),
    }).success,
    false,
  );
  for (const answer of [
    "student@example.com",
    "WhatsApp 0812-3456-7890",
    "@akun_telegram",
    "https://linkedin.com/in/student",
  ]) {
    assert.equal(
      eventRegistrationAnswersSchema.safeParse({ [id]: answer }).success,
      false,
    );
  }
  assert.equal(
    eventTeamInviteSchema.safeParse({
      publicSlug: slug,
      publicAlias: "Partner #100001",
      role: "owner",
    }).success,
    false,
  );
});

test("EV2S-02 registration cursor and QR format are strict", () => {
  assert.equal(
    eventFormSchema.safeParse({
      title: "Belajar Bareng Event",
      description: "Belajar bersama di tempat publik kampus dengan agenda yang jelas.",
      category: "study_together",
      scope: "open",
      registrationMode: "instant",
      waitlistEnabled: true,
      registrationClosesAt: "2026-08-24T02:00:00.000Z",
      startsAtLocal: "2026-08-24T10:00",
      endsAtLocal: "2026-08-24T12:00",
      timezone: "Asia/Jakarta",
      venueCategory: "campus_public_area",
      venueName: "Perpustakaan Kampus",
      venueArea: "Lantai satu area diskusi",
      city: "Jakarta",
      capacity: 50,
      confirmsPublicPlace: true,
      confirmsExpectedOperating: true,
      confirmsNotPrivateResidence: true,
      confirmsNoPrivateLocationDisclosure: true,
    }).success,
    true,
  );
  assert.match(actions, /toEventTimestamp\(registrationClosesAt, timezone\)/);
  assert.match(actions, /\+07:00/);
  assert.equal(
    eventRegistrationListSchema.safeParse({
      publicSlug: slug,
      beforeRsvpedAt: "2026-08-23T00:00:00Z",
    }).success,
    false,
  );
  assert.equal(
    eventTicketCheckInSchema.safeParse({
      publicSlug: slug,
      ticketToken: `SDT1.${"A".repeat(43)}`,
    }).success,
    true,
  );
  assert.equal(
    eventTicketCheckInSchema.safeParse({
      publicSlug: slug,
      ticketToken: "a".repeat(64),
    }).success,
    false,
  );
});

test("EV2S-03 ticket material is deterministic, opaque, and hash-correct", () => {
  const secret = Buffer.alloc(32, 7);
  const first = createEventTicketMaterial(secret, id);
  const second = createEventTicketMaterial(secret, id);
  assert.equal(first.rawToken, second.rawToken);
  assert.equal(first.rawToken, deriveEventTicketToken(secret, id));
  assert.match(first.rawToken, EVENT_TICKET_TOKEN_PATTERN);
  assert.match(first.tokenHash, /^[0-9a-f]{64}$/);
  assert.notEqual(
    deriveEventTicketToken(Buffer.alloc(32, 8), id),
    first.rawToken,
  );
});

test("EV2S-04 ticket public IDs have entropy and fixed format", () => {
  const secret = Buffer.alloc(32, 9);
  const values = new Set(
    Array.from({ length: 64 }, () => createEventTicketMaterial(secret).publicId),
  );
  assert.equal(values.size, 64);
  for (const value of values) assert.match(value, /^[0-9a-f]{32}$/);
});

test("EV2S-05 source contracts cover all v2 RPCs and no raw ticket persistence", () => {
  for (const rpc of [
    "get_campus_event_v2_settings",
    "list_campus_event_registration_questions",
    "add_campus_event_registration_question",
    "delete_campus_event_registration_question",
    "register_for_campus_event",
    "manage_campus_event_registration",
    "update_campus_event_registration_settings",
    "get_campus_event_registration_overview",
    "list_campus_event_registrations",
    "get_my_event_organizer_eligibility",
    "owner_lookup_event_organizer_eligibility",
    "owner_manage_event_organizer_eligibility",
    "owner_set_campus_event_official",
    "invite_campus_event_team_member",
    "respond_campus_event_team_invitation",
    "list_my_campus_event_team_invitations",
    "list_campus_event_team_members",
    "remove_campus_event_team_member",
    "issue_my_campus_event_ticket",
    "check_in_campus_event_ticket",
    "manual_check_in_campus_event_registration",
    "undo_campus_event_check_in",
  ]) {
    assert.match(service, new RegExp(rpc));
  }
  assert.match(service, /p_ticket_public_id: material\.publicId/);
  assert.match(service, /p_ticket_hash: material\.tokenHash/);
  const issueSource = service.match(
    /export async function issueMyCampusEventTicket[\s\S]*?export async function getMyCampusEventTicketState/,
  )?.[0];
  assert.ok(issueSource);
  assert.doesNotMatch(issueSource, /p_ticket_token:/);
  assert.doesNotMatch(actions, /userId|targetUserId|p_user_id/);
  assert.match(envExample, /EVENT_TICKET_SECRET=/);
});

test("EV2S-06 TypeScript limits and create/update migration contracts match v2", () => {
  assert.match(limits, /createdEventsActive: 1/);
  assert.match(limits, /createdEventsActive: 3/);
  assert.match(limits, /eventParticipantCapacity: 50/);
  assert.match(limits, /eventParticipantCapacity: 200/);
  assert.match(limits, /eventCohosts: 1/);
  assert.match(limits, /eventCohosts: 3/);
  assert.match(limits, /eventCustomQuestions: 3/);
  assert.match(limits, /eventCustomQuestions: 10/);
  assert.equal((migration.match(/p_registration_mode text/g) ?? []).length >= 3, true);
  assert.equal((migration.match(/p_waitlist_enabled boolean/g) ?? []).length >= 3, true);
});

test("EV2S-07 notification center understands every Event v2 lifecycle", () => {
  for (const type of [
    "EVENT_REGISTRATION_PENDING",
    "EVENT_REGISTRATION_APPROVED",
    "EVENT_REGISTRATION_DECLINED",
    "EVENT_WAITLISTED",
    "EVENT_WAITLIST_PROMOTED",
    "EVENT_TEAM_INVITED",
  ] satisfies NotificationType[]) {
    assert.equal(NOTIFICATION_TYPES.includes(type), true);
    const copy = getNotificationCopy({
      publicId: id,
      type,
      targetPath: `/app/events/${slug}`,
      channel: null,
      headline: "Workshop Kampus",
      createdAt: "2026-08-23T00:00:00Z",
      readAt: null,
    });
    assert.ok(copy.title);
    assert.ok(copy.description);
  }
});
