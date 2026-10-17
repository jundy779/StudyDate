import {
  cancelCampusEventSeriesAction,
  sendCampusEventAnnouncementAction,
} from "@/app/app/events/actions";
import { AppShell } from "@/components/app/app-shell";
import { EventManagementShell } from "@/components/events/event-management-shell";
import { getCampusEventManagement } from "@/lib/events/management";
import {
  listCampusEventAnnouncements,
  listCampusEventSeriesSessions,
} from "@/lib/events/service";
import {
  BarChart3,
  CalendarCheck,
  ClipboardList,
  QrCode,
  Settings,
  UserRoundCog,
} from "lucide-react";
import Link from "next/link";
import { randomBytes } from "node:crypto";

type EventManagePageProps = {
  params: Promise<{ publicSlug: string }>;
  searchParams: Promise<{ state?: string; notice?: string }>;
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

export default async function EventManagePage({
  params,
  searchParams,
}: EventManagePageProps) {
  const { publicSlug } = await params;
  const [{ event, overview }, query] = await Promise.all([
    getCampusEventManagement(publicSlug),
    searchParams,
  ]);
  const blastEnabled = process.env.EVENT_BLAST_ENABLED === "true";
  const seriesEnabled = process.env.EVENT_SERIES_ENABLED === "true";
  const announcements =
    blastEnabled && event.can_manage_registrations
      ? await listCampusEventAnnouncements(event.public_slug)
      : [];
  const seriesSessions = seriesEnabled
    ? await listCampusEventSeriesSessions(event.public_slug)
    : [];
  const idempotencyKey = randomBytes(18).toString("base64url");
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

            {seriesSessions.length > 1 ? (
              <section className="mt-10 border-t border-brand-border pt-9" aria-labelledby="event-series-title">
                <p className="section-label">Rangkaian acara</p>
                <h2 id="event-series-title" className="mt-2 font-heading text-2xl font-semibold text-brand-navy">
                  Semua pertemuan
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-brand-muted">
                  Setiap sesi memiliki peserta, tiket, kehadiran, dan laporan sendiri.
                </p>
                <ol className="mt-6 divide-y divide-brand-border border-y border-brand-border">
                  {seriesSessions.map((session) => (
                    <li key={session.public_slug} className="grid gap-3 py-4 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:items-center">
                      <span className="text-sm font-semibold text-brand-blue">
                        {session.series_position}
                      </span>
                      <span>
                        <span className="block font-semibold text-brand-navy">{session.title}</span>
                        <span className="mt-1 block text-xs text-brand-muted">
                          {new Intl.DateTimeFormat("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: event.timezone_name,
                          }).format(new Date(session.starts_at))} · {session.status}
                        </span>
                      </span>
                      <Link href={`/app/events/${session.public_slug}/manage`} className="focus-ring rounded-lg text-sm font-semibold text-brand-blue">
                        Kelola
                      </Link>
                    </li>
                  ))}
                </ol>
                {event.can_manage_registrations ? (
                  <div className="mt-7 grid gap-4 sm:grid-cols-2">
                    <details className="rounded-xl border border-brand-border bg-white p-5">
                      <summary className="focus-ring cursor-pointer rounded-lg font-semibold text-brand-navy">
                        Batalkan mulai pertemuan ini
                      </summary>
                      <p className="mt-3 text-sm leading-6 text-brand-muted">
                        Pertemuan ini dan semua pertemuan setelahnya akan dibatalkan.
                        Pertemuan yang sudah selesai tetap tersimpan.
                      </p>
                      <form action={cancelCampusEventSeriesAction} className="mt-4">
                        <input type="hidden" name="publicSlug" value={event.public_slug} />
                        <input type="hidden" name="scope" value="following" />
                        <button className="focus-ring min-h-11 rounded-xl border border-brand-error px-4 text-sm font-semibold text-brand-error">
                          Ya, batalkan mulai sesi ini
                        </button>
                      </form>
                    </details>
                    <details className="rounded-xl border border-brand-border bg-white p-5">
                      <summary className="focus-ring cursor-pointer rounded-lg font-semibold text-brand-navy">
                        Batalkan semua pertemuan
                      </summary>
                      <p className="mt-3 text-sm leading-6 text-brand-muted">
                        Semua pertemuan yang belum dimulai akan dibatalkan. Peserta
                        akan tetap mendapatkan pemberitahuan dari sistem.
                      </p>
                      <form action={cancelCampusEventSeriesAction} className="mt-4">
                        <input type="hidden" name="publicSlug" value={event.public_slug} />
                        <input type="hidden" name="scope" value="all" />
                        <button className="focus-ring min-h-11 rounded-xl border border-brand-error px-4 text-sm font-semibold text-brand-error">
                          Ya, batalkan semua
                        </button>
                      </form>
                    </details>
                  </div>
                ) : null}
              </section>
            ) : null}

            {blastEnabled && event.can_manage_registrations ? (
              <section
                id="event-announcements"
                className="mt-10 border-t border-brand-border pt-9"
                aria-labelledby="event-announcement-title"
              >
                <p className="section-label">Pengumuman acara</p>
                <h2
                  id="event-announcement-title"
                  className="mt-2 font-heading text-2xl font-semibold text-brand-navy"
                >
                  Kirim kabar ke peserta
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-brand-muted">
                  Pengumuman dikirim sebagai notifikasi dalam aplikasi kepada peserta
                  yang sudah diterima. Maksimal lima pengumuman per hari.
                </p>
                {query.state === "announcement-sent" ? (
                  <p role="status" className="mt-5 border-l-2 border-emerald-600 pl-4 text-sm font-semibold text-emerald-700">
                    Pengumuman berhasil dikirim.
                  </p>
                ) : null}
                {query.state === "announcement-error" ? (
                  <p role="alert" className="mt-5 border-l-2 border-brand-error pl-4 text-sm font-semibold text-brand-error">
                    {query.notice ?? "Pengumuman belum dapat dikirim."}
                  </p>
                ) : null}
                <form action={sendCampusEventAnnouncementAction} className="mt-6 max-w-2xl space-y-4">
                  <input type="hidden" name="publicSlug" value={event.public_slug} />
                  <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
                  <label className="block text-sm font-semibold text-brand-navy">
                    Judul pengumuman
                    <input
                      name="title"
                      required
                      minLength={5}
                      maxLength={100}
                      placeholder="Contoh: Perubahan ruang acara"
                      className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-white px-4 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-brand-navy">
                    Isi pengumuman
                    <textarea
                      name="body"
                      required
                      minLength={10}
                      maxLength={1200}
                      rows={5}
                      placeholder="Tulis informasi yang benar-benar perlu diketahui peserta."
                      className="focus-ring mt-2 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-sm leading-6"
                    />
                  </label>
                  <button className="focus-ring min-h-11 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white">
                    Kirim pengumuman
                  </button>
                </form>
                <div className="mt-8 divide-y divide-brand-border border-y border-brand-border">
                  {announcements.length ? announcements.map((announcement) => (
                    <article key={announcement.announcement_public_id} className="py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h3 className="font-heading text-lg font-semibold text-brand-navy">
                          {announcement.title}
                        </h3>
                        <span className="text-xs font-semibold text-brand-muted">
                          {announcement.recipient_count} notifikasi
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-brand-muted">
                        {announcement.body}
                      </p>
                    </article>
                  )) : (
                    <p className="py-5 text-sm text-brand-muted">
                      Belum ada pengumuman untuk acara ini.
                    </p>
                  )}
                </div>
              </section>
            ) : null}

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
