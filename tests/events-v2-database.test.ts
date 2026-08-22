import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const organizer = readFileSync(
  join(
    root,
    "supabase/migrations/202608220002_event_organizer_registration_v2.sql",
  ),
  "utf8",
);
const tickets = readFileSync(
  join(
    root,
    "supabase/migrations/202608220003_event_ticket_checkin_v2.sql",
  ),
  "utf8",
);
const sql = `${organizer}\n${tickets}`;

const functionBody = (name: string) => {
  const body = sql.match(
    new RegExp(
      `create (?:or replace )?function public\\.${name}[\\s\\S]*?\\$\\$;`,
    ),
  )?.[0];
  assert.ok(body, `${name} must exist`);
  return body;
};

test("EV2-01 organizer trust is separate from membership and staff", () => {
  const eligibility = functionBody("is_event_organizer_eligible");
  const create = functionBody("create_campus_event");
  assert.match(eligibility, /verification_status = 'verified'/);
  assert.match(eligibility, /event_organizer_eligibility/);
  assert.match(eligibility, /status <> 'revoked'/);
  assert.match(eligibility, /staff\.status = 'active'/);
  assert.doesNotMatch(eligibility, /effective_membership_plan/);
  assert.match(create, /is_event_organizer_eligible\(actor\)/);
  assert.match(create, /'create_day', 2, 86400/);
  assert.doesNotMatch(create, /p_is_official/);
});

test("EV2-02 owner controls eligibility and official flag by safe identifiers", () => {
  for (const name of [
    "owner_lookup_event_organizer_eligibility",
    "owner_manage_event_organizer_eligibility",
    "owner_set_campus_event_official",
  ]) {
    assert.match(functionBody(name), /is_current_active_staff\(array\['owner'\]/);
  }
  assert.match(
    functionBody("owner_manage_event_organizer_eligibility"),
    /p_public_alias text/,
  );
  assert.doesNotMatch(
    functionBody("owner_manage_event_organizer_eligibility"),
    /p_target_user_id/,
  );
  assert.match(functionBody("guard_campus_event_official_flag"), /owner managed/);
});

test("EV2-03 membership quotas and capacity grandfathering are enforced", () => {
  const limits = functionBody("event_membership_limit");
  const trigger = functionBody("enforce_campus_event_v2_limits");
  assert.match(limits, /plus' and p_key = 'created_events_active' then 3/);
  assert.match(limits, /p_key = 'created_events_active' then 1/);
  assert.match(limits, /participant_capacity' then 200/);
  assert.match(limits, /participant_capacity' then 50/);
  assert.match(limits, /event_cohosts' then 3/);
  assert.match(limits, /event_custom_questions' then 10/);
  assert.match(trigger, /tg_op = 'INSERT' and new\.capacity > participant_limit/);
  assert.match(trigger, /new\.capacity > old\.capacity/);
  assert.match(organizer, /campus_events_capacity check \(capacity between 3 and 200\)/);
});

test("EV2-04 event team is scoped, alias-invited, block-aware, and audited", () => {
  assert.match(
    organizer,
    /role in \('cohost', 'checkin_staff'\)[\s\S]*status in \('invited', 'active', 'declined', 'removed'\)/,
  );
  const invite = functionBody("invite_campus_event_team_member");
  assert.match(invite, /p_public_alias text/);
  assert.match(invite, /users_are_blocked\(actor, target_user\)/);
  assert.match(invite, /event_cohosts/);
  assert.match(invite, /else 10 end/);
  assert.doesNotMatch(invite, /manage_staff_member|staff_role/);
  const listTeam = functionBody("list_campus_event_team_members");
  assert.match(listTeam, /event\.organizer_user_id = actor/);
  assert.match(listTeam, /profile\.public_alias/);
  assert.match(listTeam, /member\.status in \('invited', 'active'\)/);
  assert.match(organizer, /team_invited[\s\S]*team_accepted[\s\S]*team_removed/);
});

test("EV2-05 old waitlist migrates deterministically into RSVP lifecycle", () => {
  assert.match(
    organizer,
    /status in \('pending', 'going', 'waitlisted', 'declined', 'cancelled'\)/,
  );
  assert.match(organizer, /from public\.campus_event_waitlist waitlist/);
  assert.match(organizer, /least\(campus_event_rsvps\.rsvped_at, excluded\.rsvped_at\)/);
  assert.match(organizer, /drop table public\.campus_event_waitlist/);
  assert.match(organizer, /public_id ~ '\^\[0-9a-f\]\{32\}\$'/);
});

test("EV2-06 custom questions reject sensitive and profile wording", () => {
  const safe = functionBody("event_question_prompt_is_safe");
  for (const word of [
    "password",
    "otp",
    "nim",
    "government id",
    "alamat rumah",
    "auth credential",
    "contact reveal",
    "kampus",
    "program studi",
    "semester",
    "minat",
  ]) {
    assert.match(safe, new RegExp(word.replace(" ", ".*")));
  }
  const validate = functionBody("validate_campus_event_registration_answers");
  assert.match(validate, /octet_length\(answers::text\) > 12000/);
  assert.match(validate, /unknown registration answer/);
  assert.match(validate, /required registration answer missing/);
  assert.match(validate, /jsonb_array_length\(answer\) > 12/);
});

test("EV2-07 registration is event-locked and capacity-safe", () => {
  const register = functionBody("register_for_campus_event");
  const manage = functionBody("manage_campus_event_registration");
  const cancel = functionBody("cancel_campus_event_rsvp");
  assert.match(register, /public_slug = p_public_slug for update/);
  assert.ok(
    register.indexOf("for update") <
      register.indexOf("select count(*)::integer into going_count"),
  );
  assert.match(register, /registration_mode = 'approval'/);
  assert.match(register, /waitlist_enabled/);
  assert.match(register, /registration_closes_at/);
  assert.match(manage, /public_slug = p_public_slug for update/);
  assert.match(manage, /event_can_manage_registrations/);
  assert.match(cancel, /promote_campus_event_waitlisted_rsvp/);
  assert.match(
    functionBody("promote_campus_event_waitlisted_rsvp"),
    /order by rsvp\.rsvped_at, rsvp\.id, rsvp\.public_id/,
  );
});

test("EV2-08 participant enumeration is management-only and paginated", () => {
  const attendees = functionBody("list_campus_event_attendees");
  const registrations = functionBody("list_campus_event_registrations");
  assert.match(attendees, /event_can_manage_registrations/);
  assert.match(attendees, /checkin_staff/);
  assert.doesNotMatch(
    attendees.match(/returns table \(([\s\S]*?)\)\nlanguage/)?.[1] ?? "",
    /\b(email|nim|first_name|contact|ticket_hash|user_id|uuid)\b/i,
  );
  assert.match(registrations, /registration_answers jsonb/);
  assert.match(registrations, /least\(greatest\(coalesce\(p_limit, 51\), 1\), 101\)/);
  assert.match(registrations, /\(rsvp\.rsvped_at, rsvp\.public_id\)/);
  assert.doesNotMatch(
    registrations.match(/returns table \(([\s\S]*?)\)\nlanguage/)?.[1] ?? "",
    /\b(email|nim|first_name|contact|ticket_hash|user_id|uuid)\b/i,
  );
});

test("EV2-09 notification constraints and trigger cover v2 without self-spam", () => {
  for (const type of [
    "EVENT_REGISTRATION_PENDING",
    "EVENT_REGISTRATION_APPROVED",
    "EVENT_REGISTRATION_DECLINED",
    "EVENT_WAITLISTED",
    "EVENT_WAITLIST_PROMOTED",
    "EVENT_TEAM_INVITED",
  ]) {
    assert.match(organizer, new RegExp(type));
  }
  const notify = functionBody("notify_campus_event_registration");
  assert.match(notify, /event_row\.organizer_user_id = new\.user_id/);
  assert.match(notify, /old\.status <> 'waitlisted'/);
  assert.match(
    functionBody("notify_campus_event_waitlist_promotion"),
    /old\.status <> 'waitlisted' or new\.status <> 'going'/,
  );
  assert.equal(
    (organizer.match(/'event_waitlist_promoted:' \|\| new\.id::text/g) ?? [])
      .length,
    1,
  );
  assert.match(
    functionBody("fanout_event_going_notifications"),
    /status in \('pending', 'going', 'waitlisted'\)/,
  );
});

test("EV2-10 tickets store only app-provided hash and registration reference", () => {
  const issue = functionBody("issue_my_campus_event_ticket");
  assert.match(tickets, /rsvp_id uuid/);
  assert.match(tickets, /active_registration_idx/);
  assert.match(issue, /p_ticket_public_id text/);
  assert.match(issue, /p_ticket_hash text/);
  assert.match(issue, /p_ticket_hash !~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.doesNotMatch(issue, /gen_random_bytes\(32\)|raw_token|ticket_token/);
  assert.match(
    functionBody("get_my_campus_event_ticket_state"),
    /ticket_public_id text/,
  );
});

test("EV2-11 QR check-in hashes SDT1 token and returns safe structured status", () => {
  const checkin = functionBody("check_in_campus_event_ticket");
  assert.match(checkin, /\^SDT1\\\.\[A-Za-z0-9_-\]\{43\}\$/);
  assert.match(checkin, /digest\(p_ticket_token, 'sha256'\)/);
  assert.match(checkin, /event_can_check_in/);
  assert.match(
    checkin,
    /candidate\.event_id = event_row\.id[\s\S]*candidate\.ticket_hash = token_hash/,
  );
  assert.match(checkin, /'wrong_event'/);
  assert.match(checkin, /starts_at - interval '2 hours'/);
  assert.match(checkin, /ends_at \+ interval '2 hours'/);
  assert.match(checkin, /status text,[\s\S]*attendee_alias text/);
  assert.doesNotMatch(checkin, /select .*email|select .*ticket_hash/i);
});

test("EV2-12 manual check-in and undo preserve role separation and audit", () => {
  assert.match(
    functionBody("manual_check_in_campus_event_registration"),
    /event_can_check_in/,
  );
  const undo = functionBody("undo_campus_event_check_in");
  assert.match(undo, /array\['cohost'\]/);
  assert.doesNotMatch(undo, /checkin_staff/);
  assert.match(organizer, /checked_in_qr[\s\S]*checked_in_manual[\s\S]*checkin_undone/);
  assert.doesNotMatch(sql, /EVENT_CHECKED_IN|CHECKIN_NOTIFICATION/);
});

test("EV2-13 new tables are RLS-closed and helpers are not student executable", () => {
  for (const table of [
    "event_organizer_eligibility",
    "event_organizer_eligibility_audit",
    "event_team_members",
    "event_registration_questions",
  ]) {
    assert.match(
      organizer,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
    assert.match(
      organizer,
      new RegExp(
        `revoke all on table public\\.${table}[\\s\\S]{0,100}(?:public, anon, authenticated|from public, anon, authenticated)`,
      ),
    );
  }
  assert.equal(
    (sql.match(/security definer[\s\S]{0,50}set search_path = ''/g) ?? [])
      .length > 25,
    true,
  );
  assert.doesNotMatch(sql, /grant (?:select|insert|update|delete) on table/i);
});

test("EV2-14 account cleanup covers v2 rows without deleting shared history", () => {
  const cleanup = functionBody("cleanup_account_deletion_database");
  assert.match(cleanup, /event_organizer_eligibility/);
  assert.match(cleanup, /event_team_members/);
  assert.match(cleanup, /set user_id = null, status = 'removed'/);
  assert.match(
    cleanup,
    /delete from public\.campus_event_rsvps[\s\S]*status <> 'going'/,
  );
});
