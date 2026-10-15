import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const detail = read("app/app/events/[publicSlug]/page.tsx");
const events = read("app/app/events/page.tsx");
const create = read("app/app/events/create/page.tsx");
const manage = read("app/app/events/[publicSlug]/manage/page.tsx");
const report = read("app/app/events/[publicSlug]/manage/report/page.tsx");
const managementShell = read("components/events/event-management-shell.tsx");
const reporting = read("lib/events/reporting.ts");
const registrations = read(
  "app/app/events/[publicSlug]/manage/registrations/page.tsx",
);
const checkIn = read("app/app/events/[publicSlug]/manage/check-in/page.tsx");
const checkInButton = read("components/events/event-manual-checkin-button.tsx");
const team = read("app/app/events/[publicSlug]/manage/team/page.tsx");
const settings = read("app/app/events/[publicSlug]/manage/settings/page.tsx");
const registrationForm = read("components/events/event-registration-form.tsx");
const managementGuard = read("lib/events/management.ts");
const service = read("lib/events/service.ts");

test("EV2UI-01 management routes use RPC authorization and safe not-found", () => {
  assert.match(managementGuard, /getCampusEventRegistrationOverview/);
  assert.match(managementGuard, /listCampusEventAttendees/);
  assert.match(
    managementGuard,
    /required === "registrations"[\s\S]*event\.can_manage_registrations[\s\S]*required === "team"[\s\S]*event\.can_manage_team/,
  );
  assert.match(managementGuard, /message\.includes\("event management required"\)/);
  assert.match(managementGuard, /throw error/);
  assert.doesNotMatch(managementGuard, /\.from\("profiles"\)/);
  assert.match(manage, /Pendaftaran/);
  assert.match(manage, /Kehadiran/);
  assert.match(manage, /Tim acara/);
  assert.match(manage, /Pengaturan/);
  assert.match(manage, /visibleDestinations/);
});

test("EV2UI-02 detail does not enumerate attendees and links organizer workspace", () => {
  assert.doesNotMatch(detail, /listCampusEventAttendees/);
  assert.doesNotMatch(detail, /SendIntroductionDialog/);
  assert.match(detail, /Direktori peserta tetap privat/);
  assert.match(detail, /Kelola acara/);
  assert.match(detail, /event\.is_official/);
  assert.match(detail, /event\.registration_mode/);
  assert.match(detail, /event\.waitlist_enabled/);
  assert.match(detail, /blockCampusEventOrganizerAction/);
  assert.match(detail, /Blokir penyelenggara/);
});

test("EV2UI-03 registration form serializes only typed question answers", () => {
  assert.match(registrationForm, /JSON\.stringify\(answers\)/);
  assert.match(registrationForm, /question\.question_public_id/);
  assert.match(registrationForm, /question\.question_type === "short_text"/);
  assert.match(registrationForm, /question\.question_type === "single_select"/);
  assert.match(registrationForm, /question\.question_type === "multi_select"/);
  assert.match(registrationForm, /question\.question_type === "checkbox"/);
  assert.match(registrationForm, /Profil yang digunakan/);
  assert.doesNotMatch(registrationForm, /email|user_id|uuid/i);
});

test("EV2UI-04 registration management is bounded, filtered, and safe", () => {
  assert.match(registrations, /listCampusEventRegistrations/);
  assert.match(registrations, /EVENT_REGISTRATION_STATUSES/);
  assert.match(registrations, /registration_answers/);
  assert.match(registrations, /name="registrationPublicId"/);
  assert.match(registrations, /value="approve"/);
  assert.match(registrations, /value="decline"/);
  assert.doesNotMatch(registrations, /email|userId|targetUserId|UUID/);
  assert.match(service, /EVENT_REGISTRATION_PAGE_SIZE \+ 1/);
});

test("EV2UI-05 check-in and team pages expose only supported operations", () => {
  assert.match(checkIn, /role="progressbar"/);
  assert.match(checkInButton, /manualCheckInCampusEventRegistrationAction/);
  assert.match(checkIn, /undoCampusEventCheckInAction/);
  assert.match(checkIn, /\/scan/);
  assert.match(team, /name="publicAlias"/);
  assert.match(team, /value="cohost"/);
  assert.match(team, /value="checkin_staff"/);
  assert.match(team, /listCampusEventTeamMembers/);
  assert.match(team, /removeCampusEventTeamMemberAction/);
  assert.doesNotMatch(team, /fake|contoh anggota|dummy/i);
});

test("EV2UI-06 settings use strict action field names", () => {
  for (const field of [
    "publicSlug",
    "registrationMode",
    "waitlistEnabled",
    "registrationClosesAt",
    "questionType",
    "prompt",
    "optionsText",
    "isRequired",
    "questionPublicId",
    "circlePublicSlug",
  ]) {
    assert.match(settings, new RegExp(`name="${field}"`));
  }
  assert.match(settings, /EventForm/);
  assert.match(settings, /cancelCampusEventAction/);
  assert.match(settings, /archiveCampusEventAction/);
  assert.match(service, /p_waitlist_enabled: input\.waitlistEnabled/);
});

test("EV2UI-06b participant-facing event copy avoids internal workspace terms", () => {
  assert.match(detail, /Pendaftaran, kehadiran, tim, dan pengaturan/);
  assert.doesNotMatch(detail, /Registrasi, check-in, team, dan settings/);
  assert.doesNotMatch(manage, />Check-in<|cohost atau petugas check-in/);
  assert.doesNotMatch(events, /Ruang kerja tim acara|Buka ruang kerja|Filter tidak valid/);
});

test("EV2UI-07 eligibility gates creation and Plus copy is not trust", () => {
  assert.match(events, /getMyEventOrganizerEligibility/);
  assert.match(events, /eligibility\?\.eligible/);
  assert.match(
    events,
    /StudyDate\s+Plus menambah kapasitas, bukan kepercayaan penyelenggara/,
  );
  assert.match(events, /listMyCampusEventTeamInvitations/);
  assert.match(events, /activeAssignments/);
  assert.match(events, /Buka pengelolaan acara/);
  assert.match(create, /getMyEventOrganizerEligibility/);
  assert.match(create, /if \(!eligibility\?\.eligible\) notFound\(\)/);
});

test("EV2UI-08 aggregate reporting stays permission-gated and privacy-safe", () => {
  assert.match(report, /getCampusEventManagement\([\s\S]*"registrations"/);
  assert.match(report, /buildCampusEventReport/);
  assert.match(report, /Tingkat kehadiran/);
  assert.match(report, /Kesiapan acara/);
  assert.match(report, /Rincian status pendaftaran/);
  assert.match(report, /Unduh daftar peserta CSV/);
  assert.match(report, /Langkah berikutnya/);
  assert.match(report, /report\.confirmationRate/);
  assert.match(report, /report\.remainingSpots/);
  assert.doesNotMatch(report, /listCampusEventRegistrations|listCampusEventAttendees/);
  assert.doesNotMatch(report, /targetUserId|user_id|UUID/);
  assert.match(managementShell, /\["report", "Laporan", "\/report"\]/);
  assert.match(
    managementShell,
    /key !== "registrations" && key !== "report"[\s\S]*event\.can_manage_registrations/,
  );
  assert.match(reporting, /Math\.min\(100, Math\.max\(0/);
  assert.match(reporting, /overview\.checked_in_count, overview\.going_count/);
  assert.match(reporting, /event\.scope === "open" && event\.is_official/);
});

test("EV2UI-09 organizer surfaces use plain Indonesian operational copy", () => {
  const surfaces = [events, create, detail, registrations, checkIn, team, settings]
    .join("\n");
  assert.doesNotMatch(
    surfaces,
    /Team invitations|Campus Events|Checked in|Not yet|Custom questions|Event detail|Instant|Approval/,
  );
  for (const copy of [
    "Undangan tim",
    "Daftar tunggu",
    "Sudah hadir",
    "Pertanyaan tambahan",
    "Perlu persetujuan penyelenggara",
  ]) {
    assert.match(surfaces, new RegExp(copy));
  }
});
