import { AppShell } from "@/components/app/app-shell";
import { EventManagementShell } from "@/components/events/event-management-shell";
import { getCampusEventManagement } from "@/lib/events/management";
import {
  BarChart3,
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
    title: "Pendaftaran",
    description: "Tinjau status, jawaban, dan keputusan pendaftaran.",
    icon: ClipboardList,
  },
  {
    permission: "registrations",
    suffix: "/report",
    title: "Laporan & kesiapan",
    description: "Lihat ringkasan pendaftaran, kehadiran, dan hal yang perlu disiapkan.",
    icon: BarChart3,
  },
  {
    permission: "check-in",
    suffix: "/check-in",
    title: "Kehadiran",
    description: "Pantau peserta yang sudah hadir dan catat kehadiran mereka.",
    icon: QrCode,
  },
  {
    permission: "team",
    suffix: "/team",
    title: "Tim acara",
    description: "Undang rekan penyelenggara atau petugas kehadiran melalui alias.",
    icon: UserRoundCog,
  },
  {
    permission: "team",
    suffix: "/settings",
    title: "Pengaturan",
    description: "Atur detail acara, pendaftaran, pertanyaan, dan status acara.",
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
            <p className="section-label">Ringkasan</p>
            <h2
              id="manage-overview-title"
              className="mt-2 font-heading text-2xl font-semibold text-brand-navy"
            >
              Kelola acara dari satu tempat
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-brand-muted">
              Pilih bagian yang ingin dikelola. Informasi akun dan kontak pribadi
              peserta tidak tersedia di ruang penyelenggara.
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
                Kehadiran dari daftar peserta atau tiket QR hanya dapat dicatat
                mulai dua jam sebelum sampai dua jam setelah acara.
              </p>
            </aside>
          </section>
        </EventManagementShell>
      </main>
    </AppShell>
  );
}
