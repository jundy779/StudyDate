import type {
  EventCategory,
  EventRegistrationMode,
  EventScope,
  EventVenueCategory,
} from "@/lib/events/constants";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MAX_SCHEDULE_AHEAD_MS = 180 * DAY_MS;

export const EVENT_DUPLICATE_CADENCES = ["weekly", "monthly"] as const;
export type EventDuplicateCadence = (typeof EVENT_DUPLICATE_CADENCES)[number];

export type EventFormDefaults = {
  title: string;
  description: string;
  category: EventCategory;
  scope: EventScope;
  starts_at: string;
  ends_at: string;
  timezone_name: string;
  venue_category: EventVenueCategory;
  venue_name: string;
  venue_area: string;
  city: string;
  capacity: number;
  registration_mode: EventRegistrationMode;
  waitlist_enabled: boolean;
  registration_closes_at: string | null;
};

export type EventDuplicateSource = EventFormDefaults & {
  public_slug: string;
};

function safeDuration(source: EventDuplicateSource) {
  const duration =
    new Date(source.ends_at).getTime() - new Date(source.starts_at).getTime();
  return Math.min(12 * HOUR_MS, Math.max(30 * 60 * 1000, duration));
}

function timezoneOffsetHours(timezone: string) {
  switch (timezone) {
    case "Asia/Makassar":
      return 8;
    case "Asia/Jayapura":
      return 9;
    default:
      return 7;
  }
}

function localDateParts(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value ?? 0);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

function addCalendarMonths(source: EventDuplicateSource, monthCount: number) {
  const parts = localDateParts(source.starts_at, source.timezone_name);
  const monthIndex = parts.year * 12 + parts.month - 1 + monthCount;
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(parts.day, lastDay);
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      parts.hour - timezoneOffsetHours(source.timezone_name),
      parts.minute,
      parts.second,
    ),
  );
}

function nextSuggestedStart(
  source: EventDuplicateSource,
  now: Date,
  cadence: EventDuplicateCadence,
) {
  const minimumStart = now.getTime() + DAY_MS;
  let suggested: number;

  if (cadence === "monthly") {
    let monthCount = 1;
    suggested = addCalendarMonths(source, monthCount).getTime();
    while (suggested < minimumStart) {
      monthCount += 1;
      suggested = addCalendarMonths(source, monthCount).getTime();
    }
  } else {
    suggested = new Date(source.starts_at).getTime() + WEEK_MS;
    while (suggested < minimumStart) suggested += WEEK_MS;
  }

  if (suggested > now.getTime() + MAX_SCHEDULE_AHEAD_MS) {
    const fallback = new Date(minimumStart);
    fallback.setUTCMinutes(0, 0, 0);
    return fallback;
  }

  return new Date(suggested);
}

export function buildEventDuplicateDefaults(
  source: EventDuplicateSource,
  now = new Date(),
  cadence: EventDuplicateCadence = "weekly",
): EventFormDefaults {
  const startsAt = nextSuggestedStart(source, now, cadence);
  const endsAt = new Date(startsAt.getTime() + safeDuration(source));

  return {
    title: source.title,
    description: source.description,
    category: source.category,
    scope: source.scope,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    timezone_name: source.timezone_name,
    venue_category: source.venue_category,
    venue_name: source.venue_name,
    venue_area: source.venue_area,
    city: source.city,
    capacity: source.capacity,
    registration_mode: source.registration_mode,
    waitlist_enabled: source.waitlist_enabled,
    registration_closes_at: null,
  };
}

export function parseEventDuplicateCadence(
  value: unknown,
): EventDuplicateCadence {
  return value === "monthly" ? "monthly" : "weekly";
}
