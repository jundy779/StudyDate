import {
  addCampusEventRegistrationQuestionAction,
  archiveCampusEventAction,
  cancelCampusEventAction,
  deleteCampusEventRegistrationQuestionAction,
  setCampusEventCircleAction,
  updateCampusEventAction,
  updateCampusEventRegistrationSettingsAction,
} from "@/app/app/events/actions";
import { AppShell } from "@/components/app/app-shell";
import { EventForm } from "@/components/events/event-form";
import { EventCoverUploader } from "@/components/events/event-cover-uploader";
import { getCampusEventOnlineLink } from "@/lib/events/media";
import { eventCoverUrl } from "@/lib/events/online";
import { EventManagementShell } from "@/components/events/event-management-shell";
import { getCampusEventManagement } from "@/lib/events/management";
import {
  getCampusEventCircle,
  listCampusEventRegistrationQuestions,
  listCampusEventSeriesSessions,
  listMyCircleOptionsForEvent,
} from "@/lib/events/service";
import { Archive, CalendarPlus, CopyPlus, ShieldAlert } from "lucide-react";
import Link from "next/link";

type SettingsPageProps = {
  params: Promise<{ publicSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function localTimestamp(value: string | null, timezone: string) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

const questionTypeLabels: Record<string, string> = {
  short_text: "Jawaban singkat",
  single_select: "Pilih satu",
  multi_select: "Pilih beberapa",
  checkbox: "Kotak persetujuan",
};

export default async function SettingsPage({
  params,
  searchParams,
}: SettingsPageProps) {
  const { publicSlug } = await params;
  const { event, overview } = await getCampusEventManagement(publicSlug, "team");
  const seriesEnabled = process.env.EVENT_SERIES_ENABLED === "true";
  const [questions, eventCircle, circleOptions, seriesSessions, onlineLink] = await Promise.all([
    listCampusEventRegistrationQuestions(event.public_slug),
    getCampusEventCircle(event.public_slug),
    listMyCircleOptionsForEvent(),
    seriesEnabled
      ? listCampusEventSeriesSessions(event.public_slug)
      : Promise.resolve([]),
    getCampusEventOnlineLink(event.public_slug),
  ]);
  const query = await searchParams;
  const state = first(query.state);
  const notice = first(query.notice);
  const successCopy: Record<string, string> = {
    updated: "Detail acara berhasil diperbarui.",
    "settings-updated": "Pengaturan registrasi berhasil diperbarui.",
    "series-updated": `${first(query.count) ?? "Beberapa"} pertemuan berhasil diperbarui.`,
    "question-added": "Pertanyaan registrasi berhasil ditambahkan.",
    "question-deleted": "Pertanyaan registrasi berhasil dihapus.",
  };

  return (
    <AppShell current="events">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <EventManagementShell active="settings" event={event} overview={overview}>
          {state && successCopy[state] ? (
            <p role="status" className="mb-7 border-l-2 border-brand-blue pl-4 text-sm font-medium text-brand-blue">
              {successCopy[state]}
            </p>
          ) : null}
          {notice ? (
            <p role="alert" className="mb-7 border-l-2 border-brand-error pl-4 text-sm font-medium text-brand-error">
              {notice}
            </p>
          ) : null}

          <section
            aria-labelledby="duplicate-event-title"
            className="mb-10 rounded-[18px] border border-brand-border bg-white p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6"
          >
            <div className="min-w-0">
              <p className="section-label">Acara berikutnya</p>
              <h2 id="duplicate-event-title" className="mt-2 font-heading text-2xl font-semibold text-brand-navy">
                Jadwalkan pertemuan berikutnya
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
                Pilih pola mingguan atau bulanan. Kamu tetap memeriksa tanggalnya
                sebelum acara dibuat. Peserta dan riwayat tidak ikut disalin.
              </p>
            </div>
            <div className="mt-5 grid w-full shrink-0 gap-3 sm:mt-0 sm:w-auto sm:grid-cols-2">
              <Link
                href={`/app/events/create?duplicate=${event.public_slug}&cadence=weekly`}
                className="focus-ring inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-navy px-5 text-sm font-semibold text-white"
              >
                <CopyPlus className="h-4 w-4" aria-hidden="true" />
                Minggu depan
              </Link>
              <Link
                href={`/app/events/create?duplicate=${event.public_slug}&cadence=monthly`}
                className="focus-ring inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-brand-border bg-white px-5 text-sm font-semibold text-brand-navy"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                Bulan depan
              </Link>
            </div>
          </section>

          <section aria-labelledby="registration-settings-title">
            <p className="section-label">Pendaftaran</p>
            <h2 id="registration-settings-title" className="mt-2 font-heading text-2xl font-semibold text-brand-navy">
              Pengaturan registrasi
            </h2>
            <form action={updateCampusEventRegistrationSettingsAction} className="mt-6 max-w-2xl space-y-5 border-y border-brand-border py-6">
              <input type="hidden" name="publicSlug" value={event.public_slug} />
              <input type="hidden" name="timezone" value={event.timezone_name} />
              <label className="block text-sm font-semibold text-brand-navy">
                Mode registrasi
                <select name="registrationMode" defaultValue={event.registration_mode} className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm">
                  <option value="instant">Langsung diterima</option>
                  <option value="approval">Perlu persetujuan penyelenggara</option>
                </select>
              </label>
              <label className="flex min-h-11 items-start gap-3 text-sm leading-6 text-brand-navy">
                <input type="checkbox" name="waitlistEnabled" defaultChecked={event.waitlist_enabled} className="mt-1 h-4 w-4 accent-brand-blue" />
                <span>Aktifkan daftar tunggu saat kapasitas penuh.</span>
              </label>
              <label className="block text-sm font-semibold text-brand-navy">
                Registrasi ditutup
                <input
                  type="datetime-local"
                  name="registrationClosesAt"
                  defaultValue={localTimestamp(event.registration_closes_at, event.timezone_name)}
                  className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm"
                />
                <span className="mt-2 block text-xs font-normal leading-5 text-brand-muted">
                  Kosongkan agar pendaftaran tetap terbuka sampai acara dimulai.
                </span>
              </label>
              <button className="focus-ring min-h-12 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white">
                Simpan pengaturan
              </button>
            </form>
          </section>

          <section className="mt-10 border-t border-brand-border pt-9" aria-labelledby="registration-questions-title">
            <p className="section-label">Pertanyaan tambahan</p>
            <h2 id="registration-questions-title" className="mt-2 font-heading text-2xl font-semibold text-brand-navy">
              Pertanyaan registrasi
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-brand-muted">
              Jangan meminta NIM, kontak, alamat privat, kredensial, atau data yang sudah tersedia pada profil.
            </p>

            {questions.length ? (
              <ol className="mt-6 divide-y divide-brand-border border-y border-brand-border">
                {questions.map((question) => (
                  <li key={question.question_public_id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-brand-navy">{question.prompt}</p>
                      <p className="mt-1 text-xs text-brand-muted">
                        {questionTypeLabels[question.question_type] ?? "Pertanyaan"} · {question.is_required ? "Wajib" : "Opsional"}
                      </p>
                      {question.options.length ? (
                        <p className="mt-2 break-words text-sm leading-6 text-brand-muted">{question.options.join(" · ")}</p>
                      ) : null}
                    </div>
                    <form action={deleteCampusEventRegistrationQuestionAction}>
                      <input type="hidden" name="publicSlug" value={event.public_slug} />
                      <input type="hidden" name="questionPublicId" value={question.question_public_id} />
                      <button className="focus-ring min-h-11 rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-navy">
                        Hapus
                      </button>
                    </form>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-6 text-sm text-brand-muted">Belum ada pertanyaan khusus.</p>
            )}

            <form action={addCampusEventRegistrationQuestionAction} className="mt-7 max-w-2xl space-y-5 border-l-2 border-brand-border pl-5">
              <input type="hidden" name="publicSlug" value={event.public_slug} />
              <label className="block text-sm font-semibold text-brand-navy">
                Jenis pertanyaan
                <select name="questionType" defaultValue="short_text" className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm">
                  <option value="short_text">Jawaban singkat</option>
                  <option value="single_select">Pilih satu</option>
                  <option value="multi_select">Pilih beberapa</option>
                  <option value="checkbox">Persetujuan checkbox</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-brand-navy">
                Pertanyaan
                <input name="prompt" required minLength={5} maxLength={160} className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm" />
              </label>
              <label className="block text-sm font-semibold text-brand-navy">
                Opsi (untuk jenis pilihan)
                <textarea name="optionsText" rows={4} maxLength={960} className="focus-ring mt-2 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-sm" aria-describedby="event-question-options-help" />
                <span id="event-question-options-help" className="mt-2 block text-xs font-normal leading-5 text-brand-muted">
                  Satu opsi per baris, minimal dua. Kosongkan untuk jawaban singkat atau checkbox.
                </span>
              </label>
              <label className="flex min-h-11 items-start gap-3 text-sm text-brand-navy">
                <input type="checkbox" name="isRequired" className="mt-1 h-4 w-4 accent-brand-blue" />
                <span>Jawaban wajib diisi.</span>
              </label>
              <button className="focus-ring min-h-12 rounded-xl bg-brand-navy px-5 text-sm font-semibold text-white">
                Tambah pertanyaan
              </button>
            </form>
          </section>

          {event.status === "scheduled" && !event.is_past ? (
            <section className="mt-10 border-t border-brand-border pt-9" aria-labelledby="event-cover-settings-title">
              <p className="font-hand text-xl text-brand-blue">Biar acaramu mudah dikenali</p>
              <h2 id="event-cover-settings-title" className="mt-1 font-heading text-2xl font-semibold text-brand-navy">
                Foto sampul
              </h2>
              <div className="mt-6">
                <EventCoverUploader
                  publicSlug={event.public_slug}
                  category={event.category}
                  title={event.title}
                  city={event.city}
                  coverUrl={eventCoverUrl(event.cover_path)}
                />
              </div>
            </section>
          ) : null}

          <section className="mt-10 border-t border-brand-border pt-9" aria-labelledby="event-detail-settings-title">
            <p className="section-label">Detail acara</p>
            <h2 id="event-detail-settings-title" className="mt-2 font-heading text-2xl font-semibold text-brand-navy">
              Edit detail acara
            </h2>
            {event.can_edit ? (
              <div className="mt-6 max-w-3xl">
                <EventForm
                  action={updateCampusEventAction}
                  event={event}
                  seriesEditing={seriesSessions.length > 1}
                  submitLabel="Simpan perubahan"
                  onlineUrl={onlineLink?.meetingUrl}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-brand-muted">
                Detail acara tidak dapat diedit pada status atau rentang waktu ini.
              </p>
            )}
          </section>

          <section className="mt-10 border-t border-brand-border pt-9" aria-labelledby="event-link-settings-title">
            <h2 id="event-link-settings-title" className="font-heading text-2xl font-semibold text-brand-navy">
              Study Circle dan status acara
            </h2>
            <form action={setCampusEventCircleAction} className="mt-6 max-w-2xl">
              <input type="hidden" name="publicSlug" value={event.public_slug} />
              <label className="block text-sm font-semibold text-brand-navy">
                Study Circle milikmu
                <select name="circlePublicSlug" defaultValue={eventCircle?.circle_public_slug ?? ""} className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm">
                  <option value="">Tidak ditautkan</option>
                  {circleOptions.map((circle) => (
                    <option key={circle.public_slug} value={circle.public_slug}>{circle.name}</option>
                  ))}
                </select>
              </label>
              <button className="focus-ring mt-3 min-h-11 rounded-xl border border-brand-navy px-4 text-sm font-semibold text-brand-navy">
                Simpan tautan Circle
              </button>
            </form>

            <div className="mt-7 grid max-w-3xl gap-4 sm:grid-cols-2">
              {event.can_cancel_event ? (
                <details className="border border-brand-border bg-white p-5">
                  <summary className="focus-ring cursor-pointer rounded-lg font-semibold text-brand-navy">Batalkan acara</summary>
                  <p className="mt-3 text-sm leading-6 text-brand-muted">Riwayat registrasi dan evidence tetap disimpan.</p>
                  <form action={cancelCampusEventAction} className="mt-4">
                    <input type="hidden" name="publicSlug" value={event.public_slug} />
                    <button className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-error px-4 text-sm font-semibold text-brand-error">
                      <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                      Ya, batalkan
                    </button>
                  </form>
                </details>
              ) : null}
              {event.can_archive ? (
                <details className="border border-brand-border bg-white p-5">
                  <summary className="focus-ring cursor-pointer rounded-lg font-semibold text-brand-navy">Arsipkan acara</summary>
                  <p className="mt-3 text-sm leading-6 text-brand-muted">Arsip menutup discovery dan registrasi baru.</p>
                  <form action={archiveCampusEventAction} className="mt-4">
                    <input type="hidden" name="publicSlug" value={event.public_slug} />
                    <button className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-navy px-4 text-sm font-semibold text-brand-navy">
                      <Archive className="h-4 w-4" aria-hidden="true" />
                      Arsipkan
                    </button>
                  </form>
                </details>
              ) : null}
            </div>
          </section>
        </EventManagementShell>
      </main>
    </AppShell>
  );
}
