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

function nextSuggestedStart(source: EventDuplicateSource, now: Date) {
  const minimumStart = now.getTime() + DAY_MS;
  let suggested = new Date(source.starts_at).getTime() + WEEK_MS;

  while (suggested < minimumStart) suggested += WEEK_MS;

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
): EventFormDefaults {
  const startsAt = nextSuggestedStart(source, now);
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
