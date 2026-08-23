import { AppShell } from "@/components/app/app-shell";
import { EventManagementShell } from "@/components/events/event-management-shell";
import { getCampusEventManagement } from "@/lib/events/management";
import {
  CalendarCheck,
  ClipboardList,
  QrCode,
  Settings,
  UserRoundCog,
} from "lucide-react";
import Link from "next/link";

type EventManagePageProps = {
  params: Promise<{ publicSlug: string }>;
};

const destinations = [
  {
    permission: "registrations",
    suffix: "/registrations",
    title: "Registrations",
    description: "Tinjau status, jawaban aman, dan keputusan registrasi.",
    icon: ClipboardList,
  },
  {
    permission: "check-in",
    suffix: "/check-in",
    title: "Check-In",
    description: "Pantau kehadiran dan lakukan check-in manual.",
    icon: QrCode,
  },
  {
    permission: "team",
    suffix: "/team",
    title: "Team",
    description: "Undang cohost atau petugas check-in melalui alias tepat.",
    icon: UserRoundCog,
  },
  {
    permission: "team",
    suffix: "/settings",
    title: "Settings",
    description: "Atur registrasi, pertanyaan, detail, dan lifecycle Event.",
    icon: Settings,
  },
] as const;

export default async function EventManagePage({ params }: EventManagePageProps) {
  const { publicSlug } = await params;
  const { event, overview } = await getCampusEventManagement(publicSlug);
  const base = `/app/events/${event.public_slug}/manage`;
  const visibleDestinations = destinations.filter(({ permission }) => {
    if (permission === "registrations") return event.can_manage_registrations;
    if (permission === "check-in") return event.can_check_in;
    return event.can_manage_team;
  });

  return (
    <AppShell current="events">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <EventManagementShell active="overview" event={event} overview={overview}>
          <section aria-labelledby="manage-overview-title">
            <p className="section-label">Overview</p>
            <h2
              id="manage-overview-title"
              className="mt-2 font-heading text-2xl font-semibold text-brand-navy"
            >
              Operasikan Event dari satu tempat
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-brand-muted">
              Data di workspace ini dibatasi pada projection organizer yang aman.
              Informasi akun dan kontak peserta tidak tersedia.
            </p>

            <div className="mt-7 divide-y divide-brand-border border-y border-brand-border">
              {visibleDestinations.map(({ suffix, title, description, icon: Icon }) => (
                <Link
                  key={suffix}
                  href={`${base}${suffix}`}
                  className="focus-ring group grid min-h-24 gap-3 py-5 sm:grid-cols-[36px_minmax(0,1fr)_auto] sm:items-center"
                >
                  <Icon className="h-5 w-5 text-brand-blue" aria-hidden="true" />
                  <span>
                    <span className="block font-heading text-lg font-semibold text-brand-navy">
                      {title}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-brand-muted">
                      {description}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-brand-blue group-hover:underline">
                    Buka →
                  </span>
                </Link>
              ))}
            </div>

            <aside className="mt-8 flex max-w-3xl items-start gap-3 border-l-2 border-brand-blue pl-4 text-sm leading-7 text-brand-muted">
              <CalendarCheck className="mt-1 h-4 w-4 shrink-0 text-brand-blue" aria-hidden="true" />
              <p>
                Check-in manual dan QR hanya diproses pada jendela dua jam sebelum
                sampai dua jam setelah Event.
              </p>
            </aside>
          </section>
        </EventManagementShell>
      </main>
    </AppShell>
  );
}
