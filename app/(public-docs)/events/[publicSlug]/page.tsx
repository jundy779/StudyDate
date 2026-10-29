import { JsonLd } from "@/components/marketing/json-ld";
import { PublicEventActions } from "@/components/events/public-event-actions";
import { EventCover } from "@/components/events/event-cover";
import { buildGoogleCalendarUrl } from "@/lib/events/calendar";
import { eventSlugSchema } from "@/lib/events/validation";
import {
  EVENT_CATEGORY_LABELS,
  EVENT_VENUE_LABELS,
  eventTimezoneLabel,
  formatEventDateTime,
} from "@/lib/events/presentation";
import { getPublicCampusEvent } from "@/lib/events/public-service";
import { eventCoverUrl } from "@/lib/events/online";
import { getPublicSiteUrl } from "@/lib/marketing/site-origin";
import {
  ArrowLeft,
  BadgeCheck,
  Globe2,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

/** Bulan singkat dan tanggal untuk ikon kalender, mengikuti zona waktu acara. */
function calendarMonth(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: timezone }).format(new Date(value)).replace(".", "");
}

function calendarDay(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", timeZone: timezone }).format(new Date(value));
}

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
  if (!event) return { title: "Acara tidak ditemukan | StudyDate ID" };
  const description = event.description.slice(0, 160);
  return {
    title: `${event.title} | StudyDate ID`,
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

async function PublicEventDetailContent({ params }: EventDetailProps) {
  const { publicSlug } = await params;
  const event = await resolveEvent(publicSlug);
  if (!event) notFound();

  const coverUrl = eventCoverUrl(event.cover_path);
  const full = event.attendee_count >= event.capacity;
  const registrationClosed = !event.registration_open;
  const registrationLabel = registrationClosed
    ? "Pendaftaran sudah ditutup"
    : full && event.waitlist_enabled
      ? "Daftar ke antrean"
      : full
        ? "Kuota sudah penuh"
        : event.registration_mode === "approval"
          ? "Ajukan pendaftaran"
          : "Daftar ke acara";
  const publicUrl = getPublicSiteUrl(`/events/${event.public_slug}`);
  const calendarEvent = {
    publicSlug: event.public_slug,
    title: event.title,
    description: event.description,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    timezone: event.timezone_name,
    venue:
      event.attendance_mode === "online"
        ? `Online lewat ${event.venue_name}. Link ada di halaman acara StudyDate setelah terdaftar.`
        : `${event.venue_name}, ${event.venue_area}, ${event.city}`,
    publicUrl,
  };
  const physicalPlace = {
    "@type": "Place",
    name: event.venue_name,
    address: `${event.venue_area}, ${event.city}`,
  };
  // URL VirtualLocation sengaja halaman acara, bukan link rapat.
  const virtualPlace = { "@type": "VirtualLocation", url: publicUrl };
  const isOnline = event.attendance_mode === "online";

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
          eventAttendanceMode: isOnline
            ? "https://schema.org/OnlineEventAttendanceMode"
            : event.attendance_mode === "hybrid"
              ? "https://schema.org/MixedEventAttendanceMode"
              : "https://schema.org/OfflineEventAttendanceMode",
          url: publicUrl,
          ...(coverUrl ? { image: [coverUrl] } : {}),
          location: isOnline
            ? virtualPlace
            : event.attendance_mode === "hybrid"
              ? [physicalPlace, virtualPlace]
              : physicalPlace,
          organizer: {
            "@type": "Person",
            name: event.organizer_alias,
          },
        }}
      />

      <section className="bg-brand-surface py-8 sm:py-12">
        <div className="page-shell">
          <Link
            href="/events"
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy hover:border-brand-navy"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali ke semua acara
          </Link>

          {/* Dua kolom: poster dan info pendukung di kiri, judul, waktu, tempat, dan pendaftaran di kanan. */}
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-x-12">
            <div className="mx-auto w-full max-w-md lg:col-start-1 lg:row-start-1 lg:max-w-none">
              <EventCover
                category={event.category}
                title={event.title}
                city={isOnline ? "Online" : event.city}
                variant="poster"
                className="w-full"
                coverUrl={coverUrl}
              />
            </div>

            <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                <span className="rounded-full bg-[#EAF1FF] px-2.5 py-0.5 text-brand-blue">
                  {EVENT_CATEGORY_LABELS[event.category]}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#E3F6E9] px-2.5 py-0.5 text-[#157F3B]">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Acara resmi StudyDate
                </span>
              </div>
              <h1 className="mt-4 break-words font-heading text-4xl font-semibold leading-[1.05] tracking-[-0.035em] text-brand-navy sm:text-5xl">
                {event.title}
              </h1>

              <dl className="mt-6 grid gap-4">
                <div className="flex items-center gap-4">
                  <dt className="sr-only">Tanggal dan waktu</dt>
                  <span
                    className="grid h-14 w-14 shrink-0 grid-rows-[auto_1fr] overflow-hidden rounded-xl border-2 border-brand-navy bg-white text-center shadow-[2px_2px_0_#0F1B33]"
                    aria-hidden="true"
                  >
                    <span className="bg-brand-navy py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      {calendarMonth(event.starts_at, event.timezone_name)}
                    </span>
                    <span className="grid place-items-center font-heading text-xl font-semibold text-brand-navy">
                      {calendarDay(event.starts_at, event.timezone_name)}
                    </span>
                  </span>
                  <dd className="min-w-0">
                    <p className="font-semibold text-brand-navy">
                      <time dateTime={event.starts_at}>{formatEventDateTime(event.starts_at, event.timezone_name)}</time>
                    </p>
                    <p className="text-sm text-brand-muted">
                      Sampai <time dateTime={event.ends_at}>{formatEventDateTime(event.ends_at, event.timezone_name)}</time>{" "}
                      {eventTimezoneLabel(event.timezone_name)}
                    </p>
                  </dd>
                </div>
                <div className="flex items-center gap-4">
                  <dt className="sr-only">{isOnline ? "Acara online" : EVENT_VENUE_LABELS[event.venue_category]}</dt>
                  <span
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border-2 border-brand-navy bg-white text-brand-blue shadow-[2px_2px_0_#0F1B33]"
                    aria-hidden="true"
                  >
                    {isOnline ? <Globe2 className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
                  </span>
                  <dd className="min-w-0">
                    <p className="break-words font-semibold text-brand-navy">
                      {isOnline ? `Online lewat ${event.venue_name}` : event.venue_name}
                    </p>
                    <p className="break-words text-sm text-brand-muted">
                      {isOnline
                        ? "Link dibagikan ke peserta yang sudah terdaftar."
                        : `${event.venue_area}, ${event.city}${event.attendance_mode === "hybrid" ? " · Bisa juga ikut online" : ""}`}
                    </p>
                  </dd>
                </div>
              </dl>

              <section
                aria-labelledby="public-registration-title"
                className="mt-8 rounded-[22px] border-2 border-brand-navy bg-white p-5 shadow-[4px_4px_0_#0F1B33] sm:p-6"
              >
                <h2 id="public-registration-title" className="font-heading text-lg font-semibold text-brand-navy">
                  {registrationLabel}
                </h2>
                <p className="mt-2 text-sm leading-6 text-brand-muted">
                  Masuk ke akun StudyDate untuk mendaftar. Identitas dan daftar peserta
                  tidak ditampilkan pada halaman publik.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  {!registrationClosed && (!full || event.waitlist_enabled) ? (
                    <Link
                      href="/login"
                      className="focus-ring inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-brand-navy bg-brand-blue px-5 text-sm font-semibold text-white shadow-[3px_3px_0_#0F1B33]"
                    >
                      Masuk untuk mendaftar
                    </Link>
                  ) : null}
                  <Link
                    href={`/app/events/${event.public_slug}`}
                    className="focus-ring inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-brand-border px-5 text-sm font-semibold text-brand-navy hover:border-brand-navy"
                  >
                    Buka di ruang mahasiswa
                  </Link>
                </div>
                <PublicEventActions
                  calendarDownloadHref={`/events/${event.public_slug}/calendar.ics`}
                  eventSlug={event.public_slug}
                  googleCalendarHref={buildGoogleCalendarUrl(calendarEvent)}
                  shareUrl={publicUrl}
                  title={event.title}
                />
              </section>

              <section className="mt-10" aria-labelledby="public-about-title">
                <h2 id="public-about-title" className="border-b border-brand-border pb-2 text-sm font-semibold text-brand-muted">
                  Tentang acara
                </h2>
                <p className="mt-4 whitespace-pre-wrap break-words text-base leading-8 text-brand-navy">
                  {event.description}
                </p>
              </section>
            </div>

            <aside className="grid min-w-0 content-start gap-6 lg:col-start-1 lg:row-start-2" aria-label="Penyelenggara dan keamanan">
              <section aria-labelledby="public-host-title">
                <h2 id="public-host-title" className="border-b border-brand-border pb-2 text-sm font-semibold text-brand-muted">
                  Diselenggarakan oleh
                </h2>
                <p className="mt-3 inline-flex items-center gap-1.5 break-words font-semibold text-brand-navy">
                  {event.organizer_alias}
                  {event.organizer_is_verified ? (
                    <BadgeCheck className="h-4 w-4 shrink-0 text-brand-blue" aria-label="Mahasiswa terverifikasi" />
                  ) : null}
                </p>
              </section>

              <section aria-labelledby="public-capacity-title">
                <h2 id="public-capacity-title" className="border-b border-brand-border pb-2 text-sm font-semibold text-brand-muted">
                  Peserta
                </h2>
                <p className="mt-3 inline-flex items-center gap-1.5 font-semibold text-brand-navy">
                  <UsersRound className="h-4 w-4 text-brand-blue" aria-hidden="true" />
                  {event.attendee_count} terdaftar dari {event.capacity} peserta
                </p>
              </section>

              <section className="flex gap-3" aria-labelledby="public-safety-title">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" />
                <div>
                  {isOnline ? (
                    <>
                      <h2 id="public-safety-title" className="font-semibold text-brand-navy">Link hanya untuk peserta</h2>
                      <p className="mt-1 text-sm leading-6 text-brand-muted">
                        Link acara online tidak ditampilkan di halaman publik. Peserta
                        terdaftar melihatnya di halaman acara setelah masuk ke StudyDate.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 id="public-safety-title" className="font-semibold text-brand-navy">Bertemu di tempat umum</h2>
                      <p className="mt-1 text-sm leading-6 text-brand-muted">
                        Lokasi acara harus berupa tempat publik. Tetap beri tahu orang
                        terpercaya dan pertahankan kendali atas transportasimu sendiri.
                      </p>
                    </>
                  )}
                </div>
              </section>

              <section className="flex gap-3" aria-labelledby="public-private-title">
                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" />
                <div>
                  <h2 id="public-private-title" className="font-semibold text-brand-navy">Daftar peserta tetap privat</h2>
                  <p className="mt-1 text-sm leading-6 text-brand-muted">
                    Halaman ini tidak membuka nama asli, kontak, atau daftar peserta.
                    Interaksi lanjutan tetap mengikuti persetujuan di dalam StudyDate.
                  </p>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </section>
    </article>
  );
}

function PublicEventDetailFallback() {
  return (
    <article aria-busy="true">
      <section className="border-b border-brand-border bg-brand-surface py-12 sm:py-16">
        <div className="page-shell">
          <div className="h-5 w-44 animate-pulse rounded bg-white" />
          <div className="mt-8 h-12 max-w-3xl animate-pulse rounded-xl bg-white" />
          <div className="mt-5 h-24 max-w-4xl animate-pulse rounded-xl bg-white" />
        </div>
      </section>
      <section className="page-shell grid gap-5 py-12 sm:grid-cols-2 lg:grid-cols-4 sm:py-16">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-xl bg-brand-surface" />
        ))}
      </section>
    </article>
  );
}

export default function PublicEventDetailPage(props: EventDetailProps) {
  return (
    <Suspense fallback={<PublicEventDetailFallback />}>
      <PublicEventDetailContent {...props} />
    </Suspense>
  );
}
