import {
  EVENT_CATEGORY_LABELS,
  formatEventDateTime,
  formatEventDay,
} from "@/lib/events/presentation";
import type { PublicCampusEvent } from "@/lib/events/public-service";
import {
  ArrowUpRight,
  BadgeCheck,
  MapPin,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

export function PublicEventCard({ event }: { event: PublicCampusEvent }) {
  const dateParts = formatEventDay(event.starts_at, event.timezone_name);
  const day = dateParts.find((part) => part.type === "day")?.value;
  const month = dateParts.find((part) => part.type === "month")?.value;

  return (
    <article className="grid gap-6 border-t border-brand-border py-7 first:border-t-0 first:pt-0 sm:grid-cols-[76px_minmax(0,1fr)_auto] sm:items-start">
      <time
        dateTime={event.starts_at}
        className="flex items-baseline gap-2 sm:block sm:text-center"
      >
        <span className="block font-heading text-3xl font-semibold text-brand-navy">
          {day}
        </span>
        <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">
          {month}
        </span>
      </time>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold text-brand-blue">
          <span>{EVENT_CATEGORY_LABELS[event.category]}</span>
          <span className="inline-flex items-center gap-1 text-brand-navy">
            <BadgeCheck className="h-4 w-4 text-brand-blue" aria-hidden="true" />
            Acara resmi
          </span>
        </div>
        <h2 className="mt-3 break-words font-heading text-2xl font-semibold tracking-[-0.025em] text-brand-navy">
          {event.title}
        </h2>
        <p className="mt-3 max-w-2xl line-clamp-2 text-sm leading-7 text-brand-muted">
          {event.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-muted">
          <span>{formatEventDateTime(event.starts_at, event.timezone_name)}</span>
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {event.venue_name}, {event.city}
          </span>
          <span className="inline-flex items-center gap-2">
            <UsersRound className="h-4 w-4" aria-hidden="true" />
            {event.attendee_count} dari {event.capacity} peserta
          </span>
        </div>
      </div>

      <Link
        href={`/events/${event.public_slug}`}
        className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-blue px-4 text-sm font-semibold text-brand-blue transition-colors hover:bg-brand-blue hover:text-white"
      >
        Lihat detail
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </article>
  );
}
