import { updateModerationReport } from "@/app/owner/moderation/actions";
import { StaffShell } from "@/components/staff/staff-shell";
import {
  INTERNAL_NOTE_MAX,
  MODERATION_COPY,
  MODERATION_STATUS_LABELS,
  MODERATION_TARGET_LABELS,
} from "@/lib/moderation/constants";
import { getModerationReport } from "@/lib/moderation/service";
import {
  REPORT_REASON_LABELS,
  type ReportReasonCode,
} from "@/lib/introductions/constants";
import { requireOwner } from "@/lib/staff/authorization";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

const date = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

type Props = {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ state?: string }>;
};

async function ModerationDetailContent({ params, searchParams }: Props) {
  const access = await requireOwner();
  const { reportId } = await params;
  const query = await searchParams;

  let report: Awaited<ReturnType<typeof getModerationReport>> = null;
  try {
    report = await getModerationReport(reportId);
  } catch {
    report = null;
  }
  if (!report) notFound();

  const reason =
    REPORT_REASON_LABELS[report.reason_code as ReportReasonCode] ??
    report.reason_code;
  const open =
    report.moderation_status === "submitted" ||
    report.moderation_status === "under_review";

  return (
    <StaffShell role={access.role} current="moderation">
      <main className="min-h-svh bg-brand-surface">
        <div className="page-shell py-10 sm:py-14">
          <p className="section-label">Khusus Owner</p>
          <h1 className="mt-4 font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Laporan …{report.report_id.slice(-8)}
          </h1>
          <p className="mt-4 max-w-2xl text-brand-muted">
            Hanya informasi yang berkaitan dengan laporan yang ditampilkan.
            Kontak pribadi, persetujuan yang belum disepakati kedua pihak, dan
            seluruh riwayat percakapan tetap tidak dibuka.
          </p>

          {query.state === "saved" && (
            <p
              role="status"
              className="mt-6 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-brand-success"
            >
              Status laporan tersimpan.
            </p>
          )}
          {query.state === "error" && (
            <p
              role="status"
              className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-brand-error"
            >
              {MODERATION_COPY.genericError}
            </p>
          )}

          <section className="mt-8 space-y-4 rounded-[22px] border border-brand-border bg-white p-6">
            <p className="text-sm font-semibold text-brand-navy">
              {MODERATION_STATUS_LABELS[report.moderation_status]} ·{" "}
              {MODERATION_TARGET_LABELS[report.target_kind] ?? report.target_kind}{" "}
              · {reason}
            </p>
            <dl className="grid gap-3 text-sm text-brand-muted sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-brand-navy">Dibuat</dt>
                <dd>{date.format(new Date(report.created_at))}</dd>
              </div>
              <div>
                <dt className="font-semibold text-brand-navy">Subjek</dt>
                <dd className="font-mono text-xs">…{report.subject_suffix}</dd>
              </div>
              <div>
                <dt className="font-semibold text-brand-navy">Pelapor</dt>
                <dd className="font-mono text-xs">…{report.reporter_suffix}</dd>
              </div>
              <div>
                <dt className="font-semibold text-brand-navy">Percakapan</dt>
                <dd className="font-mono text-xs">
                  {report.conversation_public_id
                    ? `${report.conversation_public_id.slice(0, 8)}…`
                    : "—"}
                </dd>
              </div>
            </dl>

            {report.details ? (
              <div>
                <h2 className="font-heading text-lg font-semibold">
                  Detail dari pelapor
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-brand-navy">
                  {report.details}
                </p>
              </div>
            ) : null}

            {report.referenced_message_excerpt ? (
              <div>
                <h2 className="font-heading text-lg font-semibold">
                  Cuplikan pesan terkait
                </h2>
                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-brand-surface p-4 text-sm leading-6 text-brand-navy">
                  {report.referenced_message_excerpt}
                </p>
              </div>
            ) : null}

            {report.internal_note ? (
              <div>
                <h2 className="font-heading text-lg font-semibold">
                  Catatan internal
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-brand-muted">
                  {report.internal_note}
                </p>
              </div>
            ) : null}
          </section>

          {open ? (
            <section className="mt-6 rounded-[22px] border border-brand-border bg-white p-6">
              <h2 className="font-heading text-xl font-semibold">
                Perbarui status
              </h2>
              <form action={updateModerationReport} className="mt-5 grid gap-4">
                <input type="hidden" name="reportId" value={report.report_id} />
                <label className="text-sm font-semibold text-brand-navy">
                  {MODERATION_COPY.noteLabel}
                  <textarea
                    name="internalNote"
                    maxLength={INTERNAL_NOTE_MAX}
                    rows={3}
                    defaultValue={report.internal_note ?? ""}
                    className="focus-ring mt-2 w-full rounded-xl border border-brand-border px-4 py-3 text-sm font-normal text-brand-navy"
                    placeholder={MODERATION_COPY.noteHint}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {report.moderation_status === "submitted" ? (
                    <button
                      type="submit"
                      name="newStatus"
                      value="under_review"
                      className="focus-ring min-h-11 rounded-xl border border-brand-border px-4 text-sm font-semibold"
                    >
                      Tandai sedang ditinjau
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    name="newStatus"
                    value="resolved"
                    className="focus-ring min-h-11 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white"
                  >
                    Selesaikan
                  </button>
                  <button
                    type="submit"
                    name="newStatus"
                    value="dismissed"
                    className="focus-ring min-h-11 rounded-xl border border-brand-border px-4 text-sm font-semibold"
                  >
                    Abaikan
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <p className="mt-6 text-sm text-brand-muted">
              Laporan ini sudah ditutup dengan status {" "}
              {MODERATION_STATUS_LABELS[report.moderation_status]}. Statusnya
              tidak dapat dibuka kembali dari halaman ini.
            </p>
          )}

          <p className="mt-8">
            <Link
              href="/owner/moderation"
              className="focus-ring text-sm font-semibold text-brand-blue underline-offset-4 hover:underline"
            >
              Kembali ke antrean
            </Link>
          </p>
        </div>
      </main>
    </StaffShell>
  );
}

export default function OwnerModerationDetailPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            {MODERATION_COPY.loading}
          </p>
        </main>
      }
    >
      <ModerationDetailContent {...props} />
    </Suspense>
  );
}
