import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { proposeMeetingPlanSchema } from "../lib/meeting-plans/validation.ts";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/202608210002_safety_meeting_flow_v1.sql"),
  "utf8",
);
const service = readFileSync(join(root, "lib/meeting-plans/service.ts"), "utf8");
const panel = readFileSync(
  join(root, "components/messages/meeting-plan-panel.tsx"),
  "utf8",
);
const room = readFileSync(join(root, "components/messages/conversation-room.tsx"), "utf8");
const notifications = readFileSync(
  join(root, "lib/notifications/constants.ts"),
  "utf8",
);

const validPlan = {
  publicId: "a".repeat(32),
  venueCategory: "library",
  venueName: "Perpustakaan Kampus",
  venueArea: "Lobi utama lantai satu",
  city: "Bandung",
  startsAtLocal: "2026-08-25T10:00",
  expectedEndAtLocal: "2026-08-25T12:00",
  timezone: "Asia/Jakarta",
  confirmsPublicPlace: true,
  confirmsExpectedOperating: true,
  confirmsNotPrivateResidence: true,
  confirmsNoPrivateLocationDisclosure: true,
} as const;

test("meeting eligibility requires active mutual conversation and Identity Reveal", () => {
  assert.match(
    migration,
    /shell\.status = 'active'[\s\S]*shell\.mutual_interest_at is not null[\s\S]*shell\.identity_revealed_at is not null/,
  );
  assert.match(migration, /users_are_blocked/);
  assert.match(migration, /is_eligible_introduction_student/);
  assert.doesNotMatch(migration, /effective_membership_plan|contact_reveal.*required|verification_status = 'verified'/);
});

test("proposal validates public place, time, and all four affirmations", () => {
  assert.equal(proposeMeetingPlanSchema.safeParse(validPlan).success, true);
  assert.equal(
    proposeMeetingPlanSchema.safeParse({
      ...validPlan,
      venueArea: "https://maps.example/private",
    }).success,
    false,
  );
  assert.equal(
    proposeMeetingPlanSchema.safeParse({
      ...validPlan,
      confirmsPublicPlace: false,
    }).success,
    false,
  );
  assert.match(migration, /campus_event_has_private_venue/);
  assert.match(migration, /interval '30 minutes'/);
  assert.match(migration, /interval '12 hours'/);
  assert.match(migration, /interval '180 days'/);
});

test("two-party consent is atomic and one active plan is enforced", () => {
  assert.match(migration, /meeting_plans_one_active_conversation_idx/);
  assert.match(migration, /where status in \('pending_confirmation', 'confirmed'\)/);
  assert.match(migration, /creator_consented_at/);
  assert.match(migration, /actor <> plan\.counterpart_id/);
  assert.match(migration, /counterpart_consented_at = timezone/);
  assert.doesNotMatch(service, /\.from\(["']meeting_plans["']\)/);
});

test("projection exposes only actor-owned checks and no UUIDs", () => {
  assert.match(migration, /own_state\.precheck_acknowledged_at/);
  assert.match(migration, /own_state\.postcheck_status/);
  assert.doesNotMatch(service, /\bcreated_by\b|\bcounterpart_id\b|\breport_status\b|\bcancellation_code\b/);
  assert.match(room, /MeetingPlanPanel/);
});

test("lifecycle cancellation, cleanup, and report evidence are bounded", () => {
  assert.match(migration, /conversation_shells_cancel_meeting_plans/);
  assert.match(migration, /conversation_closed/);
  assert.match(migration, /interval '90 days'/);
  assert.match(migration, /moderation_status in \('submitted', 'under_review'\)/);
  assert.match(migration, /purge_expired_meeting_plan_details/);
  assert.match(migration, /on delete set null/);
});

test("pre/post checks and local share avoid emergency-monitoring claims", () => {
  assert.match(migration, /starts_at - interval '24 hours'/);
  assert.match(migration, /p_status not in \('safe', 'report_started'\)/);
  assert.match(panel, /navigator\.share/);
  assert.match(panel, /navigator\.clipboard\.writeText/);
  assert.match(panel, /Selesai dan aman/);
  assert.match(panel, /Laporkan \/ Pusat Keamanan/);
  assert.doesNotMatch(panel, /counterpart_alias|conversation URL|100% aman|emergency monitoring/i);
});

test("meeting notifications are deduped, metadata-empty, and accessible", () => {
  assert.match(migration, /MEETING_PLAN_PROPOSED/);
  assert.match(migration, /MEETING_PLAN_CONFIRMED/);
  assert.match(migration, /MEETING_PLAN_CANCELLED/);
  assert.match(migration, /metadata = '\{\}'::jsonb/);
  assert.match(migration, /meeting_plan_proposed:' \|\| plan\.id/);
  assert.match(notifications, /case "MEETING_PLAN_PROPOSED"/);
  assert.match(panel, /<fieldset/);
  assert.match(panel, /<legend/);
  assert.match(panel, /role="status"/);
  assert.match(panel, /sm:grid-cols-2/);
});
