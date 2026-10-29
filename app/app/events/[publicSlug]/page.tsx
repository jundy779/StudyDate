import {
  getMyStudentAccess,
  isEducationalEventCategory,
  requireEventFeatureAccess,
} from "@/lib/account/student-access";
import {
  blockCampusEventOrganizerAction,
  cancelCampusEventRsvpAction,
  registerCampusEventAction,
  reportCampusEventAction,
  reportCampusEventMessageAction,
  sendCampusEventMessageAction,
} from "@/app/app/events/actions";
import { AppShell } from "@/components/app/app-shell";
import { Notice, StatusChip, appButton } from "@/components/app/ui";
import { getMascotForAlias } from "@/lib/people/constants";
import Image from "next/image";
import { EventRegistrationForm } from "@/components/events/event-registration-form";
import { EventCover } from "@/components/events/event-cover";
import { EventTicketIssuer } from "@/components/events/event-ticket-issuer";
import { listMyCampusEventTicketOrders, myCampusEventRequiresTicketOrder } from "@/lib/events/ticketing-service";
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
import { getCampusEventOnlineLink } from "@/lib/events/media";
import { getMyEventAfterState } from "@/lib/events/after";
import { EventAfterSection } from "@/components/events/event-after-section";
import { eventCoverUrl, meetingPlatformLabel } from "@/lib/events/online";
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  Globe2,
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

function formatDay(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: timezone }).format(new Date(value));
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short", timeZone: timezone }).format(new Date(value));
}

/** Bulan singkat dan tanggal untuk ikon kalender kecil, sesuai zona waktu acara. */
function calendarParts(value: string, timezone: string) {
  const date = new Date(value);
  return {
    month: new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: timezone }).format(date).replace(".", ""),
    day: new Intl.DateTimeFormat("id-ID", { day: "numeric", timeZone: timezone }).format(date),
  };
}

function isSameLocalDay(start: string, end: string, timezone: string) {
  const key = (value: string) =>
    new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeZone: timezone }).format(new Date(value));
  return key(start) === key(end);
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
  await requireEventFeatureAccess();
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const ownProfile = await getPrivateProfile(user.id);
  if (!ownProfile?.onboarding_completed_at) redirect("/onboarding");

  const { publicSlug: rawSlug } = await params;
  const parsedSlug = eventSlugSchema.safeParse(rawSlug);
  if (!parsedSlug.success) notFound();
  const event = await getCampusEvent(parsedSlug.data);
  if (!event) notFound();
  const access = await getMyStudentAccess();
  if (
    access?.tier === "school" &&
    !isEducationalEventCategory(event.category) &&
    !event.rsvp_status
  ) {
    redirect("/app/events?akses=sekolah");
  }

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
  const attendanceMode = event.attendance_mode ?? "offline";
  const [
    eventCircle,
    eventMessages,
    eventAnnouncements,
    ticketState,
    registrationQuestions,
    onlineLink,
    afterState,
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
    attendanceMode !== "offline" ? getCampusEventOnlineLink(event.public_slug) : null,
    event.is_past ? getMyEventAfterState(event.public_slug) : null,
  ]);
  const venueSummary =
    attendanceMode === "online"
      ? `Online (${event.venue_name})`
      : `${event.venue_name}, ${event.venue_area}, ${event.city}`;
  const ticketingEnabled = process.env.EVENT_TICKETING_ENABLED === "true";
  const [ticketOrderRequired, myTicketOrders] = ticketingEnabled && event.rsvp_status === "going"
    ? await Promise.all([
        myCampusEventRequiresTicketOrder(event.public_slug),
        listMyCampusEventTicketOrders(event.public_slug),
      ])
    : [false, []] as const;
  const hasValidTicketOrder = myTicketOrders.some((order) =>
    order.status === "free" || order.status === "paid"
  );
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

  const startParts = calendarParts(event.starts_at, event.timezone_name);
  const sameDay = isSameLocalDay(event.starts_at, event.ends_at, event.timezone_name);
  const canRegisterDirectly =
    !event.is_organizer &&
    event.status === "scheduled" &&
    !event.is_past &&
    !registrationClosed &&
    event.can_rsvp &&
    !["pending", "going", "waitlisted"].includes(event.rsvp_status ?? "");
  const registerLabel =
    event.registration_mode === "approval"
      ? "Kirim pendaftaran"
      : isFull && event.waitlist_enabled
        ? "Masuk daftar tunggu"
        : "Ikut acara";
  const fillPercent = Math.min(100, Math.round((event.attendee_count / Math.max(1, event.capacity)) * 100));

  return (
    <AppShell current="events">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell py-6 sm:py-10 lg:py-12">
          <Link href="/app/events" className={appButton.quiet}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali ke Acara Kampus
          </Link>

          <div className="mt-5 grid gap-3 empty:hidden">
            {state && successCopy[state] ? <Notice tone="success">{successCopy[state]}</Notice> : null}
            {notice ? (
              <Notice tone="danger">{notice}</Notice>
            ) : state === "error" ? (
              <Notice tone="danger">Tindakan belum dapat diproses. Coba lagi sebentar.</Notice>
            ) : null}
          </div>

          {/* Tata letak dua kolom ala halaman acara: poster dan penyelenggara di kiri, detail di kanan. */}
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-x-12">
            <div className="mx-auto w-full max-w-md lg:col-start-1 lg:row-start-1 lg:max-w-none">
              <EventCover
                category={event.category}
                title={event.title}
                city={attendanceMode === "online" ? "Online" : event.city}
                variant="poster"
                className="w-full"
                coverUrl={eventCoverUrl(event.cover_path)}
              />
            </div>

            <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusChip tone="info">{categoryLabels[event.category]}</StatusChip>
                <StatusChip tone="muted">{event.scope === "open" ? "Terbuka" : "Kampus yang sama"}</StatusChip>
                {event.is_official ? (
                  <StatusChip tone="go">
                    <BadgeCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    Resmi
                  </StatusChip>
                ) : null}
                <StatusChip
                  tone={
                    event.status === "cancelled" ? "stop" : event.is_past || event.status === "archived" ? "muted" : isFull ? "warn" : "go"
                  }
                >
                  {statusLabel}
                </StatusChip>
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
                      {startParts.month}
                    </span>
                    <span className="grid place-items-center font-heading text-xl font-semibold text-brand-navy">
                      {startParts.day}
                    </span>
                  </span>
                  <dd className="min-w-0">
                    <p className="font-semibold text-brand-navy">
                      <time dateTime={event.starts_at}>{formatDay(event.starts_at, event.timezone_name)}</time>
                    </p>
                    <p className="text-sm text-brand-muted">
                      {sameDay ? (
                        <>
                          {formatTime(event.starts_at, event.timezone_name)} –{" "}
                          <time dateTime={event.ends_at}>{formatTime(event.ends_at, event.timezone_name)}</time>
                        </>
                      ) : (
                        <>
                          {formatTime(event.starts_at, event.timezone_name)} sampai{" "}
                          <time dateTime={event.ends_at}>{formatDateTime(event.ends_at, event.timezone_name)}</time>
                        </>
                      )}{" "}
                      {timezoneShort(event.timezone_name)}
                    </p>
                  </dd>
                </div>

                <div className="flex items-center gap-4">
                  <dt className="sr-only">{attendanceMode === "online" ? "Acara online" : "Tempat publik"}</dt>
                  <span
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border-2 border-brand-navy bg-white text-brand-blue shadow-[2px_2px_0_#0F1B33]"
                    aria-hidden="true"
                  >
                    {attendanceMode === "online" ? <Globe2 className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
                  </span>
                  <dd className="min-w-0">
                    {attendanceMode === "online" ? (
                      <>
                        <p className="break-words font-semibold text-brand-navy">Online lewat {event.venue_name}</p>
                        <p className="text-sm text-brand-muted">Link dibagikan ke peserta yang sudah terdaftar.</p>
                      </>
                    ) : (
                      <>
                        <p className="break-words font-semibold text-brand-navy">{event.venue_name}</p>
                        <p className="break-words text-sm text-brand-muted">
                          {event.venue_area}, {event.city}
                          {attendanceMode === "hybrid" ? (
                            <span className="font-semibold text-brand-blue"> · Bisa juga ikut online</span>
                          ) : null}
                        </p>
                      </>
                    )}
                  </dd>
                </div>
              </dl>

              <section
                aria-labelledby="event-registration-title"
                className="mt-8 rounded-[22px] border-2 border-brand-navy bg-white p-5 shadow-[4px_4px_0_#0F1B33] sm:p-6"
              >
                <h2 id="event-registration-title" className="font-heading text-lg font-semibold text-brand-navy">
                  Pendaftaran
                </h2>
                <div className="mt-3 grid gap-3">
                  {event.rsvp_status === "pending" ? (
                    <Notice tone="info">Pendaftaranmu sedang ditinjau penyelenggara.</Notice>
                  ) : event.rsvp_status === "going" ? (
                    <Notice tone="success">Pendaftaranmu sudah dikonfirmasi. Sampai jumpa di acara!</Notice>
                  ) : event.rsvp_status === "waitlisted" ? (
                    <Notice tone="warn">
                      Kamu berada di daftar tunggu dan akan masuk sebagai peserta secara otomatis jika ada tempat.
                    </Notice>
                  ) : event.rsvp_status === "declined" ? (
                    <Notice tone="info">
                      Pendaftaranmu sebelumnya tidak disetujui. Kamu dapat mendaftar ulang selama pendaftaran masih terbuka.
                    </Notice>
                  ) : event.rsvp_status === "cancelled" ? (
                    <Notice tone="info">Pendaftaranmu telah dibatalkan.</Notice>
                  ) : canRegisterDirectly ? (
                    <p className="text-sm leading-6 text-brand-muted">
                      {event.registration_mode === "approval"
                        ? "Penyelenggara memeriksa pendaftaran dulu sebelum kamu dikonfirmasi."
                        : "Pendaftaran langsung diterima selama masih ada tempat."}{" "}
                      Kamu tetap tampil dengan nama samaran.
                    </p>
                  ) : event.is_past || event.status !== "scheduled" ? (
                    <p className="text-sm leading-6 text-brand-muted">Pendaftaran sudah tidak dibuka.</p>
                  ) : registrationClosed ? (
                    <p className="text-sm leading-6 text-brand-muted">Pendaftaran sudah ditutup penyelenggara.</p>
                  ) : null}

                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {canRegisterDirectly && registrationQuestions.length === 0 ? (
                      <form action={registerCampusEventAction} className="sm:flex-1">
                        <input type="hidden" name="publicSlug" value={event.public_slug} />
                        <input type="hidden" name="answers" value="{}" />
                        <button className={`${appButton.primary} w-full`}>{registerLabel}</button>
                      </form>
                    ) : null}
                    {canManageEvent ? (
                      <Link href={managementHref} className={`${appButton.primary} sm:flex-1`}>
                        Kelola acara
                      </Link>
                    ) : null}
                    {process.env.EVENT_TICKETING_ENABLED === "true" && event.status === "scheduled" ? (
                      <Link href={`/app/events/${event.public_slug}/tickets`} className={`${appButton.secondary} sm:flex-1`}>
                        Pilih tiket
                      </Link>
                    ) : null}
                    {["pending", "waitlisted"].includes(event.rsvp_status ?? "") &&
                    event.status === "scheduled" &&
                    !event.is_past ? (
                      <form action={cancelCampusEventRsvpAction}>
                        <input type="hidden" name="publicSlug" value={event.public_slug} />
                        <button className={`${appButton.quiet} w-full`}>Batalkan pendaftaran</button>
                      </form>
                    ) : null}
                  </div>

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
                        <button type="submit" className={`${appButton.secondary} w-full`}>
                          Ya, batalkan keikutsertaan
                        </button>
                      </form>
                    </details>
                  ) : null}
                </div>

                {registrationQuestions.length && event.can_rsvp ? (
                  <div className="mt-5 border-t border-brand-border pt-5" aria-labelledby="registration-form-title">
                    <h3 id="registration-form-title" className="font-heading text-lg font-semibold text-brand-navy">
                      Lengkapi pendaftaran acara
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-brand-muted">
                      Jawaban hanya dapat dilihat oleh penyelenggara dan rekan penyelenggara melalui daftar pendaftaran yang dilindungi.
                    </p>
                    <div className="mt-4">
                      <EventRegistrationForm
                        publicSlug={event.public_slug}
                        questions={registrationQuestions}
                        profile={{
                          campus: ownProfile.campus,
                          studyProgram: ownProfile.study_program,
                          semester: ownProfile.semester,
                        }}
                        submitLabel={registerLabel}
                      />
                    </div>
                  </div>
                ) : null}
              </section>

              {onlineLink?.hasLink ? (
                <section className="mt-6" aria-labelledby="event-online-link-title">
                  <div className="flex flex-col gap-4 rounded-2xl border-2 border-brand-navy bg-[#EAF1FF] p-5 shadow-[4px_4px_0_#0F1B33] sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="min-w-0">
                      <h2 id="event-online-link-title" className="font-heading text-lg font-semibold text-brand-navy">
                        Link acara online
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-brand-muted">
                        {onlineLink.meetingUrl
                          ? "Jangan sebarkan link ini di luar peserta. Masuk dengan nama samaranmu kalau ingin tetap anonim."
                          : event.status !== "scheduled"
                            ? "Link tidak lagi ditampilkan karena acara sudah tidak berjalan."
                            : "Link muncul di sini setelah pendaftaranmu diterima."}
                      </p>
                    </div>
                    {onlineLink.meetingUrl ? (
                      <a
                        href={onlineLink.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className={`${appButton.primary} shrink-0`}
                      >
                        Buka {meetingPlatformLabel(onlineLink.meetingUrl) ?? "link"}
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">(tab baru)</span>
                      </a>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {event.rsvp_status === "going" ? (
                <section className="mt-6" aria-labelledby="event-ticket-title">
                  <h2 id="event-ticket-title" className="font-heading text-xl font-semibold text-brand-navy">
                    Tiket kehadiran
                  </h2>
                  {ticketOrderRequired && !hasValidTicketOrder ? (
                    <div className="mt-3 rounded-2xl border border-brand-border bg-white p-5">
                      <p className="text-sm leading-6 text-brand-muted">
                        Pendaftaranmu sudah dikonfirmasi. Ambil tiket acara dulu supaya QR masuk bisa dipakai.
                      </p>
                      <Link href={`/app/events/${event.public_slug}/tickets`} className={`${appButton.primary} mt-3`}>
                        Pilih tiket
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <EventTicketIssuer
                        publicSlug={event.public_slug}
                        ticketState={ticketState}
                        eventTitle={event.title}
                        attendeeAlias={ownProfile.public_alias}
                        startsAt={event.starts_at}
                        timezone={event.timezone_name}
                        venue={venueSummary}
                      />
                    </div>
                  )}
                </section>
              ) : null}

              <section className="mt-10" aria-labelledby="event-about-title">
                <h2
                  id="event-about-title"
                  className="border-b border-brand-border pb-2 text-sm font-semibold text-brand-muted"
                >
                  Tentang acara
                </h2>
                <p className="mt-4 whitespace-pre-wrap break-words text-base leading-8 text-brand-navy">
                  {event.description}
                </p>
              </section>

              {afterState ? (
                <div className="mt-10">
                  <EventAfterSection
                    publicSlug={event.public_slug}
                    state={afterState}
                    isOrganizer={event.is_organizer}
                    flash={state}
                    notice={notice}
                  />
                </div>
              ) : null}

              {eventAnnouncements.length ? (
                <section id="event-announcements" className="mt-10" aria-labelledby="event-announcements-title">
                  <h2
                    id="event-announcements-title"
                    className="border-b border-brand-border pb-2 text-sm font-semibold text-brand-muted"
                  >
                    Kabar dari penyelenggara
                  </h2>
                  <div className="divide-y divide-brand-border">
                    {eventAnnouncements.map((announcement) => (
                      <article key={announcement.announcement_public_id} className="py-5">
                        <h3 className="font-heading text-lg font-semibold text-brand-navy">{announcement.title}</h3>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-brand-muted">
                          {announcement.body}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {canUseParticipantFeatures ? (
                <section className="mt-10" aria-labelledby="event-chat-title">
                  <h2 id="event-chat-title" className="border-b border-brand-border pb-2 text-sm font-semibold text-brand-muted">
                    Diskusi peserta
                  </h2>
                  <div className="mt-4 space-y-3">
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
                                <button className={`${appButton.dangerQuiet} mt-3`}>Kirim laporan pesan</button>
                              </form>
                            </details>
                          ) : null}
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-brand-muted">Belum ada pesan. Sapa peserta lain atau tanya hal teknis di sini.</p>
                    )}
                  </div>
                  <form action={sendCampusEventMessageAction} className="mt-4">
                    <input type="hidden" name="publicSlug" value={event.public_slug} />
                    <input type="hidden" name="idempotencyKey" value={randomBytes(18).toString("base64url")} />
                    <label className="text-sm font-semibold text-brand-navy">
                      Pesan teks
                      <textarea
                        name="body"
                        required
                        maxLength={800}
                        rows={3}
                        className="focus-ring mt-2 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-sm"
                      />
                    </label>
                    <button className={`${appButton.secondary} mt-3`}>Kirim pesan</button>
                  </form>
                </section>
              ) : null}

              {attendanceMode !== "online" ? (
                <aside className="mt-10" aria-labelledby="event-safety-title">
                  <Notice tone="info" title="Periksa kembali lokasi sebelum berangkat">
                    <span id="event-safety-title" className="sr-only">Pertemuan di tempat publik</span>
                    Pastikan tempat ramai, mudah diakses, dan masih beroperasi. Konfirmasi informasi penyelenggara dan
                    pemeriksaan StudyDate membantu mengurangi risiko, tetapi bukan jaminan keselamatan.
                  </Notice>
                </aside>
              ) : null}

              {canManageEvent ? (
                <section className="mt-10 rounded-[22px] border border-brand-border bg-white p-5 sm:p-6" aria-labelledby="event-manage-link-title">
                  <p className="app-kicker">Untuk penyelenggara</p>
                  <h2 id="event-manage-link-title" className="mt-1 font-heading text-xl font-semibold text-brand-navy">
                    Pendaftaran, kehadiran, tim, dan pengaturan
                  </h2>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Link href={managementHref} className={appButton.primary}>
                      Kelola acara
                    </Link>
                    {event.can_check_in ? (
                      <Link href={`/app/events/${event.public_slug}/manage/check-in/scan`} className={appButton.secondary}>
                        Buka pemindai QR
                      </Link>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="grid min-w-0 content-start gap-6 lg:col-start-1 lg:row-start-2" aria-label="Penyelenggara dan peserta">
              <section aria-labelledby="event-host-title">
                <h2 id="event-host-title" className="border-b border-brand-border pb-2 text-sm font-semibold text-brand-muted">
                  Diselenggarakan oleh
                </h2>
                <div className="mt-3 flex items-center gap-3">
                  <Image
                    src={getMascotForAlias(event.organizer_alias)}
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-full border-2 border-brand-navy bg-[#EAF1FF] object-cover object-top"
                  />
                  <p className="inline-flex min-w-0 items-center gap-1.5 break-words font-semibold text-brand-navy">
                    {event.organizer_alias}
                    {event.organizer_is_verified ? (
                      <BadgeCheck className="h-4 w-4 shrink-0 text-brand-blue" aria-label="Penyelenggara terverifikasi" />
                    ) : null}
                  </p>
                </div>
              </section>

              <section aria-labelledby="event-attendee-gate">
                <h2 className="border-b border-brand-border pb-2 text-sm font-semibold text-brand-muted">Peserta</h2>
                <p className="mt-3 font-semibold text-brand-navy">
                  <UsersRound className="mr-1.5 inline h-4 w-4 align-[-2px] text-brand-blue" aria-hidden="true" />
                  {event.attendee_count} dari {event.capacity} peserta
                </p>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-brand-border"
                  role="progressbar"
                  aria-label="Tempat yang sudah terisi"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={fillPercent}
                >
                  <div className="h-full rounded-full bg-brand-blue" style={{ width: `${fillPercent}%` }} />
                </div>
                <p className="mt-2 text-sm leading-6 text-brand-muted">
                  {event.registration_mode === "approval"
                    ? "Pendaftaran perlu persetujuan"
                    : "Pendaftaran langsung diterima"}
                  {isFull ? (event.waitlist_enabled ? " · Daftar tunggu tersedia" : " · Penuh") : ""}
                  {registrationClosed ? " · Pendaftaran ditutup" : ""}
                </p>
                {event.scope === "campus" && event.campus_scope ? (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-brand-muted">
                    <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                    {event.campus_scope}
                  </p>
                ) : null}
                <h3 id="event-attendee-gate" className="mt-4 text-sm font-semibold text-brand-navy">
                  Direktori peserta tetap privat
                </h3>
                <p className="mt-1 text-sm leading-6 text-brand-muted">
                  Peserta biasa tidak dapat melihat siapa saja yang hadir. Daftar peserta
                  hanya tersedia bagi penyelenggara dan tim acara di ruang pengelolaan.
                </p>
              </section>

              {eventCircle ? (
                <section aria-labelledby="event-circle-title">
                  <h2 id="event-circle-title" className="border-b border-brand-border pb-2 text-sm font-semibold text-brand-muted">
                    Circle terkait
                  </h2>
                  <Link
                    href={`/app/circles/${eventCircle.circle_public_slug}`}
                    className="focus-ring mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-blue hover:underline"
                  >
                    {eventCircle.circle_name}
                  </Link>
                </section>
              ) : null}

              {!event.is_organizer ? (
                <section aria-labelledby="event-organizer-report-title" className="grid gap-2">
                  <h2 id="event-organizer-report-title" className="border-b border-brand-border pb-2 text-sm font-semibold text-brand-muted">
                    Ada yang tidak beres?
                  </h2>
                  <details className="rounded-xl border border-brand-border bg-white p-4">
                    <summary className="focus-ring cursor-pointer rounded-lg text-sm font-semibold text-brand-muted">
                      Laporkan acara
                    </summary>
                    <form action={reportCampusEventAction} className="mt-4">
                      <input type="hidden" name="publicSlug" value={event.public_slug} />
                      <ReportFields target="event" />
                      <button type="submit" className={`${appButton.dangerQuiet} mt-4 w-full`}>
                        Kirim laporan acara
                      </button>
                    </form>
                  </details>
                  <details className="rounded-xl border border-brand-border bg-white p-4">
                    <summary className="focus-ring cursor-pointer rounded-lg text-sm font-semibold text-brand-muted">
                      Laporkan penyelenggara
                    </summary>
                    <form action={reportCampusEventAction} className="mt-4">
                      <input type="hidden" name="publicSlug" value={event.public_slug} />
                      <ReportFields target="organizer" />
                      <button type="submit" className={`${appButton.dangerQuiet} mt-4 w-full`}>
                        Kirim laporan penyelenggara
                      </button>
                    </form>
                  </details>
                  <details className="rounded-xl border border-brand-border bg-white p-4">
                    <summary className="focus-ring cursor-pointer rounded-lg text-sm font-semibold text-brand-muted">
                      Blokir penyelenggara
                    </summary>
                    <p className="mt-3 text-sm leading-6 text-brand-muted">
                      Penyelenggara tidak dapat berinteraksi atau memberi akses tim kepadamu.
                      Riwayat acara dan pendaftaran yang perlu dipertahankan tidak otomatis
                      dihapus.
                    </p>
                    <form action={blockCampusEventOrganizerAction} className="mt-4">
                      <input type="hidden" name="publicSlug" value={event.public_slug} />
                      <input type="hidden" name="organizerAlias" value={event.organizer_alias} />
                      <button type="submit" className={`${appButton.dangerQuiet} w-full`}>
                        Ya, blokir penyelenggara
                      </button>
                    </form>
                  </details>
                </section>
              ) : null}
            </aside>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
