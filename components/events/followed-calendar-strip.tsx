import Link from "next/link";
import type { FollowedCalendarEvent } from "@/lib/circles/calendar";
import { eventTimezoneLabel } from "@/lib/events/presentation";

function whenLabel(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FollowedCalendarStrip({ events }: { events: FollowedCalendarEvent[] }) {
  if (!events.length) return null;

  return (
    <section aria-labelledby="followed-calendar-title">
      <p className="font-hand text-xl text-brand-blue">Dari kalender yang kamu ikuti</p>
      <h2 id="followed-calendar-title" className="sr-only">
        Acara dari kalender Circle yang kamu ikuti
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => (
          <li key={event.public_slug}>
            <Link
              href={`/app/events/${event.public_slug}`}
              className="focus-ring group block h-full rounded-2xl border-2 border-brand-navy bg-white p-4 shadow-[3px_3px_0_#0F1B33] transition-transform hover:-translate-y-0.5"
            >
              <p className="text-sm font-semibold text-brand-blue">
                {whenLabel(event.starts_at, event.timezone_name)} {eventTimezoneLabel(event.timezone_name)}
              </p>
              <p className="mt-1 break-words font-heading text-lg font-semibold leading-snug text-brand-navy">
                {event.title}
              </p>
              <p className="mt-2 text-sm text-brand-muted">
                {event.circle_name} · {event.venue_name}, {event.city}
              </p>
              {event.rsvp_status === "going" ? (
                <span className="mt-3 inline-flex rounded-full bg-[#EAF1FF] px-3 py-1 text-xs font-semibold text-brand-blue">
                  Kamu terdaftar
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
