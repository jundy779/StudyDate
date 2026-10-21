import { updateModerationReport } from "@/app/owner/moderation/actions";
import { StaffShell } from "@/components/staff/staff-shell";
import {
  HelpTip,
  Notice,
  Panel,
  StaffPage,
  StatusChip,
  staffButton,
  staffField,
  staffLabel,
} from "@/components/staff/ui";
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
import { ArrowLeft } from "lucide-react";
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
      <StaffPage
        kicker={`Khusus Owner · laporan ...${report.report_id.slice(-8)}`}
        title={reason}
        description="Hanya informasi yang berkaitan dengan laporan yang ditampilkan. Kontak pribadi, persetujuan yang belum disepakati kedua pihak, dan seluruh riwayat percakapan tetap tidak dibuka."
        actions={
          <Link href="/owner/moderation" className={staffButton.quiet}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali ke antrean
          </Link>
        }
      >
        {query.state === "saved" ? <Notice tone="success">Status laporan tersimpan.</Notice> : null}
        {query.state === "error" ? <Notice tone="danger">{MODERATION_COPY.genericError}</Notice> : null}

        <Panel title="Isi laporan" quiet>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <StatusChip tone={open ? "stop" : "muted"}>
              {MODERATION_STATUS_LABELS[report.moderation_status]}
            </StatusChip>
            <StatusChip tone="info">
              {MODERATION_TARGET_LABELS[report.target_kind] ?? report.target_kind}
            </StatusChip>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Dibuat", date.format(new Date(report.created_at))],
              ["Akun yang dilaporkan", `...${report.subject_suffix}`],
              ["Pelapor", `...${report.reporter_suffix}`],
              [
                "Percakapan",
                report.conversation_public_id ? `${report.conversation_public_id.slice(0, 8)}...` : "Tidak ada",
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-brand-surface px-4 py-3">
                <dt className="text-brand-muted">{label}</dt>
                <dd className="mt-1 font-semibold text-brand-navy">{value}</dd>
              </div>
            ))}
          </dl>

          {report.details ? (
            <div className="mt-5">
              <h3 className="font-semibold text-brand-navy">Detail dari pelapor</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-brand-navy">{report.details}</p>
            </div>
          ) : null}

          {report.referenced_message_excerpt ? (
            <div className="mt-5">
              <h3 className="font-semibold text-brand-navy">Cuplikan pesan terkait</h3>
              <p className="mt-2 whitespace-pre-wrap rounded-xl border-l-4 border-brand-blue bg-brand-surface p-4 text-sm leading-6 text-brand-navy">
                {report.referenced_message_excerpt}
              </p>
            </div>
          ) : null}

          {report.internal_note ? (
            <div className="mt-5">
              <h3 className="font-semibold text-brand-navy">Catatan internal</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-brand-muted">{report.internal_note}</p>
            </div>
          ) : null}
        </Panel>

        {open ? (
          <Panel title="Tindak lanjut" description="Catatan ini hanya terlihat oleh tim, tidak dikirim ke mahasiswa.">
            <form action={updateModerationReport} className="grid gap-4">
              <input type="hidden" name="reportId" value={report.report_id} />
              <label className={staffLabel}>
                {MODERATION_COPY.noteLabel}
                <textarea
                  name="internalNote"
                  maxLength={INTERNAL_NOTE_MAX}
                  rows={3}
                  defaultValue={report.internal_note ?? ""}
                  className={`${staffField} py-3 font-normal`}
                  placeholder={MODERATION_COPY.noteHint}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" name="newStatus" value="resolved" className={staffButton.primary}>
                  Selesaikan
                </button>
                {report.moderation_status === "submitted" ? (
                  <button type="submit" name="newStatus" value="under_review" className={staffButton.secondary}>
                    Tandai sedang ditinjau
                  </button>
                ) : null}
                <button type="submit" name="newStatus" value="dismissed" className={staffButton.quiet}>
                  Abaikan
                </button>
              </div>
            </form>
            <div className="mt-4">
              <HelpTip label="Bedanya Selesaikan dan Abaikan?">
                Pilih Selesaikan kalau laporan benar dan sudah ditangani. Pilih Abaikan kalau laporan tidak
                terbukti atau salah kirim. Keduanya menutup laporan dan tidak bisa dibuka lagi dari halaman ini.
              </HelpTip>
            </div>
          </Panel>
        ) : (
          <Notice tone="info">
            Laporan ini sudah ditutup dengan status {MODERATION_STATUS_LABELS[report.moderation_status]}. Statusnya
            tidak dapat dibuka kembali dari halaman ini.
          </Notice>
        )}
      </StaffPage>
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
