import {
  invalidateVerification,
  submitManualAcademicReview,
  submitVerificationReview,
} from "@/app/admin/verifications/[requestId]/actions";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { StaffShell } from "@/components/staff/staff-shell";
import { HelpTip, Notice, Panel, StaffPage, staffButton, staffField, staffLabel } from "@/components/staff/ui";
import { requireVerificationReviewer } from "@/lib/staff/authorization";
import { listVerificationQueue } from "@/lib/staff/service";
import { ManualStudentRegistryVerifier } from "@/lib/verification/registry";
import { StudentVerificationReviewService } from "@/lib/verification/review";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Suspense } from "react";
import { connection } from "next/server";

const uuid = z.string().uuid();
type Props = { params: Promise<{ requestId: string }>; searchParams: Promise<{ state?: string }> };

async function VerificationReviewContent({ params, searchParams }: Props) {
  await connection();
  const access = await requireVerificationReviewer();
  const parsedId = uuid.safeParse((await params).requestId);
  if (!parsedId.success) notFound();
  const service = new StudentVerificationReviewService(new ManualStudentRegistryVerifier());
  const [claim, queue, query] = await Promise.all([
    service.getManualReviewClaim(parsedId.data, access.user.id).catch(() => null),
    listVerificationQueue(),
    searchParams,
  ]);
  const request = queue.find((item) => item.request_id === parsedId.data);
  if (!claim || !request) notFound();
  const manual = request.academic_match_source === "manual";

  return (
    <StaffShell role={access.role} current="verification" access={access}>
      <StaffPage
        kicker={`${manual ? "Data akademik diperiksa petugas" : "Data akademik cocok otomatis"} · ...${parsedId.data.slice(-8)}`}
        title="Periksa data akademik"
        description="Cocokkan data di bawah dengan bukti. Data ini hanya terlihat di halaman ini dan tidak masuk ke riwayat."
        actions={
          <Link href="/admin/verifications" className={staffButton.quiet}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali ke antrean
          </Link>
        }
      >
        {query.state === "error" ? (
          <Notice tone="danger">Keputusan belum dapat disimpan. Periksa kembali hasil yang dipilih.</Notice>
        ) : null}

        <Panel title="Data yang perlu diperiksa" quiet>
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              ["Nama sesuai PDDikti", claim.legalName],
              ["NIM", claim.nim],
              ["Kampus", claim.campus],
              ["Program/Jenjang", `${claim.studyProgram} · ${claim.degreeLevel}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-brand-surface px-4 py-3">
                <dt className="text-sm text-brand-muted">{label}</dt>
                <dd className="mt-1 break-words font-semibold text-brand-navy">{value}</dd>
              </div>
            ))}
          </dl>
          {manual || request.method === "student_card" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {manual ? (
                <a
                  href={`/api/staff/verifications/${parsedId.data}/evidence?kind=pddikti`}
                  target="_blank"
                  rel="noreferrer"
                  className={staffButton.secondary}
                >
                  Buka bukti PDDIKTI
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}
              {request.method === "student_card" ? (
                <a
                  href={`/api/staff/verifications/${parsedId.data}/evidence?kind=student_card`}
                  target="_blank"
                  rel="noreferrer"
                  className={staffButton.secondary}
                >
                  Buka kartu mahasiswa
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          ) : null}
          <p className="mt-3 text-xs leading-5 text-brand-muted">Tautan bukti hanya berlaku 5 menit setelah dibuka.</p>
        </Panel>

        {request.status === "verified" ? (
          <Panel
            title="Batalkan tanda verifikasi"
            description="Pakai hanya kalau hasil verifikasi terbukti tidak valid. Tindakan ini tercatat dan tidak langsung menghapus bukti."
          >
            <form action={invalidateVerification}>
              <input type="hidden" name="requestId" value={parsedId.data} />
              <ConfirmSubmitButton
                triggerLabel="Batalkan tanda verifikasi"
                title="Batalkan tanda verifikasi?"
                description="Akun ini akan kehilangan tanda terverifikasi. Gunakan hanya jika hasil pemeriksaan memang tidak valid."
                confirmLabel="Ya, batalkan verifikasi"
                className={staffButton.danger}
              />
            </form>
          </Panel>
        ) : manual && request.pddikti_match_status !== "matched" ? (
          <Panel
            title="Keputusan data akademik"
            description="Tangkapan layar PDDikti hanya membuktikan datanya cocok, belum membuktikan akun ini milik mahasiswa tersebut."
          >
            <form action={submitManualAcademicReview} className="flex flex-wrap gap-2">
              <input type="hidden" name="requestId" value={parsedId.data} />
              <button name="decision" value="approve" className={staffButton.primary}>
                Setujui data akademik
              </button>
              <button name="decision" value="needs_action" className={staffButton.secondary}>
                Minta bukti tambahan
              </button>
              <button name="decision" value="reject" className={staffButton.dangerQuiet}>
                Tolak data akademik
              </button>
            </form>
          </Panel>
        ) : (
          <Panel
            title="Periksa kepemilikan akun"
            description="Tanda terverifikasi hanya tersimpan kalau data akademik cocok, kepemilikan sudah terbukti, dan kamu menyetujui hasil akhir."
          >
            <form action={submitVerificationReview} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="requestId" value={parsedId.data} />
              <input type="hidden" name="academicResult" value={request.pddikti_match_status} />
              <label className={staffLabel}>
                Bukti kepemilikan
                <select name="ownershipResult" defaultValue={request.ownership_status} className={staffField}>
                  <option value="not_checked">Belum diperiksa</option>
                  {request.method === "campus_email" ? (
                    <option value="campus_email_verified">Email kampus terverifikasi</option>
                  ) : (
                    <option value="document_verified">Dokumen terverifikasi</option>
                  )}
                  <option value="failed">Gagal</option>
                </select>
              </label>
              <label className={staffLabel}>
                Keputusan
                <select name="requestStatus" defaultValue={request.status} className={staffField}>
                  <option value="under_review">Sedang diperiksa</option>
                  <option value="needs_action">Perlu tindakan</option>
                  <option value="verified">Verifikasi</option>
                  <option value="rejected">Tolak</option>
                  <option value="expired">Kedaluwarsa</option>
                </select>
              </label>
              <label className={`${staffLabel} sm:col-span-2`}>
                Alasan (bila perlu)
                <select name="rejectionReasonCode" className={staffField}>
                  <option value="">Tanpa alasan</option>
                  <option value="ownership_failed">Kepemilikan gagal</option>
                  <option value="evidence_unreadable">Bukti tidak terbaca</option>
                  <option value="additional_information_required">Perlu informasi tambahan</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <button className={staffButton.primary}>Simpan pemeriksaan kepemilikan</button>
              </div>
            </form>
            <div className="mt-4">
              <HelpTip label="Kapan pilih apa?">
                Pilih &ldquo;Perlu tindakan&rdquo; kalau mahasiswa perlu mengirim ulang bukti. Pilih
                &ldquo;Tolak&rdquo; kalau bukti jelas bukan milik mahasiswa tersebut, lalu isi alasannya.
              </HelpTip>
            </div>
          </Panel>
        )}
      </StaffPage>
    </StaffShell>
  );
}

export default function VerificationReviewPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">Menyiapkan detail pemeriksaan...</p>
        </main>
      }
    >
      <VerificationReviewContent {...props} />
    </Suspense>
  );
}
