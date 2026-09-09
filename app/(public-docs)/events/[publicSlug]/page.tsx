import { JsonLd } from "@/components/marketing/json-ld";
import { eventSlugSchema } from "@/lib/events/validation";
import {
  EVENT_CATEGORY_LABELS,
  EVENT_VENUE_LABELS,
  eventTimezoneLabel,
  formatEventDateTime,
} from "@/lib/events/presentation";
import { getPublicCampusEvent } from "@/lib/events/public-service";
import { getPublicSiteUrl } from "@/lib/marketing/site-origin";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Clock3,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type EventDetailProps = {
  params: Promise<{ publicSlug: string }>;
};

async function resolveEvent(rawSlug: string) {
  const slug = eventSlugSchema.safeParse(rawSlug);
  if (!slug.success) return null;
  return getPublicCampusEvent(slug.data).catch(() => null);
}

export async function generateMetadata({ params }: EventDetailProps): Promise<Metadata> {
  const { publicSlug } = await params;
  const event = await resolveEvent(publicSlug);
  if (!event) return { title: "Acara tidak ditemukan — StudyDate ID" };
  const description = event.description.slice(0, 160);
  return {
    title: `${event.title} — StudyDate ID`,
    description,
    alternates: { canonical: `/events/${event.public_slug}` },
    openGraph: {
      title: event.title,
      description,
      url: `/events/${event.public_slug}`,
      type: "website",
    },
  };
}

export default async function PublicEventDetailPage({ params }: EventDetailProps) {
  const { publicSlug } = await params;
  const event = await resolveEvent(publicSlug);
  if (!event) notFound();

  const full = event.attendee_count >= event.capacity;
  const registrationClosed = Boolean(event.registration_closes_at) &&
    new Date(event.registration_closes_at!).getTime() <= Date.now();
  const registrationLabel = registrationClosed
    ? "Pendaftaran sudah ditutup"
    : full && event.waitlist_enabled
      ? "Daftar ke antrean"
      : full
        ? "Kuota sudah penuh"
        : event.registration_mode === "approval"
          ? "Ajukan pendaftaran"
          : "Daftar ke acara";

  return (
    <article>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Event",
          name: event.title,
          description: event.description,
          startDate: event.starts_at,
          endDate: event.ends_at,
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          url: getPublicSiteUrl(`/events/${event.public_slug}`),
          location: {
            "@type": "Place",
            name: event.venue_name,
            address: `${event.venue_area}, ${event.city}`,
          },
          organizer: {
            "@type": "Person",
            name: event.organizer_alias,
          },
        }}
      />

      <section className="border-b border-brand-border bg-brand-surface py-12 sm:py-16">
        <div className="page-shell">
          <Link
            href="/events"
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-brand-muted hover:text-brand-blue"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali ke semua acara
          </Link>

          <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-brand-blue">
                <span>{EVENT_CATEGORY_LABELS[event.category]}</span>
                <span className="inline-flex items-center gap-1 text-brand-navy">
                  <BadgeCheck className="h-4 w-4 text-brand-blue" aria-hidden="true" />
                  Acara resmi StudyDate
                </span>
              </div>
              <h1 className="mt-4 max-w-4xl break-words font-heading text-4xl font-semibold leading-tight tracking-[-0.035em] text-brand-navy sm:text-5xl">
                {event.title}
              </h1>
              <p className="mt-6 max-w-3xl whitespace-pre-wrap break-words text-lg leading-8 text-brand-muted">
                {event.description}
              </p>
              <p className="mt-5 text-sm text-brand-muted">
                Diselenggarakan oleh <strong className="font-semibold text-brand-navy">{event.organizer_alias}</strong>
                {event.organizer_is_verified ? " · mahasiswa terverifikasi" : ""}
              </p>
            </div>

            <aside className="rounded-[22px] border border-brand-border bg-white p-6 sm:p-7">
              <p className="font-heading text-xl font-semibold text-brand-navy">
                {registrationLabel}
              </p>
              <p className="mt-3 text-sm leading-6 text-brand-muted">
                Masuk ke akun StudyDate untuk mendaftar. Identitas dan daftar peserta
                tidak ditampilkan pada halaman publik.
              </p>
              {!registrationClosed && (!full || event.waitlist_enabled) ? (
                <Link
                  href="/login"
                  className="focus-ring mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
                >
                  Masuk untuk mendaftar
                </Link>
              ) : null}
              <Link
                href={`/app/events/${event.public_slug}`}
                className="focus-ring mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-brand-border px-5 text-sm font-semibold text-brand-navy"
              >
                Buka di ruang mahasiswa
              </Link>
            </aside>
          </div>
        </div>
      </section>

      <section className="page-shell py-12 sm:py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [CalendarDays, "Mulai", formatEventDateTime(event.starts_at, event.timezone_name)],
            [Clock3, "Selesai", `${formatEventDateTime(event.ends_at, event.timezone_name)} ${eventTimezoneLabel(event.timezone_name)}`],
            [MapPin, EVENT_VENUE_LABELS[event.venue_category], `${event.venue_name}, ${event.venue_area}, ${event.city}`],
            [UsersRound, "Kapasitas", `${event.attendee_count} terdaftar dari ${event.capacity} peserta`],
          ].map(([Icon, label, value]) => {
            const DetailIcon = Icon as typeof CalendarDays;
            return (
              <div key={label as string} className="border-t-2 border-brand-navy pt-5">
                <DetailIcon className="h-5 w-5 text-brand-blue" aria-hidden="true" />
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-brand-muted">{label as string}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-brand-navy">{value as string}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 grid gap-6 border-y border-brand-border py-8 lg:grid-cols-2">
          <div className="flex gap-4">
            <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-brand-blue" aria-hidden="true" />
            <div>
              <h2 className="font-heading text-xl font-semibold text-brand-navy">Bertemu di tempat umum</h2>
              <p className="mt-2 leading-7 text-brand-muted">
                Lokasi acara harus berupa tempat publik. Tetap beri tahu orang
                terpercaya dan pertahankan kendali atas transportasimu sendiri.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <LockKeyhole className="mt-1 h-6 w-6 shrink-0 text-brand-blue" aria-hidden="true" />
            <div>
              <h2 className="font-heading text-xl font-semibold text-brand-navy">Daftar peserta tetap privat</h2>
              <p className="mt-2 leading-7 text-brand-muted">
                Halaman ini tidak membuka nama asli, kontak, atau daftar peserta.
                Interaksi lanjutan tetap mengikuti persetujuan di dalam StudyDate.
              </p>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
