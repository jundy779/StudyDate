import { AppShell } from "@/components/app/app-shell";
import { EventQrScanner } from "@/components/events/event-qr-scanner";
import { getCampusEventCheckInManagement } from "@/lib/events/management";
import Link from "next/link";

type EventScanPageProps = {
  params: Promise<{ publicSlug: string }>;
};

export default async function EventScanPage({ params }: EventScanPageProps) {
  const { publicSlug } = await params;
  const { event, attendees, overview } =
    await getCampusEventCheckInManagement(publicSlug);

  return (
    <AppShell current="events">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-6 sm:py-8">
          <Link
            href={`/app/events/${event.public_slug}/manage/check-in`}
            className="focus-ring inline-flex min-h-12 items-center rounded-lg text-sm font-semibold text-brand-muted hover:text-brand-blue"
          >
            ← Kembali ke daftar kehadiran
          </Link>

          <header className="mt-4 border-b border-brand-border pb-6">
            <p className="app-kicker">Acara kampus · Pemindai cepat</p>
            <h1 className="mt-2 break-words font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl">
              Pindai tiket peserta
            </h1>
            <p className="mt-3 break-words text-sm leading-6 text-brand-muted">
              {event.title}
            </p>
            <p className="mt-2 text-sm font-medium text-brand-navy">
              {overview.checked_in_count} dari {overview.going_count} peserta sudah
              hadir.
            </p>
          </header>

          <div className="mt-6">
            <EventQrScanner
              publicSlug={event.public_slug}
              attendees={attendees}
            />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
