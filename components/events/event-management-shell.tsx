import type {
  CampusEventDetail,
  CampusEventRegistrationOverview,
} from "@/lib/events/service";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const sections = [
  ["overview", "Overview", ""],
  ["registrations", "Registrations", "/registrations"],
  ["check-in", "Check-In", "/check-in"],
  ["team", "Team", "/team"],
  ["settings", "Settings", "/settings"],
] as const;

export function EventManagementShell({
  active,
  event,
  overview,
  children,
}: {
  active: (typeof sections)[number][0];
  event: CampusEventDetail;
  overview?: CampusEventRegistrationOverview | null;
  children: ReactNode;
}) {
  const base = `/app/events/${event.public_slug}/manage`;

  return (
    <div className="page-shell py-8 sm:py-12 lg:py-16">
      <Link
        href="/app/events"
        className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-brand-muted hover:text-brand-blue"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Campus Events
      </Link>

      <header className="mt-6 border-b border-brand-border pb-7">
        <p className="section-label">Organizer workspace</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="break-words font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl">
              {event.title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              Kelola registrasi dan kehadiran tanpa membuka email, identitas privat,
              atau kontak peserta.
            </p>
          </div>
          <Link
            href={`/app/events/${event.public_slug}`}
            className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy"
          >
            View Event
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {overview ? (
          <dl className="mt-7 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-brand-border pt-5 sm:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-muted">
                Confirmed
              </dt>
              <dd className="mt-1 font-heading text-2xl font-semibold text-brand-navy">
                {overview.going_count}/{event.capacity}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-muted">
                Pending
              </dt>
              <dd className="mt-1 font-heading text-2xl font-semibold text-brand-navy">
                {overview.pending_count}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-muted">
                Waitlist
              </dt>
              <dd className="mt-1 font-heading text-2xl font-semibold text-brand-navy">
                {overview.waitlisted_count}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-muted">
                Checked In
              </dt>
              <dd className="mt-1 font-heading text-2xl font-semibold text-brand-navy">
                {overview.checked_in_count}
              </dd>
            </div>
          </dl>
        ) : null}
      </header>

      <nav
        aria-label="Navigasi pengelolaan Event"
        className="-mx-1 overflow-x-auto border-b border-brand-border"
      >
        <div className="flex min-w-max gap-1 px-1">
          {sections.map(([key, label, suffix]) => (
            <Link
              key={key}
              href={`${base}${suffix}`}
              aria-current={active === key ? "page" : undefined}
              className={`focus-ring inline-flex min-h-12 items-center border-b-2 px-3 text-sm font-semibold ${
                active === key
                  ? "border-brand-blue text-brand-blue"
                  : "border-transparent text-brand-muted hover:text-brand-navy"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="py-8">{children}</div>
    </div>
  );
}
