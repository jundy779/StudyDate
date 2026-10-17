import type { EventUpdateInput } from "@/lib/events/validation";
import type { CampusEventSeriesSession } from "@/lib/events/service";

export type EventSeriesUpdateScope = "current" | "following" | "all";

function offsetForTimezone(timezone: string) {
  if (timezone === "Asia/Makassar") return "+08:00";
  if (timezone === "Asia/Jayapura") return "+09:00";
  return "+07:00";
}

function localTimestamp(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function clock(value: string) {
  return Date.parse(`${value}:00Z`);
}

function shifted(value: string, milliseconds: number) {
  return new Date(clock(value) + milliseconds).toISOString().slice(0, 16);
}

export function planEventSeriesUpdates(input: {
  sessions: CampusEventSeriesSession[];
  targetSlug: string;
  scope: EventSeriesUpdateScope;
  update: EventUpdateInput;
  now?: Date;
}) {
  const target = input.sessions.find(
    (session) => session.public_slug === input.targetSlug,
  );
  if (!target || input.scope === "current") {
    return [{ publicSlug: input.targetSlug, update: input.update }];
  }

  const now = input.now ?? new Date();
  const oldTargetStart = localTimestamp(
    target.starts_at,
    input.update.timezone,
  );
  const startShift = clock(input.update.startsAtLocal) - clock(oldTargetStart);
  const duration =
    clock(input.update.endsAtLocal) - clock(input.update.startsAtLocal);
  const registrationOffset = input.update.registrationClosesAt
    ? new Date(input.update.registrationClosesAt).getTime() -
      new Date(
        `${input.update.startsAtLocal}:00${offsetForTimezone(input.update.timezone)}`,
      ).getTime()
    : null;

  return input.sessions
    .filter((session) => {
      if (session.status !== "scheduled") return false;
      if (new Date(session.starts_at).getTime() <= now.getTime() + 2 * 60 * 60 * 1000) {
        return false;
      }
      return input.scope === "all"
        ? true
        : session.series_position >= target.series_position;
    })
    .map((session) => {
      if (session.public_slug === input.targetSlug) {
        return { publicSlug: session.public_slug, update: input.update };
      }
      const startsAtLocal = shifted(
        localTimestamp(session.starts_at, input.update.timezone),
        startShift,
      );
      const endsAtLocal = shifted(startsAtLocal, duration);
      const startIso = new Date(
        `${startsAtLocal}:00${offsetForTimezone(input.update.timezone)}`,
      );
      return {
        publicSlug: session.public_slug,
        update: {
          ...input.update,
          startsAtLocal,
          endsAtLocal,
          registrationClosesAt:
            registrationOffset === null
              ? undefined
              : new Date(startIso.getTime() + registrationOffset).toISOString(),
        },
      };
    });
}
