import type {
  CampusEventDetail,
  CampusEventRegistrationOverview,
} from "@/lib/events/service";
import { appButton } from "@/components/app/ui";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const sections = [
  ["overview", "Ringkasan", ""],
  ["registrations", "Pendaftaran", "/registrations"],
  ["tickets", "Tiket", "/tickets"],
  ["report", "Laporan", "/report"],
  ["check-in", "Kehadiran", "/check-in"],
  ["team", "Tim", "/team"],
  ["after", "Setelah acara", "/after"],
  ["settings", "Pengaturan", "/settings"],
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
  const visibleSections = sections.filter(
    ([key]) =>
      ((key !== "registrations" && key !== "report" && key !== "tickets") ||
        event.can_manage_registrations) &&
      (key !== "tickets" || process.env.EVENT_TICKETING_ENABLED === "true") &&
      (key !== "check-in" || event.can_check_in) &&
      ((key !== "team" && key !== "settings" && key !== "after") || event.can_manage_team),
  );

  return (
    <div className="page-shell py-8 sm:py-12 lg:py-16">
      <Link
        href="/app/events"
        className={appButton.quiet}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Acara Kampus
      </Link>

      <header className="mt-6 border-b-2 border-dashed border-brand-navy/15 pb-7">
        <p className="app-kicker">Ruang penyelenggara</p>
        <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="break-words font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl">
              {event.title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              Kelola pendaftaran dan kehadiran tanpa membuka email, nama asli, atau
              kontak peserta.
            </p>
          </div>
          <Link
            href={`/app/events/${event.public_slug}`}
            className={`${appButton.secondary} shrink-0`}
          >
            Lihat acara
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {overview ? (
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Terkonfirmasi", `${overview.going_count}/${event.capacity}`],
              ["Menunggu", overview.pending_count],
              ["Daftar tunggu", overview.waitlisted_count],
              ["Sudah hadir", overview.checked_in_count],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border-2 border-brand-navy bg-white p-4 shadow-[3px_3px_0_#0F1B33]">
                <dt className="text-xs font-semibold text-brand-muted">
                  {label}
                </dt>
                <dd className="mt-1 font-heading text-2xl font-semibold text-brand-navy">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </header>

      <nav
        aria-label="Navigasi pengelolaan acara"
        className="mt-5"
      >
        <div className="flex flex-wrap gap-2">
          {visibleSections.map(([key, label, suffix]) => (
            <Link
              key={key}
              href={`${base}${suffix}`}
              aria-current={active === key ? "page" : undefined}
              className={`focus-ring inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold ${
                active === key
                  ? "border-2 border-brand-navy bg-brand-navy text-white"
                  : "border border-brand-border bg-white text-brand-navy hover:border-brand-navy"
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
