import {
  blockCampusEventOrganizerAction,
  cancelCampusEventRsvpAction,
  registerCampusEventAction,
  reportCampusEventAction,
  reportCampusEventMessageAction,
  sendCampusEventMessageAction,
} from "@/app/app/events/actions";
import { AppShell } from "@/components/app/app-shell";
import { EventRegistrationForm } from "@/components/events/event-registration-form";
import { EventCover } from "@/components/events/event-cover";
import { EventTicketIssuer } from "@/components/events/event-ticket-issuer";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { EVENT_CATEGORIES, EVENT_REPORT_REASONS } from "@/lib/events/constants";
import {
  getCampusEvent,
  getCampusEventCircle,
  getMyCampusEventTicketState,
  listCampusEventAnnouncements,
  listCampusEventMessages,
  listCampusEventRegistrationQuestions,
} from "@/lib/events/service";
import { eventSlugSchema } from "@/lib/events/validation";
import {
  BadgeCheck,
  CalendarDays,
  LockKeyhole,
  MapPin,
  UsersRound,
} from "lucide-react";
import { randomBytes } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type EventDetailPageProps = {
  params: Promise<{ publicSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const categoryLabels: Record<(typeof EVENT_CATEGORIES)[number], string> = {
  study_together: "Belajar Bareng",
  coding_tech: "Coding / Tech",
  design: "Desain",
  languages: "Bahasa",
  thesis: "Skripsi / Tesis",
  exam_prep: "Persiapan Ujian",
  workshop: "Workshop",
  discussion: "Diskusi",
  networking: "Relasi profesional",
  community: "Komunitas",
  seminar: "Seminar",
  meetup: "Meetup",
  hackathon: "Hackathon",
  other: "Lainnya",
};

const reportReasonLabels: Record<(typeof EVENT_REPORT_REASONS)[number], string> = {
  harassment: "Pelecehan",
  spam: "Spam",
  contact_pressure: "Tekanan berbagi kontak",
  fake_or_misleading: "Menyesatkan",
  unsafe_location: "Lokasi tidak sesuai kebijakan",
  other: "Lainnya",
};

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function timezoneShort(timezone: string) {
  if (timezone === "Asia/Makassar") return "WITA";
  if (timezone === "Asia/Jayapura") return "WIT";
  return "WIB";
}

function ReportFields({ target }: { target: "event" | "organizer" }) {
  return (
    <>
      <input type="hidden" name="reportTarget" value={target} />
      <label className="block text-xs font-semibold text-brand-navy">
        Alasan
        <select
          name="reasonCode"
          required
          defaultValue={target === "event" ? "unsafe_location" : "other"}
          className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm"
        >
          {EVENT_REPORT_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {reportReasonLabels[reason]}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-xs font-semibold text-brand-navy">
        Detail opsional
        <textarea
          name="details"
          rows={3}
          maxLength={300}
          className="focus-ring mt-2 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm leading-6"
        />
      </label>
    </>
  );
}

export default async function EventDetailPage({
  params,
  searchParams,
}: EventDetailPageProps) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const ownProfile = await getPrivateProfile(user.id);
  if (!ownProfile?.onboarding_completed_at) redirect("/onboarding");

  const { publicSlug: rawSlug } = await params;
  const parsedSlug = eventSlugSchema.safeParse(rawSlug);
  if (!parsedSlug.success) notFound();
  const event = await getCampusEvent(parsedSlug.data);
  if (!event) notFound();

  const query = await searchParams;
  const state = Array.isArray(query.state) ? query.state[0] : query.state;
  const notice = Array.isArray(query.notice) ? query.notice[0] : query.notice;
  const canUseParticipantFeatures =
    event.is_organizer || event.rsvp_status === "going";
  const canManageEvent =
    event.can_manage_registrations || event.can_check_in || event.can_manage_team;
  const managementHref =
    event.can_check_in && !event.can_manage_registrations
      ? `/app/events/${event.public_slug}/manage/check-in`
      : `/app/events/${event.public_slug}/manage`;
  const blastEnabled = process.env.EVENT_BLAST_ENABLED === "true";
  const [
    eventCircle,
    eventMessages,
    eventAnnouncements,
    ticketState,
    registrationQuestions,
  ] = await Promise.all([
    getCampusEventCircle(event.public_slug),
    canUseParticipantFeatures ? listCampusEventMessages(event.public_slug) : [],
    blastEnabled && canUseParticipantFeatures
      ? listCampusEventAnnouncements(event.public_slug)
      : [],
    event.rsvp_status === "going"
      ? getMyCampusEventTicketState(event.public_slug)
      : null,
    !event.is_organizer &&
    event.status === "scheduled" &&
    !event.is_past &&
    !["pending", "going", "waitlisted"].includes(event.rsvp_status ?? "")
      ? listCampusEventRegistrationQuestions(event.public_slug)
      : [],
  ]);
  const isFull = event.attendee_count >= event.capacity;
  const registrationClosed =
    Boolean(event.registration_closes_at) &&
    new Date(event.registration_closes_at!).getTime() <= new Date().getTime();

  const successCopy: Record<string, string> = {
    created: "Acara kampus berhasil dibuat.",
    updated: "Detail acara berhasil diperbarui.",
    "registration-pending": "Pendaftaranmu sedang menunggu persetujuan penyelenggara.",
    "registration-going": "Pendaftaranmu sudah dikonfirmasi.",
    "registration-waitlisted": "Kamu masuk daftar tunggu acara.",
    "registration-declined": "Pendaftaranmu tidak disetujui.",
    "registration-cancelled": "Pendaftaranmu telah dibatalkan.",
    "team-accept": "Undangan tim diterima. Ruang kerja acara sudah tersedia.",
    "team-decline": "Undangan tim ditolak.",
    "cancel-rsvp": "Keikutsertaanmu telah dibatalkan.",
    "cancel-event": "Acara dibatalkan. Riwayat pendaftaran tetap tersimpan.",
    archive: "Acara telah diarsipkan.",
    reported: "Laporan telah dikirim secara privat untuk ditinjau.",
    waitlisted: "Kamu masuk daftar tunggu acara.",
    "left-waitlist": "Kamu keluar dari daftar tunggu acara.",
    "message-sent": "Pesan acara terkirim.",
    "message-reported": "Laporan pesan dikirim secara privat untuk ditinjau.",
    "circle-linked": "Circle terkait berhasil diperbarui.",
  };

  const statusLabel =
    event.status === "cancelled"
      ? "Acara dibatalkan"
      : event.status === "archived"
        ? "Acara diarsipkan"
        : event.is_past
          ? "Acara telah selesai"
          : isFull
            ? "Kuota sudah penuh"
            : "Acara mendatang";

  return (
    <AppShell current="events">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell py-8 sm:py-12 lg:py-16">
          <Link
            href="/app/events"
            className="focus-ring inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-brand-muted hover:text-brand-blue"
          >
            ← Kembali ke Acara Kampus
          </Link>

          {state && successCopy[state] ? (
            <p
              role="status"
              className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-brand-blue"
            >
              {successCopy[state]}
            </p>
          ) : null}
          {notice ? (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-brand-error"
            >
              {notice}
            </p>
          ) : state === "error" ? (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-brand-error"
            >
              Tindakan belum dapat diproses. Coba lagi sebentar.
            </p>
          ) : null}

          <EventCover
            category={event.category}
            title={event.title}
            city={event.city}
            variant="hero"
            className="mt-7 w-full"
          />

          <header className="mt-9 grid gap-8 border-b border-brand-border pb-9 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-blue">
                <span>{categoryLabels[event.category]}</span>
                <span aria-hidden="true">•</span>
                <span>{event.scope === "open" ? "Terbuka" : "Kampus yang sama"}</span>
                {event.is_official ? (
                  <span className="inline-flex items-center gap-1 text-brand-navy">
                    <BadgeCheck className="h-4 w-4 text-brand-blue" aria-hidden="true" />
                    Resmi
                  </span>
                ) : null}
                <span className="text-brand-navy">{statusLabel}</span>
              </div>
              <h1 className="mt-4 break-words font-heading text-4xl font-semibold tracking-[-0.035em] text-brand-navy sm:text-5xl">
                {event.title}
              </h1>
              <p className="mt-5 max-w-3xl whitespace-pre-wrap break-words text-lg leading-8 text-brand-muted">
                {event.description}
              </p>
              <p className="mt-4 inline-flex flex-wrap items-center gap-2 text-sm text-brand-muted">
                Diselenggarakan oleh{" "}
                <strong className="font-semibold text-brand-navy">
                  {event.organizer_alias}
                </strong>
                {event.organizer_is_verified ? (
                  <BadgeCheck className="h-4 w-4 text-brand-blue" aria-label="Penyelenggara terverifikasi" />
                ) : null}
              </p>
            </div>
            <div className="space-y-3">
              {canManageEvent ? (
                <Link
                  href={managementHref}
                  className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
                >
                  Kelola acara
                </Link>
              ) : null}
              {process.env.EVENT_TICKETING_ENABLED === "true" && event.status === "scheduled" ? (
                <Link
                  href={`/app/events/${event.public_slug}/tickets`}
                  className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-brand-blue px-5 text-sm font-semibold text-brand-blue"
                >
                  Pilih tiket
                </Link>
              ) : null}
              {event.rsvp_status === "pending" ? (
                <p className="border-l-2 border-brand-blue pl-4 text-sm leading-6 text-brand-muted">
                  Pendaftaranmu sedang ditinjau penyelenggara.
                </p>
              ) : event.rsvp_status === "going" ? (
                <p className="border-l-2 border-brand-blue pl-4 text-sm leading-6 text-brand-muted">
                  Pendaftaranmu sudah dikonfirmasi.
                </p>
              ) : event.rsvp_status === "waitlisted" ? (
                <p className="border-l-2 border-brand-blue pl-4 text-sm leading-6 text-brand-muted">
                  Kamu berada di daftar tunggu dan akan masuk sebagai peserta secara otomatis jika ada tempat.
                </p>
              ) : event.rsvp_status === "declined" ? (
                <p className="border-l-2 border-brand-border pl-4 text-sm leading-6 text-brand-muted">
                  Pendaftaranmu sebelumnya tidak disetujui. Kamu dapat mendaftar ulang selama pendaftaran masih terbuka.
                </p>
              ) : event.rsvp_status === "cancelled" ? (
                <p className="border-l-2 border-brand-border pl-4 text-sm leading-6 text-brand-muted">
                  Pendaftaranmu telah dibatalkan.
                </p>
              ) : null}
              {!event.is_organizer &&
              event.status === "scheduled" &&
              !event.is_past &&
              !registrationClosed &&
              event.can_rsvp &&
              !["pending", "going", "waitlisted"].includes(event.rsvp_status ?? "") &&
              registrationQuestions.length === 0 ? (
                <form action={registerCampusEventAction}>
                  <input type="hidden" name="publicSlug" value={event.public_slug} />
                  <input type="hidden" name="answers" value="{}" />
                  <button className="focus-ring min-h-12 w-full rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white">
                    {event.registration_mode === "approval"
                      ? "Kirim pendaftaran"
                      : isFull && event.waitlist_enabled
                        ? "Masuk daftar tunggu"
                        : "Ikut acara"}
                  </button>
                </form>
              ) : null}
              {event.can_cancel_rsvp ? (
                <details className="rounded-xl border border-brand-border bg-white p-4">
                  <summary className="focus-ring cursor-pointer rounded-lg text-sm font-semibold text-brand-navy">
                    Batalkan keikutsertaan
                  </summary>
                  <p className="mt-3 text-xs leading-5 text-brand-muted">
                    Tempatmu akan tersedia kembali. Kamu dapat mendaftar lagi jika acara
                    masih terbuka dan belum penuh.
                  </p>
                  <form action={cancelCampusEventRsvpAction} className="mt-3">
                    <input type="hidden" name="publicSlug" value={event.public_slug} />
                    <button
                      type="submit"
                      className="focus-ring min-h-11 w-full rounded-xl border border-brand-navy px-4 text-sm font-semibold text-brand-navy"
                    >
                      Ya, batalkan keikutsertaan
                    </button>
                  </form>
                </details>
              ) : null}
              {["pending", "waitlisted"].includes(event.rsvp_status ?? "") &&
              event.status === "scheduled" &&
              !event.is_past ? (
                <form action={cancelCampusEventRsvpAction}>
                  <input type="hidden" name="publicSlug" value={event.public_slug} />
                  <button className="focus-ring min-h-11 w-full rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy">
                    Batalkan pendaftaran
                  </button>
                </form>
              ) : null}
              {!event.is_organizer ? (
                <details className="rounded-xl border border-brand-border bg-white p-4">
                  <summary className="focus-ring cursor-pointer rounded-lg text-sm font-semibold text-brand-muted">
                    Laporkan acara
                  </summary>
                  <form action={reportCampusEventAction} className="mt-4">
                    <input type="hidden" name="publicSlug" value={event.public_slug} />
                    <ReportFields target="event" />
                    <button
                      type="submit"
                      className="focus-ring mt-4 min-h-11 w-full rounded-xl border border-brand-error px-4 text-sm font-semibold text-brand-error"
                    >
                      Kirim laporan acara
                    </button>
                  </form>
                </details>
              ) : null}
            </div>
          </header>

          {registrationQuestions.length && event.can_rsvp ? (
            <section className="border-b border-brand-border py-9" aria-labelledby="registration-form-title">
              <p className="section-label">Pendaftaran</p>
              <h2 id="registration-form-title" className="mt-2 font-heading text-2xl font-semibold text-brand-navy">
                Lengkapi pendaftaran acara
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-brand-muted">
                Jawaban hanya dapat dilihat oleh penyelenggara dan rekan penyelenggara melalui daftar pendaftaran yang dilindungi.
              </p>
              <div className="mt-6 max-w-2xl">
                <EventRegistrationForm
                  publicSlug={event.public_slug}
                  questions={registrationQuestions}
                  profile={{
                    campus: ownProfile.campus,
                    studyProgram: ownProfile.study_program,
                    semester: ownProfile.semester,
                  }}
                  submitLabel={
                    event.registration_mode === "approval"
                      ? "Kirim pendaftaran"
                      : isFull && event.waitlist_enabled
                        ? "Masuk daftar tunggu"
                        : "Ikut acara"
                  }
                />
              </div>
            </section>
          ) : null}

          <section className="grid gap-7 border-b border-brand-border py-9 lg:grid-cols-3" aria-label="Informasi acara">
            <div className="min-w-0">
              <CalendarDays className="h-5 w-5 text-brand-blue" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold text-brand-navy">Tanggal dan waktu</h2>
              <p className="mt-2 break-words text-sm leading-6 text-brand-muted">
                <time dateTime={event.starts_at}>
                  {formatDateTime(event.starts_at, event.timezone_name)}
                </time>
                {" – "}
                <time dateTime={event.ends_at}>
                  {formatDateTime(event.ends_at, event.timezone_name)}
                </time>
                {" "}
                ({timezoneShort(event.timezone_name)})
              </p>
            </div>
            <div className="min-w-0">
              <MapPin className="h-5 w-5 text-brand-blue" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold text-brand-navy">Tempat publik</h2>
              <p className="mt-2 break-words text-sm leading-6 text-brand-muted">
                {event.venue_name}
                <br />
                {event.venue_area}, {event.city}
              </p>
            </div>
            <div className="min-w-0">
              <UsersRound className="h-5 w-5 text-brand-blue" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold text-brand-navy">Peserta</h2>
              <p className="mt-2 text-sm leading-6 text-brand-muted">
                {event.attendee_count} dari {event.capacity} peserta
                <br />
                {event.registration_mode === "approval"
                  ? "Pendaftaran perlu persetujuan"
                  : "Pendaftaran langsung diterima"}
                {isFull
                  ? event.waitlist_enabled
                    ? " · Daftar tunggu tersedia"
                    : " · Penuh"
                  : ""}
                {registrationClosed ? " · Pendaftaran ditutup" : ""}
                {event.scope === "campus" && event.campus_scope ? (
                  <>
                    <br />
                    <span className="inline-flex items-center gap-1.5">
                      <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                      {event.campus_scope}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          </section>

          {eventCircle ? (
            <section className="border-b border-brand-border py-8">
              <p className="section-label">Circle terkait</p>
              <Link
                href={`/app/circles/${eventCircle.circle_public_slug}`}
                className="focus-ring mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-blue hover:underline"
              >
                {eventCircle.circle_name}
              </Link>
            </section>
          ) : null}

          <aside className="border-b border-brand-border py-8" aria-labelledby="event-safety-title">
            <div className="max-w-3xl">
              <p className="section-label">Pertemuan di tempat publik</p>
              <h2 id="event-safety-title" className="mt-2 font-heading text-2xl font-semibold text-brand-navy">
                Periksa kembali lokasi sebelum berangkat
              </h2>
              <p className="mt-3 text-sm leading-7 text-brand-muted">
                Pastikan tempat ramai, mudah diakses, dan masih beroperasi. Konfirmasi
                informasi penyelenggara dan pemeriksaan StudyDate membantu mengurangi risiko, tetapi bukan
                jaminan keselamatan.
              </p>
            </div>
          </aside>

          {eventAnnouncements.length ? (
            <section
              id="event-announcements"
              className="border-b border-brand-border py-10"
              aria-labelledby="event-announcements-title"
            >
              <p className="section-label">Kabar dari penyelenggara</p>
              <h2
                id="event-announcements-title"
                className="mt-2 font-heading text-2xl font-semibold text-brand-navy"
              >
                Pengumuman acara
              </h2>
              <div className="mt-6 divide-y divide-brand-border border-y border-brand-border">
                {eventAnnouncements.map((announcement) => (
                  <article key={announcement.announcement_public_id} className="py-5">
                    <h3 className="font-heading text-lg font-semibold text-brand-navy">
                      {announcement.title}
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-brand-muted">
                      {announcement.body}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="py-10" aria-labelledby="event-attendee-gate">
            <h2 id="event-attendee-gate" className="font-heading text-2xl font-semibold text-brand-navy">
              Direktori peserta tetap privat
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-brand-muted">
              Peserta biasa tidak dapat melihat siapa saja yang hadir. Daftar peserta
              hanya tersedia bagi penyelenggara dan tim acara di ruang pengelolaan.
            </p>
          </section>

          {canUseParticipantFeatures ? (
            <section className="border-t border-brand-border py-10" aria-labelledby="event-chat-title">
              <p className="section-label">Diskusi acara</p>
              <h2 id="event-chat-title" className="mt-2 font-heading text-2xl font-semibold text-brand-navy">
                Koordinasi peserta
              </h2>
              <div className="mt-5 space-y-3">
                {eventMessages.length ? (
                  eventMessages.toReversed().map((message) => (
                    <article key={message.message_public_id} className="rounded-xl border border-brand-border bg-white p-4">
                      <p className="text-xs font-semibold text-brand-blue">
                        {message.author_alias}{message.is_mine ? " · Kamu" : ""}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-brand-muted">
                        {message.body}
                      </p>
                      {!message.is_mine && message.author_alias !== "Akun dihapus" ? (
                        <details className="mt-3">
                          <summary className="focus-ring cursor-pointer rounded text-xs font-semibold text-brand-muted">
                            Laporkan pesan
                          </summary>
                          <form action={reportCampusEventMessageAction} className="mt-3 max-w-md">
                            <input type="hidden" name="publicSlug" value={event.public_slug} />
                            <input type="hidden" name="messagePublicId" value={message.message_public_id} />
                            <ReportFields target="event" />
                            <button className="focus-ring mt-3 min-h-10 rounded-lg border border-brand-error px-3 text-xs font-semibold text-brand-error">
                              Kirim laporan pesan
                            </button>
                          </form>
                        </details>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-brand-muted">Belum ada pesan.</p>
                )}
              </div>
              <form action={sendCampusEventMessageAction} className="mt-5">
                <input type="hidden" name="publicSlug" value={event.public_slug} />
                <input type="hidden" name="idempotencyKey" value={randomBytes(18).toString("base64url")} />
                <label className="text-sm font-semibold text-brand-navy">
                  Pesan teks
                  <textarea name="body" required maxLength={800} rows={3} className="focus-ring mt-2 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-sm" />
                </label>
                <button className="focus-ring mt-3 min-h-11 rounded-xl bg-brand-navy px-5 text-sm font-semibold text-white">
                  Kirim pesan
                </button>
              </form>
            </section>
          ) : null}

          {event.rsvp_status === "going" ? (
            <section className="border-t border-brand-border py-8">
              <h2 className="font-heading text-2xl font-semibold text-brand-navy">Tiket kehadiran</h2>
              <EventTicketIssuer
                publicSlug={event.public_slug}
                ticketState={ticketState}
                eventTitle={event.title}
                attendeeAlias={ownProfile.public_alias}
                startsAt={event.starts_at}
                timezone={event.timezone_name}
                venue={`${event.venue_name}, ${event.venue_area}, ${event.city}`}
              />
            </section>
          ) : null}

          {!event.is_organizer ? (
            <section className="border-t border-brand-border py-8" aria-labelledby="event-organizer-report-title">
              <details className="max-w-xl rounded-xl border border-brand-border bg-white p-4">
                <summary id="event-organizer-report-title" className="focus-ring cursor-pointer rounded-lg text-sm font-semibold text-brand-muted">
                  Laporkan penyelenggara
                </summary>
                <form action={reportCampusEventAction} className="mt-4">
                  <input type="hidden" name="publicSlug" value={event.public_slug} />
                  <ReportFields target="organizer" />
                  <button
                    type="submit"
                    className="focus-ring mt-4 min-h-11 w-full rounded-xl border border-brand-error px-4 text-sm font-semibold text-brand-error"
                  >
                    Kirim laporan penyelenggara
                  </button>
                </form>
              </details>
              <details className="mt-3 max-w-xl rounded-xl border border-brand-border bg-white p-4">
                <summary className="focus-ring cursor-pointer rounded-lg text-sm font-semibold text-brand-muted">
                  Blokir penyelenggara
                </summary>
                <p className="mt-3 text-sm leading-6 text-brand-muted">
                  Organizer tidak dapat berinteraksi atau memberi akses tim kepadamu.
                  Riwayat acara dan pendaftaran yang perlu dipertahankan tidak otomatis
                  dihapus.
                </p>
                <form action={blockCampusEventOrganizerAction} className="mt-4">
                  <input type="hidden" name="publicSlug" value={event.public_slug} />
                  <input type="hidden" name="organizerAlias" value={event.organizer_alias} />
                  <button
                    type="submit"
                    className="focus-ring min-h-11 w-full rounded-xl border border-brand-error px-4 text-sm font-semibold text-brand-error"
                  >
                    Ya, blokir penyelenggara
                  </button>
                </form>
              </details>
            </section>
          ) : null}

          {canManageEvent ? (
            <section className="border-t border-brand-border py-8" aria-labelledby="event-manage-link-title">
              <p className="section-label">Organizer</p>
              <h2 id="event-manage-link-title" className="mt-2 font-heading text-2xl font-semibold text-brand-navy">
                Pendaftaran, kehadiran, tim, dan pengaturan
              </h2>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link
                  href={managementHref}
                  className="focus-ring inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-navy px-5 text-sm font-semibold text-white"
                >
                  Kelola acara
                </Link>
                {event.can_check_in ? (
                  <Link
                    href={`/app/events/${event.public_slug}/manage/check-in/scan`}
                    className="focus-ring inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-border bg-white px-5 text-sm font-semibold text-brand-navy"
                  >
                    Buka pemindai QR
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}

        </div>
      </main>
    </AppShell>
  );
}
