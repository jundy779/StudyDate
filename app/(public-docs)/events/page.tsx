import { PublicEventList } from "@/components/events/public-event-list";
import { EVENT_CATEGORIES, type EventCategory } from "@/lib/events/constants";
import { EVENT_CATEGORY_LABELS } from "@/lib/events/presentation";
import { listPublicCampusEvents } from "@/lib/events/public-service";
import { CalendarDays, ShieldCheck, TicketCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Acara Kampus — StudyDate ID",
  description:
    "Temukan seminar, workshop, komunitas, dan kegiatan kampus resmi yang akan datang di StudyDate ID.",
  alternates: { canonical: "/events" },
  openGraph: {
    title: "Acara Kampus — StudyDate ID",
    description:
      "Cari kegiatan kampus resmi, lihat detailnya tanpa login, lalu daftar melalui akun StudyDate.",
    url: "/events",
    type: "website",
  },
};

type EventsPageProps = {
  searchParams: Promise<{ category?: string; saved?: string }>;
};

async function PublicEventsContent({ searchParams }: EventsPageProps) {
  const query = await searchParams;
  const savedOnly = query.saved === "1";
  const category =
    !savedOnly && EVENT_CATEGORIES.includes(query.category as EventCategory)
      ? (query.category as EventCategory)
      : undefined;
  const events = await listPublicCampusEvents(category).catch(() => []);

  return (
    <article>
      <section className="bg-brand-navy py-16 text-white sm:py-20">
        <div className="page-shell grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <h1 className="max-w-4xl font-heading text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl lg:text-6xl">
              Acara kampus yang layak masuk kalendermu.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">
              Lihat seminar, workshop, komunitas, dan kegiatan kampus yang sudah
              diperiksa StudyDate. Detail acara dapat dibaca tanpa harus masuk.
            </p>
          </div>
          <div className="border-l-2 border-brand-blue pl-6">
            <p className="font-heading text-xl font-semibold leading-8">
              Masuk hanya saat kamu ingin mendaftar, melihat tiket, atau membuat acara.
            </p>
            <Link
              href="/login"
              className="focus-ring mt-5 inline-flex min-h-11 items-center rounded-xl bg-white px-5 text-sm font-semibold text-brand-navy"
            >
              Masuk ke StudyDate
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-brand-border bg-brand-surface">
        <div className="page-shell grid gap-6 py-7 sm:grid-cols-3">
          {[
            [CalendarDays, "Detail jelas", "Waktu, tempat, dan cara daftar tersedia sebelum kamu memutuskan."],
            [ShieldCheck, "Acara resmi", "Halaman publik hanya menampilkan acara terbuka yang sudah diperiksa."],
            [TicketCheck, "Tiket tersimpan", "Pendaftaran dan tiket tetap berada di akun StudyDate milikmu."],
          ].map(([Icon, title, copy]) => {
            const FeatureIcon = Icon as typeof CalendarDays;
            return (
              <div key={title as string} className="flex gap-4">
                <FeatureIcon className="mt-1 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-brand-navy">{title as string}</h2>
                  <p className="mt-1 text-sm leading-6 text-brand-muted">{copy as string}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="page-shell py-14 sm:py-20">
        <div className="flex flex-col gap-6 border-b border-brand-border pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl">
              Acara mendatang
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-brand-muted">
              Pilih topik yang kamu minati. Tidak ada urutan berdasarkan popularitas.
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-2 pb-2 lg:max-w-3xl lg:justify-end"
            aria-label="Filter kategori acara"
          >
            <Link
              href="/events"
              aria-current={!category && !savedOnly ? "page" : undefined}
              className={`focus-ring shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
                !category && !savedOnly
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-brand-border bg-white text-brand-navy"
              }`}
            >
              Semua
            </Link>
            <Link
              href="/events?saved=1"
              aria-current={savedOnly ? "page" : undefined}
              className={`focus-ring shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
                savedOnly
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-brand-border bg-white text-brand-navy"
              }`}
            >
              Tersimpan
            </Link>
            {EVENT_CATEGORIES.map((item) => (
              <Link
                key={item}
                href={`/events?category=${item}`}
                aria-current={category === item ? "page" : undefined}
                className={`focus-ring shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
                  category === item
                    ? "border-brand-blue bg-brand-blue text-white"
                    : "border-brand-border bg-white text-brand-navy"
                }`}
              >
                {EVENT_CATEGORY_LABELS[item]}
              </Link>
            ))}
          </nav>
        </div>

        <PublicEventList
          events={events}
          savedOnly={savedOnly}
          categorySelected={Boolean(category)}
        />
      </section>
    </article>
  );
}

function PublicEventsFallback() {
  return (
    <article aria-busy="true">
      <section className="bg-brand-navy py-16 text-white sm:py-20">
        <div className="page-shell">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-blue-light">
            Acara Kampus
          </p>
          <h1 className="mt-4 max-w-4xl font-heading text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl lg:text-6xl">
            Menyiapkan acara yang layak masuk kalendermu.
          </h1>
        </div>
      </section>
      <section className="page-shell py-14 sm:py-20">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-brand-surface" />
        <div className="mt-8 space-y-4">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-2xl border border-brand-border bg-brand-surface"
            />
          ))}
        </div>
      </section>
    </article>
  );
}

export default function PublicEventsPage(props: EventsPageProps) {
  return (
    <Suspense fallback={<PublicEventsFallback />}>
      <PublicEventsContent {...props} />
    </Suspense>
  );
}
