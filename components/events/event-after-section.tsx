import {
  claimEventCertificateAction,
  submitEventFeedbackAction,
} from "@/app/app/events/after-actions";
import { MascotHead } from "@/components/brand/mascot-head";
import { StarRatingInput } from "@/components/events/star-rating-input";
import type { EventAfterState } from "@/lib/events/after";
import {
  CERTIFICATE_BLOCKER_COPY,
  CERTIFICATE_NAME_MAX,
  EVENT_FEEDBACK_COMMENT_MAX,
} from "@/lib/events/after-rules";
import { Award, Download, ExternalLink, NotebookPen } from "lucide-react";
import Link from "next/link";

const stateCopy: Record<string, { tone: "ok" | "error"; text?: string }> = {
  "feedback-saved": { tone: "ok", text: "Makasih! Ulasanmu tersimpan." },
  "feedback-error": { tone: "error" },
  "certificate-issued": { tone: "ok", text: "Sertifikatmu sudah jadi." },
  "certificate-error": { tone: "error" },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(
    new Date(value),
  );
}

export function EventAfterSection({
  publicSlug,
  state,
  isOrganizer,
  flash,
  notice,
}: {
  publicSlug: string;
  state: EventAfterState;
  isOrganizer: boolean;
  flash?: string;
  notice?: string;
}) {
  const message = flash ? stateCopy[flash] : undefined;
  const messageText = message ? (message.text ?? notice ?? "Belum berhasil. Coba lagi.") : null;
  const certificate = state.certificate;
  const showFeedback = !isOrganizer && (state.canGiveFeedback || state.feedback);
  const showCertificate = !isOrganizer && certificate.enabled;
  if (!state.hasEnded || (!state.recap && !showFeedback && !showCertificate)) return null;

  return (
    <section aria-label="Setelah acara" className="border-b border-brand-border py-9">
      <p className="font-hand text-xl text-brand-blue">Acaranya sudah selesai</p>
      <h2 className="mt-1 font-heading text-2xl font-semibold text-brand-navy">Setelah acara</h2>

      {messageText ? (
        <p
          role={message?.tone === "error" ? "alert" : "status"}
          className={`mt-4 border-l-2 pl-4 text-sm font-medium ${
            message?.tone === "error" ? "border-brand-error text-brand-error" : "border-brand-blue text-brand-blue"
          }`}
        >
          {messageText}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {state.recap ? (
          <article
            id="rekap"
            className="scroll-mt-24 rounded-2xl border-2 border-brand-navy bg-white p-5 shadow-[4px_4px_0_#0F1B33] sm:p-6 lg:col-span-2"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-blue">
              <NotebookPen className="h-4 w-4" aria-hidden="true" />
              Rekap dari penyelenggara
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words leading-7 text-brand-navy">
              {state.recap.body}
            </p>
            <p className="mt-3 text-xs text-brand-muted">
              Terbit {formatDate(state.recap.publishedAt)}
              {state.recap.updatedAt !== state.recap.publishedAt
                ? `, diperbarui ${formatDate(state.recap.updatedAt)}`
                : ""}
            </p>
          </article>
        ) : null}

        {showFeedback ? (
          <div id="ulasan" className="scroll-mt-24 rounded-2xl border border-brand-border bg-white p-5 sm:p-6">
            <h3 className="font-heading text-lg font-semibold text-brand-navy">
              {state.feedback ? "Ulasanmu" : "Gimana acaranya?"}
            </h3>
            <p className="mt-1 text-sm leading-6 text-brand-muted">
              Penyelenggara hanya melihat ringkasan nilai. Komentar tampil tanpa nama samaran,
              dan baru dibuka setelah ada minimal tiga ulasan.
            </p>
            {state.canGiveFeedback ? (
              <form action={submitEventFeedbackAction} className="mt-5 space-y-5">
                <input type="hidden" name="publicSlug" value={publicSlug} />
                <StarRatingInput defaultValue={state.feedback?.rating} />
                <fieldset>
                  <legend className="text-sm font-semibold text-brand-navy">Mau ikut acara serupa lagi?</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      ["yes", "Mau"],
                      ["no", "Belum tentu"],
                      ["", "Lewati"],
                    ].map(([value, label]) => (
                      <label
                        key={value || "skip"}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-brand-border px-4 text-sm text-brand-navy has-[:checked]:border-brand-navy has-[:checked]:bg-[#EAF1FF] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-blue"
                      >
                        <input
                          type="radio"
                          name="wouldAttendAgain"
                          value={value}
                          defaultChecked={
                            value === ""
                              ? state.feedback?.wouldAttendAgain == null
                              : state.feedback?.wouldAttendAgain === (value === "yes")
                          }
                          className="sr-only"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label htmlFor="feedback-comment" className="text-sm font-semibold text-brand-navy">
                    Komentar (opsional)
                  </label>
                  <textarea
                    id="feedback-comment"
                    name="comment"
                    rows={3}
                    maxLength={EVENT_FEEDBACK_COMMENT_MAX}
                    defaultValue={state.feedback?.comment ?? ""}
                    placeholder="Apa yang paling berguna? Apa yang bisa lebih baik?"
                    className="focus-ring mt-2 w-full resize-y rounded-xl border border-brand-border bg-white px-4 py-3 text-sm leading-6 text-brand-navy"
                  />
                  <p className="mt-1 text-xs text-brand-muted">
                    Jangan tulis nama, nomor, atau kontak siapa pun.
                  </p>
                </div>
                <button
                  type="submit"
                  className="focus-ring inline-flex min-h-12 items-center rounded-xl border-2 border-brand-navy bg-brand-blue px-5 text-sm font-semibold text-white shadow-[3px_3px_0_#0F1B33]"
                >
                  {state.feedback ? "Perbarui ulasan" : "Kirim ulasan"}
                </button>
                <p className="text-xs text-brand-muted">
                  Ulasan bisa diubah sampai {formatDate(state.feedbackClosesAt)}.
                </p>
              </form>
            ) : state.feedback ? (
              <p className="mt-4 text-sm text-brand-navy">
                Kamu memberi nilai {state.feedback.rating} dari 5. Masa ulasan sudah ditutup.
              </p>
            ) : null}
          </div>
        ) : null}

        {showCertificate ? (
          <div id="sertifikat" className="scroll-mt-24 rounded-2xl border border-brand-border bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Award className="mt-0.5 h-6 w-6 shrink-0 text-brand-blue" aria-hidden="true" />
              <div className="min-w-0">
                <h3 className="font-heading text-lg font-semibold text-brand-navy">Sertifikat kehadiran</h3>
                <p className="mt-1 text-sm leading-6 text-brand-muted">
                  {certificate.eligibility === "registered"
                    ? "Untuk semua peserta yang terdaftar."
                    : "Untuk peserta yang tercatat hadir saat check-in."}
                  {certificate.requiresFeedback ? " Isi ulasan dulu sebelum mengambil." : ""}
                </p>
              </div>
            </div>

            {certificate.code ? (
              <div className="mt-5 rounded-xl bg-[#EAF1FF] p-4">
                <p className="text-sm text-brand-navy">
                  Atas nama <strong>{certificate.recipientName}</strong>
                </p>
                <p className="mt-1 font-mono text-sm tracking-wider text-brand-blue">{certificate.code}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/certificates/${certificate.code}`}
                    className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-brand-navy bg-white px-4 text-sm font-semibold text-brand-navy"
                  >
                    Lihat sertifikat
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <a
                    href={`/certificates/${certificate.code}/image`}
                    download={`sertifikat-${certificate.code}.png`}
                    className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-brand-navy bg-brand-blue px-4 text-sm font-semibold text-white"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Unduh PNG
                  </a>
                </div>
              </div>
            ) : certificate.blocker ? (
              <div className="mt-5 flex items-center gap-4 rounded-xl border-2 border-dashed border-brand-navy/15 p-4">
                <span className="w-12 shrink-0" aria-hidden="true">
                  <MascotHead expression={certificate.blocker === "feedback_required" ? "penasaran" : "mikir"} />
                </span>
                <p className="text-sm leading-6 text-brand-muted">
                  {CERTIFICATE_BLOCKER_COPY[certificate.blocker]}
                </p>
              </div>
            ) : (
              <form action={claimEventCertificateAction} className="mt-5 space-y-4">
                <input type="hidden" name="publicSlug" value={publicSlug} />
                <div>
                  <label htmlFor="certificate-name" className="text-sm font-semibold text-brand-navy">
                    Nama di sertifikat
                  </label>
                  <input
                    id="certificate-name"
                    name="recipientName"
                    required
                    minLength={2}
                    maxLength={CERTIFICATE_NAME_MAX}
                    autoComplete="name"
                    className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy"
                  />
                </div>
                <label className="flex items-start gap-3 text-sm leading-6 text-brand-navy">
                  <input
                    type="checkbox"
                    name="confirmsPublicName"
                    required
                    className="mt-1 h-4 w-4 shrink-0 accent-brand-blue"
                  />
                  <span>
                    Aku paham nama ini tampil di sertifikat dan di halaman cek keaslian bagi siapa pun
                    yang punya kodenya. Penyelenggara tidak melihat nama ini.
                  </span>
                </label>
                <button
                  type="submit"
                  className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-brand-navy bg-brand-blue px-5 text-sm font-semibold text-white shadow-[3px_3px_0_#0F1B33]"
                >
                  <Award className="h-4 w-4" aria-hidden="true" />
                  Ambil sertifikat
                </button>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
