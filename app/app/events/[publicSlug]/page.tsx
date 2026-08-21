import {
  archiveCampusEventAction,
  cancelCampusEventAction,
  cancelCampusEventRsvpAction,
  checkInCampusEventTicketAction,
  joinCampusEventWaitlistAction,
  leaveCampusEventWaitlistAction,
  reportCampusEventAction,
  reportCampusEventMessageAction,
  rsvpCampusEventAction,
  sendCampusEventMessageAction,
  setCampusEventCircleAction,
  updateCampusEventAction,
} from "@/app/app/events/actions";
import { AppShell } from "@/components/app/app-shell";
import { EventForm } from "@/components/events/event-form";
import { EventTicketIssuer } from "@/components/events/event-ticket-issuer";
import { SendIntroductionDialog } from "@/components/introductions/send-introduction-dialog";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { EVENT_CATEGORIES, EVENT_REPORT_REASONS } from "@/lib/events/constants";
import {
  getCampusEvent,
  getCampusEventCircle,
  getMyCampusEventTicketState,
  getMyCampusEventWaitlistPosition,
  listCampusEventAttendees,
  listCampusEventMessages,
  listMyCircleOptionsForEvent,
} from "@/lib/events/service";
import { eventSlugSchema } from "@/lib/events/validation";
import { getIntroductionSendEligibility } from "@/lib/introductions/service";
import { getMascotForAlias } from "@/lib/people/constants";
import {
  Archive,
  BadgeCheck,
  CalendarDays,
  Clock3,
  LockKeyhole,
  MapPin,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import { randomBytes } from "node:crypto";
import Image from "next/image";
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
  networking: "Networking",
  community: "Komunitas",
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
  const canViewAttendees =
    event.is_organizer || event.rsvp_status === "going";
  const [
    attendeeRows,
    eventCircle,
    eventMessages,
    waitlistPosition,
    ticketState,
    circleOptions,
  ] = await Promise.all([
    canViewAttendees ? listCampusEventAttendees(event.public_slug) : [],
    getCampusEventCircle(event.public_slug),
    canViewAttendees ? listCampusEventMessages(event.public_slug) : [],
    !event.is_organizer ? getMyCampusEventWaitlistPosition(event.public_slug) : null,
    event.rsvp_status === "going"
      ? getMyCampusEventTicketState(event.public_slug)
      : null,
    event.is_organizer ? listMyCircleOptionsForEvent() : [],
  ]);
  const eligibilityEntries = canViewAttendees
    ? await Promise.all(
        attendeeRows
          .filter((attendee) => attendee.public_alias !== "Akun dihapus")
          .map(async (attendee) => [
          attendee.public_alias,
          await getIntroductionSendEligibility(attendee.public_alias),
          ] as const),
      )
    : [];
  const eligibilityByAlias = new Map(eligibilityEntries);
  const isFull = event.attendee_count >= event.capacity;

  const successCopy: Record<string, string> = {
    created: "Campus Event berhasil dibuat.",
    updated: "Detail Event berhasil diperbarui.",
    rsvp: "Kamu sudah terdaftar untuk mengikuti acara.",
    "cancel-rsvp": "Keikutsertaanmu telah dibatalkan.",
    "cancel-event": "Acara dibatalkan. Riwayat RSVP tetap tersimpan.",
    archive: "Event telah diarsipkan.",
    reported: "Laporan telah dikirim secara privat untuk ditinjau.",
    waitlisted: "Kamu masuk waitlist Event.",
    "left-waitlist": "Kamu keluar dari waitlist Event.",
    "message-sent": "Pesan Event terkirim.",
    "message-reported": "Laporan pesan dikirim secara privat untuk ditinjau.",
    "circle-linked": "Tautan Study Circle diperbarui.",
    "ticket-issued": "Tiket berhasil diterbitkan. Simpan token ini.",
    checked_in: "Check-in berhasil dicatat.",
    duplicate: "Tiket ini sudah check-in sebelumnya.",
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
            ← Kembali ke Campus Events
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

          <header className="mt-7 grid gap-8 border-b border-brand-border pb-9 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-blue">
                <span>{categoryLabels[event.category]}</span>
                <span aria-hidden="true">•</span>
                <span>{event.scope === "open" ? "Terbuka" : "Kampus yang sama"}</span>
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
                  <BadgeCheck className="h-4 w-4 text-brand-blue" aria-label="Organizer terverifikasi" />
                ) : null}
              </p>
            </div>
            <div className="space-y-3">
              {event.can_rsvp ? (
                <form action={rsvpCampusEventAction}>
                  <input type="hidden" name="publicSlug" value={event.public_slug} />
                  <button
                    type="submit"
                    className="focus-ring min-h-12 w-full rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
                  >
                    Ikut acara
                  </button>
                </form>
              ) : null}
              {!event.is_organizer &&
              event.status === "scheduled" &&
              !event.is_past &&
              event.rsvp_status !== "going" &&
              isFull ? (
                <form action={joinCampusEventWaitlistAction}>
                  <input type="hidden" name="publicSlug" value={event.public_slug} />
                  <button className="focus-ring min-h-11 w-full rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white">
                    Masuk waitlist
                  </button>
                </form>
              ) : null}
              {waitlistPosition ? (
                <div className="rounded-xl border border-brand-border bg-white p-4">
                  <p className="text-sm font-semibold text-brand-navy">
                    Posisi waitlist: {waitlistPosition}
                  </p>
                  <form action={leaveCampusEventWaitlistAction} className="mt-3">
                    <input type="hidden" name="publicSlug" value={event.public_slug} />
                    <button className="focus-ring min-h-10 rounded-lg border border-brand-border px-3 text-xs font-semibold">
                      Keluar dari waitlist
                    </button>
                  </form>
                </div>
              ) : null}
              {event.can_cancel_rsvp ? (
                <details className="rounded-xl border border-brand-border bg-white p-4">
                  <summary className="focus-ring cursor-pointer rounded-lg text-sm font-semibold text-brand-navy">
                    Batalkan keikutsertaan
                  </summary>
                  <p className="mt-3 text-xs leading-5 text-brand-muted">
                    Slot akan tersedia kembali. Kamu dapat RSVP lagi jika acara masih
                    eligible dan belum penuh.
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
              {!event.is_organizer ? (
                <details className="rounded-xl border border-brand-border bg-white p-4">
                  <summary className="focus-ring cursor-pointer rounded-lg text-sm font-semibold text-brand-muted">
                    Laporkan Event
                  </summary>
                  <form action={reportCampusEventAction} className="mt-4">
                    <input type="hidden" name="publicSlug" value={event.public_slug} />
                    <ReportFields target="event" />
                    <button
                      type="submit"
                      className="focus-ring mt-4 min-h-11 w-full rounded-xl border border-brand-error px-4 text-sm font-semibold text-brand-error"
                    >
                      Kirim laporan Event
                    </button>
                  </form>
                </details>
              ) : null}
            </div>
          </header>

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
              <p className="section-label">Study Circle terkait</p>
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
                organizer dan filter StudyDate merupakan kontrol best-effort, bukan
                jaminan keselamatan.
              </p>
            </div>
          </aside>

          {canViewAttendees ? (
            <section className="py-10" aria-labelledby="event-attendees-title">
              <div className="max-w-3xl">
                <p className="section-label">Peserta</p>
                <h2 id="event-attendees-title" className="mt-2 font-heading text-2xl font-semibold text-brand-navy">
                  Profil anonim yang aman
                </h2>
                <p className="mt-2 text-sm leading-6 text-brand-muted">
                  Daftar ini hanya untuk organizer dan peserta aktif. Attendance tidak
                  membuka identitas, foto privat, kontak, atau state koneksi.
                </p>
              </div>
              <div className="mt-6 grid gap-px overflow-hidden rounded-[22px] border border-brand-border bg-brand-border md:grid-cols-2 xl:grid-cols-3">
                {attendeeRows.map((attendee) => {
                  const eligibility = eligibilityByAlias.get(attendee.public_alias);
                  return (
                    <article key={attendee.public_alias} className="min-w-0 bg-white p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-end justify-center overflow-hidden rounded-xl bg-brand-surface">
                          <Image
                            src={getMascotForAlias(attendee.public_alias)}
                            alt=""
                            width={44}
                            height={44}
                            className="h-11 w-11 object-contain object-bottom"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words font-semibold text-brand-navy">
                              {attendee.public_alias}
                            </h3>
                            {attendee.is_verified ? (
                              <BadgeCheck className="h-4 w-4 text-brand-blue" aria-label="Terverifikasi" />
                            ) : null}
                            {attendee.is_organizer ? (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-brand-blue">
                                Organizer
                              </span>
                            ) : null}
                          </div>
                          {attendee.public_alias !== "Akun dihapus" ? (
                            <p className="mt-1 break-words text-xs leading-5 text-brand-muted">
                              {attendee.study_program} · {attendee.campus}
                              {attendee.semester ? ` · Semester ${attendee.semester}` : ""}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {eligibility?.can_send ? (
                        <div className="mt-4 rounded-xl bg-brand-navy p-4">
                          <SendIntroductionDialog
                            alias={attendee.public_alias}
                            canSend
                          />
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="py-10" aria-labelledby="event-attendee-gate">
              <h2 id="event-attendee-gate" className="font-heading text-2xl font-semibold text-brand-navy">
                Daftar peserta tidak terbuka untuk publik
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-brand-muted">
                Hanya organizer dan peserta dengan RSVP aktif yang dapat melihat
                projection anonim peserta. Jumlah peserta tetap tampil sebagai kapasitas
                acara, bukan direktori mahasiswa.
              </p>
            </section>
          )}

          {canViewAttendees ? (
            <section className="border-t border-brand-border py-10" aria-labelledby="event-chat-title">
              <p className="section-label">Diskusi Event</p>
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
              <EventTicketIssuer publicSlug={event.public_slug} ticketState={ticketState} />
            </section>
          ) : null}

          {!event.is_organizer ? (
            <section className="border-t border-brand-border py-8" aria-labelledby="event-organizer-report-title">
              <details className="max-w-xl rounded-xl border border-brand-border bg-white p-4">
                <summary id="event-organizer-report-title" className="focus-ring cursor-pointer rounded-lg text-sm font-semibold text-brand-muted">
                  Laporkan organizer
                </summary>
                <form action={reportCampusEventAction} className="mt-4">
                  <input type="hidden" name="publicSlug" value={event.public_slug} />
                  <ReportFields target="organizer" />
                  <button
                    type="submit"
                    className="focus-ring mt-4 min-h-11 w-full rounded-xl border border-brand-error px-4 text-sm font-semibold text-brand-error"
                  >
                    Kirim laporan organizer
                  </button>
                </form>
              </details>
            </section>
          ) : null}

          {event.is_organizer ? (
            <section className="border-t border-brand-border py-10" aria-labelledby="event-organizer-title">
              <div className="max-w-3xl">
                <p className="section-label">Kontrol Event</p>
                <h2 id="event-organizer-title" className="mt-2 font-heading text-2xl font-semibold text-brand-navy">
                  Kelola sebagai organizer
                </h2>
                <p className="mt-2 text-sm leading-6 text-brand-muted">
                  Organizer hanya mengelola Event ini. Akses staff, Anonymous Chat,
                  Identity Reveal, dan Contact Reveal tetap tertutup.
                </p>
              </div>

              {event.can_edit ? (
                <div className="mt-7 rounded-[22px] border border-brand-border bg-white p-5 sm:p-7">
                  <EventForm
                    action={updateCampusEventAction}
                    event={event}
                    submitLabel="Simpan perubahan"
                  />
                </div>
              ) : null}

              <div className="mt-7 grid gap-5 lg:grid-cols-2">
                {event.can_cancel_event ? (
                  <details className="rounded-[22px] border border-brand-border bg-white p-5">
                    <summary className="focus-ring cursor-pointer rounded-lg font-heading text-lg font-semibold text-brand-navy">
                      Batalkan Event
                    </summary>
                    <p className="mt-3 text-sm leading-6 text-brand-muted">
                      RSVP dan evidence tetap disimpan. Event yang dibatalkan tidak dapat
                      dipulihkan pada v1 dan tidak mengirim notifikasi otomatis.
                    </p>
                    <form action={cancelCampusEventAction} className="mt-5">
                      <input type="hidden" name="publicSlug" value={event.public_slug} />
                      <button
                        type="submit"
                        className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-error px-4 text-sm font-semibold text-brand-error"
                      >
                        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                        Ya, batalkan Event
                      </button>
                    </form>
                  </details>
                ) : null}
                {event.can_archive ? (
                  <details className="rounded-[22px] border border-brand-border bg-white p-5">
                    <summary className="focus-ring cursor-pointer rounded-lg font-heading text-lg font-semibold text-brand-navy">
                      Arsipkan Event
                    </summary>
                    <p className="mt-3 text-sm leading-6 text-brand-muted">
                      Arsip menyimpan riwayat dan bukti moderasi, tetapi menutup akses
                      discovery serta RSVP baru.
                    </p>
                    <form action={archiveCampusEventAction} className="mt-5">
                      <input type="hidden" name="publicSlug" value={event.public_slug} />
                      <button
                        type="submit"
                        className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-navy px-4 text-sm font-semibold text-brand-navy"
                      >
                        <Archive className="h-4 w-4" aria-hidden="true" />
                        Arsipkan Event
                      </button>
                    </form>
                  </details>
                ) : null}
              </div>
              <div className="mt-7 grid gap-5 lg:grid-cols-2">
                <form action={setCampusEventCircleAction} className="rounded-[22px] border border-brand-border bg-white p-5">
                  <input type="hidden" name="publicSlug" value={event.public_slug} />
                  <label className="text-sm font-semibold text-brand-navy">
                    Study Circle milikmu
                    <select
                      name="circlePublicSlug"
                      defaultValue={eventCircle?.circle_public_slug ?? ""}
                      className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-white px-4 text-sm"
                    >
                      <option value="">Tidak ditautkan</option>
                      {circleOptions.map((circle) => (
                        <option key={circle.public_slug} value={circle.public_slug}>
                          {circle.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="focus-ring mt-3 min-h-11 rounded-xl border border-brand-navy px-4 text-sm font-semibold">
                    Simpan tautan Circle
                  </button>
                </form>
                <form action={checkInCampusEventTicketAction} className="rounded-[22px] border border-brand-border bg-white p-5">
                  <input type="hidden" name="publicSlug" value={event.public_slug} />
                  <label className="text-sm font-semibold text-brand-navy">
                    Token tiket peserta
                    <input
                      name="ticketToken"
                      required
                      pattern="[0-9a-f]{64}"
                      autoComplete="off"
                      className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 text-sm"
                    />
                  </label>
                  <button className="focus-ring mt-3 min-h-11 rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white">
                    Check-in peserta
                  </button>
                </form>
              </div>
              {!event.can_edit && !event.can_cancel_event && !event.can_archive ? (
                <p className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-brand-muted">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  Tidak ada perubahan organizer yang tersedia untuk status ini.
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}
