export const EVENT_PAGE_SIZE = 12;
export const EVENT_TITLE_MIN = 5;
export const EVENT_TITLE_MAX = 100;
export const EVENT_DESCRIPTION_MIN = 20;
export const EVENT_DESCRIPTION_MAX = 1000;
export const EVENT_VENUE_NAME_MIN = 3;
export const EVENT_VENUE_NAME_MAX = 120;
export const EVENT_VENUE_AREA_MIN = 8;
export const EVENT_VENUE_AREA_MAX = 240;
export const EVENT_CITY_MIN = 2;
export const EVENT_CITY_MAX = 100;
export const EVENT_CAPACITY_MIN = 3;
export const EVENT_CAPACITY_MAX = 200;
export const EVENT_REGISTRATION_ANSWER_MAX_BYTES = 12_000;
export const EVENT_REGISTRATION_PAGE_SIZE = 50;
export const EVENT_QUESTION_PROMPT_MIN = 5;
export const EVENT_QUESTION_PROMPT_MAX = 160;
export const EVENT_QUESTION_OPTION_MAX = 80;
export const EVENT_QUESTION_OPTIONS_MAX = 12;
export const EVENT_SHORT_ANSWER_MAX = 500;
export const EVENT_TICKET_PREFIX = "SDT1.";
export const EVENT_TICKET_TOKEN_PATTERN = /^SDT1\.[A-Za-z0-9_-]{43}$/;

export const EVENT_CATEGORIES = [
  "study_together",
  "coding_tech",
  "design",
  "languages",
  "thesis",
  "exam_prep",
  "workshop",
  "discussion",
  "networking",
  "community",
  "seminar",
  "meetup",
  "hackathon",
  "other",
] as const;

export const EVENT_SCOPES = ["open", "campus"] as const;
export const EVENT_REGISTRATION_MODES = ["instant", "approval"] as const;
export const EVENT_REGISTRATION_STATUSES = [
  "pending",
  "going",
  "waitlisted",
  "declined",
  "cancelled",
] as const;
export const EVENT_QUESTION_TYPES = [
  "short_text",
  "single_select",
  "multi_select",
  "checkbox",
] as const;
export const EVENT_TEAM_ROLES = ["cohost", "checkin_staff"] as const;
export const EVENT_TEAM_STATUSES = [
  "invited",
  "active",
  "declined",
  "removed",
] as const;
export const EVENT_CHECKIN_STATUSES = [
  "checked_in",
  "duplicate",
  "invalid",
  "wrong_event",
  "revoked",
  "outside_window",
  "not_eligible",
  "rate_limited",
] as const;
export const EVENT_TIMEZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
] as const;
export const EVENT_VENUE_CATEGORIES = [
  "campus_public_area",
  "cafe",
  "library",
  "coworking_space",
  "community_space",
  "other_public_place",
] as const;
export const EVENT_REPORT_REASONS = [
  "harassment",
  "spam",
  "contact_pressure",
  "fake_or_misleading",
  "unsafe_location",
  "other",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];
export type EventScope = (typeof EVENT_SCOPES)[number];
export type EventRegistrationMode = (typeof EVENT_REGISTRATION_MODES)[number];
export type EventRegistrationStatus =
  (typeof EVENT_REGISTRATION_STATUSES)[number];
export type EventQuestionType = (typeof EVENT_QUESTION_TYPES)[number];
export type EventTeamRole = (typeof EVENT_TEAM_ROLES)[number];
export type EventTeamStatus = (typeof EVENT_TEAM_STATUSES)[number];
export type EventCheckinStatus = (typeof EVENT_CHECKIN_STATUSES)[number];
export type EventTimezone = (typeof EVENT_TIMEZONES)[number];
export type EventVenueCategory = (typeof EVENT_VENUE_CATEGORIES)[number];

export const EVENT_GENERIC_ERROR =
  "Campus Event belum dapat diperbarui. Coba lagi sebentar.";
