import {
  revokeEventCertificateAction,
  setEventCertificateSettingsAction,
  setEventRecapAction,
} from "@/app/app/events/after-actions";
import { AppShell } from "@/components/app/app-shell";
import { MascotHead } from "@/components/brand/mascot-head";
import { EventManagementShell } from "@/components/events/event-management-shell";
import {
  getEventAfterSummary,
  listEventCertificateRecipients,
  listEventFeedbackComments,
} from "@/lib/events/after";
import {
  EVENT_FEEDBACK_COMMENTS_THRESHOLD,
  EVENT_RECAP_MAX,
  ratingDistributionPercent,
} from "@/lib/events/after-rules";
import { getCampusEventManagement } from "@/lib/events/management";
import { Award, MessageSquareQuote, NotebookPen, Star } from "lucide-react";

type AfterPageProps = {
  params: Promise<{ publicSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const successCopy: Record<string, string> = {
  "recap-saved": "Rekap tersimpan. Peserta mendapat notifikasi saat rekap pertama kali terbit.",
  "recap-removed": "Rekap dihapus.",
  "certificate-settings-saved": "Pengaturan sertifikat tersimpan.",
  "certificate-revoked": "Sertifikat dicabut.",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function percent(part: number, total: number) {
  return total ? `${Math.round((part / total) * 100)}%` : "0%";
}

export default async function EventAfterPage({ params, searchParams }: AfterPageProps) {
  const { publicSlug } = await params;
  const { event, overview } = await getCampusEventManagement(publicSlug, "team");
  const [summary, recipients] = await Promise.all([
    getEventAfterSummary(event.public_slug),
    listEventCertificateRecipients(event.public_slug),
  ]);
  const comments =
    summary && summary.feedbackCount >= EVENT_FEEDBACK_COMMENTS_THRESHOLD
      ? await listEventFeedbackComments(event.public_slug)
      : [];
  const query = await searchParams;
  const state = first(query.state);
  const notice = first(query.notice);
  const distribution = summary ? ratingDistributionPercent(summary.ratingCounts) : [];

  return (
    <AppShell current="events">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <EventManagementShell active="after" event={event} overview={overview}>
          {state && successCopy[state] ? (
            <p role="status" className="mb-7 border-l-2 border-brand-blue pl-4 text-sm font-medium text-brand-blue">
              {successCopy[state]}
            </p>
          ) : null}
          {state === "error" && notice ? (
            <p role="alert" className="mb-7 border-l-2 border-brand-error pl-4 text-sm font-medium text-brand-error">
              {notice}
            </p>
          ) : null}

          {!summary ? (
            <div className="flex items-center gap-5 rounded-2xl border-2 border-dashed border-brand-navy/15 bg-white p-6">
              <span className="w-16 shrink-0" aria-hidden="true">
                <MascotHead expression="ngantuk" />
              </span>
              <p className="text-sm leading-6 text-brand-muted">
                Ulasan, rekap, dan sertifikat belum tersedia di server. Coba lagi nanti.
              </p>
            </div>
          ) : (
            <>
              <section aria-labelledby="after-stats-title">
                <p className="font-hand text-xl text-brand-blue">
                  {summary.hasEnded ? "Hasil acaramu" : "Muncul setelah acara selesai"}
                </p>
                <h2 id="after-stats-title" className="mt-1 font-heading text-2xl font-semibold text-brand-navy">
                  Kehadiran dan ulasan
                </h2>
                <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[
                    ["Terdaftar", String(summary.registeredCount), "tanpa penyelenggara"],
                    [
                      "Hadir (check-in)",
                      String(summary.checkedInCount),
                      `${percent(summary.checkedInCount, summary.registeredCount)} dari terdaftar`,
                    ],
                    [
                      "Ulasan masuk",
                      String(summary.feedbackCount),
                      `${percent(summary.feedbackCount, summary.registeredCount)} peserta mengulas`,
                    ],
                    [
                      "Rata-rata nilai",
                      summary.ratingAverage === null ? "-" : `${summary.ratingAverage.toFixed(1)} / 5`,
                      `${percent(summary.wouldAttendAgainCount, summary.feedbackCount)} mau ikut lagi`,
                    ],
                  ].map(([label, value, help]) => (
                    <div key={label} className="rounded-2xl border border-brand-border bg-white p-4 sm:p-5">
                      <dt className="text-xs font-semibold text-brand-muted">{label}</dt>
                      <dd className="mt-2 font-heading text-3xl font-semibold text-brand-navy">{value}</dd>
                      <dd className="mt-1 text-xs text-brand-muted">{help}</dd>
                    </div>
                  ))}
                </dl>

                {summary.feedbackCount ? (
                  <div className="mt-6 rounded-2xl border border-brand-border bg-white p-5 sm:p-6">
                    <h3 className="text-sm font-semibold text-brand-navy">Sebaran nilai</h3>
                    <ul className="mt-4 space-y-2">
                      {[5, 4, 3, 2, 1].map((star) => (
                        <li key={star} className="grid grid-cols-[3.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
                          <span className="inline-flex items-center gap-1 text-brand-navy">
                            {star}
                            <Star className="h-3.5 w-3.5 fill-[#FFC83D] text-brand-navy" aria-hidden="true" />
                          </span>
                          <span className="h-3 overflow-hidden rounded-full bg-brand-surface" aria-hidden="true">
                            <span
                              className="block h-full rounded-full bg-brand-blue"
                              style={{ width: `${distribution[star - 1]}%` }}
                            />
                          </span>
                          <span className="text-right text-brand-muted">
                            {summary.ratingCounts[star - 1]}
                            <span className="sr-only"> ulasan bernilai {star}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-6 rounded-2xl border border-brand-border bg-white p-5 sm:p-6">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
                    <MessageSquareQuote className="h-4 w-4 text-brand-blue" aria-hidden="true" />
                    Komentar peserta
                  </h3>
                  {summary.feedbackCount < EVENT_FEEDBACK_COMMENTS_THRESHOLD ? (
                    <p className="mt-2 text-sm leading-6 text-brand-muted">
                      Komentar dibuka setelah ada minimal {EVENT_FEEDBACK_COMMENTS_THRESHOLD} ulasan,
                      supaya penulisnya tidak mudah ditebak.
                    </p>
                  ) : comments.length ? (
                    <ul className="mt-4 space-y-3">
                      {comments.map((item, index) => (
                        <li key={index} className="rounded-xl bg-brand-surface p-4">
                          <p className="text-xs font-semibold text-brand-blue">Nilai {item.rating} dari 5</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-brand-navy">
                            {item.comment}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-brand-muted">Belum ada yang menulis komentar.</p>
                  )}
                </div>
              </section>

              <section id="rekap" className="mt-10 scroll-mt-24 border-t border-brand-border pt-9" aria-labelledby="recap-title">
                <h2 id="recap-title" className="flex items-center gap-2 font-heading text-2xl font-semibold text-brand-navy">
                  <NotebookPen className="h-5 w-5 text-brand-blue" aria-hidden="true" />
                  Rekap untuk peserta
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
                  Ringkasan materi, ucapan terima kasih, atau info lanjutan. Hanya peserta terdaftar
                  dan tim acara yang bisa membaca. Jangan tulis nama asli atau kontak peserta.
                </p>
                {summary.hasEnded ? (
                  <form action={setEventRecapAction} className="mt-5 max-w-3xl space-y-3">
                    <input type="hidden" name="publicSlug" value={event.public_slug} />
                    <label htmlFor="recap-body" className="sr-only">Isi rekap</label>
                    <textarea
                      id="recap-body"
                      name="body"
                      rows={7}
                      maxLength={EVENT_RECAP_MAX}
                      defaultValue={summary.recapBody ?? ""}
                      className="focus-ring w-full resize-y rounded-xl border border-brand-border bg-white px-4 py-3 text-sm leading-6 text-brand-navy"
                    />
                    <p className="text-xs text-brand-muted">
                      Kosongkan lalu simpan untuk menghapus rekap. Notifikasi hanya dikirim saat rekap pertama kali terbit.
                    </p>
                    <button className="focus-ring inline-flex min-h-12 items-center rounded-xl border-2 border-brand-navy bg-brand-blue px-5 text-sm font-semibold text-white shadow-[3px_3px_0_#0F1B33]">
                      {summary.recapBody ? "Simpan rekap" : "Terbitkan rekap"}
                    </button>
                  </form>
                ) : (
                  <p className="mt-4 text-sm text-brand-muted">Rekap bisa ditulis setelah acara selesai.</p>
                )}
              </section>

              <section id="sertifikat" className="mt-10 scroll-mt-24 border-t border-brand-border pt-9" aria-labelledby="certificate-title">
                <h2 id="certificate-title" className="flex items-center gap-2 font-heading text-2xl font-semibold text-brand-navy">
                  <Award className="h-5 w-5 text-brand-blue" aria-hidden="true" />
                  Sertifikat kehadiran
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
                  Peserta mengambil sendiri setelah acara selesai dan menulis namanya sendiri. Kamu
                  hanya melihat nama samaran pendaftar, tidak melihat nama di sertifikat. Setiap
                  sertifikat punya kode yang bisa dicek siapa pun di studydate.id.
                </p>
                <form action={setEventCertificateSettingsAction} className="mt-5 max-w-3xl space-y-4 rounded-2xl border border-brand-border bg-white p-5 sm:p-6">
                  <input type="hidden" name="publicSlug" value={event.public_slug} />
                  <label className="flex items-start gap-3 text-sm font-semibold text-brand-navy">
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={summary.certificateEnabled}
                      className="mt-0.5 h-4 w-4 accent-brand-blue"
                    />
                    Sediakan sertifikat untuk acara ini
                  </label>
                  <fieldset>
                    <legend className="text-sm font-semibold text-brand-navy">Siapa yang berhak</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {[
                        ["checked_in", "Yang tercatat hadir", "Berdasarkan check-in QR atau manual."],
                        ["registered", "Semua peserta terdaftar", "Cocok untuk acara online tanpa check-in."],
                      ].map(([value, label, help]) => (
                        <label
                          key={value}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-border p-3 has-[:checked]:border-brand-navy has-[:checked]:bg-[#EAF1FF]"
                        >
                          <input
                            type="radio"
                            name="eligibility"
                            value={value}
                            defaultChecked={summary.certificateEligibility === value}
                            className="mt-1 h-4 w-4 accent-brand-blue"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-brand-navy">{label}</span>
                            <span className="block text-xs leading-5 text-brand-muted">{help}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="flex items-start gap-3 text-sm text-brand-navy">
                    <input
                      type="checkbox"
                      name="requiresFeedback"
                      defaultChecked={summary.certificateRequiresFeedback}
                      className="mt-1 h-4 w-4 accent-brand-blue"
                    />
                    Wajib isi ulasan sebelum mengambil sertifikat
                  </label>
                  <button className="focus-ring inline-flex min-h-12 items-center rounded-xl border-2 border-brand-navy bg-white px-5 text-sm font-semibold text-brand-navy">
                    Simpan pengaturan
                  </button>
                </form>

                <div className="mt-6 max-w-3xl">
                  <h3 className="text-sm font-semibold text-brand-navy">
                    Sudah diambil: {summary.certificateCount}
                  </h3>
                  {recipients.length ? (
                    <ul className="mt-3 divide-y divide-brand-border rounded-2xl border border-brand-border bg-white">
                      {recipients.map((item) => (
                        <li key={item.registration_public_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-brand-navy">{item.public_alias}</p>
                            <p className="text-xs text-brand-muted">
                              {item.revoked_by === "organizer"
                                ? "Dicabut penyelenggara"
                                : item.revoked_by === "recipient"
                                  ? "Dibatalkan pemiliknya"
                                  : `Diambil ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: event.timezone_name }).format(new Date(item.issued_at))}`}
                            </p>
                          </div>
                          {item.revoked_by !== "organizer" && item.revoked_by !== "recipient" ? (
                            <details className="group">
                              <summary className="focus-ring inline-flex min-h-11 cursor-pointer list-none items-center rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-error">
                                Cabut
                              </summary>
                              <form action={revokeEventCertificateAction} className="mt-2 max-w-xs rounded-xl border border-red-200 bg-red-50 p-3">
                                <input type="hidden" name="publicSlug" value={event.public_slug} />
                                <input type="hidden" name="registrationPublicId" value={item.registration_public_id} />
                                <p className="text-xs leading-5 text-brand-navy">
                                  Peserta ini tidak bisa mengambil ulang sertifikatnya. Kode lama akan tampil sebagai dicabut.
                                </p>
                                <button className="focus-ring mt-2 min-h-11 rounded-xl bg-brand-error px-4 text-sm font-semibold text-white">
                                  Ya, cabut sertifikat
                                </button>
                              </form>
                            </details>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-brand-muted">Belum ada yang mengambil sertifikat.</p>
                  )}
                </div>
              </section>
            </>
          )}
        </EventManagementShell>
      </main>
    </AppShell>
  );
}
