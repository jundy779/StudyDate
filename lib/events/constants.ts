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
export const EVENT_CAPACITY_MAX = 30;

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
  "other",
] as const;

export const EVENT_SCOPES = ["open", "campus"] as const;
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
export type EventTimezone = (typeof EVENT_TIMEZONES)[number];
export type EventVenueCategory = (typeof EVENT_VENUE_CATEGORIES)[number];

export const EVENT_GENERIC_ERROR =
  "Campus Event belum dapat diperbarui. Coba lagi sebentar.";
