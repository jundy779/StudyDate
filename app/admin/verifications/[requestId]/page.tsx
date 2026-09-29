import {
  invalidateVerification,
  submitManualAcademicReview,
  submitVerificationReview,
} from "@/app/admin/verifications/[requestId]/actions";
import { StaffShell } from "@/components/staff/staff-shell";
import { requireVerificationReviewer } from "@/lib/staff/authorization";
import { listVerificationQueue } from "@/lib/staff/service";
import { ManualStudentRegistryVerifier } from "@/lib/verification/registry";
import { StudentVerificationReviewService } from "@/lib/verification/review";
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

  return <StaffShell role={access.role} current="verification" access={access}><main className="min-h-svh bg-brand-surface"><div className="page-shell py-10 sm:py-14">
    <Link href="/admin/verifications" className="focus-ring inline-flex min-h-11 items-center text-sm font-semibold text-brand-blue">← Kembali ke antrean</Link>
    <p className="section-label mt-5">{request.academic_match_source === "manual" ? "Data akademik diperiksa petugas" : "Data akademik cocok otomatis"} · …{parsedId.data.slice(-8)}</p><h1 className="mt-4 font-heading text-4xl font-semibold">Periksa data akademik</h1>
    {query.state === "error" && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-brand-error">Keputusan belum dapat disimpan. Periksa kembali hasil yang dipilih.</p>}
    <section className="mt-8 grid gap-5 rounded-[22px] border border-brand-border bg-white p-6 sm:grid-cols-2" aria-labelledby="claim-title"><h2 id="claim-title" className="font-heading text-xl font-semibold sm:col-span-2">Data yang perlu diperiksa</h2><div><p className="text-sm text-brand-muted">Nama sesuai PDDikti</p><p className="mt-1 font-semibold">{claim.legalName}</p></div><div><p className="text-sm text-brand-muted">NIM</p><p className="mt-1 font-semibold">{claim.nim}</p></div><div><p className="text-sm text-brand-muted">Kampus</p><p className="mt-1 font-semibold">{claim.campus}</p></div><div><p className="text-sm text-brand-muted">Program/Jenjang</p><p className="mt-1 font-semibold">{claim.studyProgram} · {claim.degreeLevel}</p></div><p className="text-xs leading-5 text-brand-muted sm:col-span-2">Data sensitif ini hanya tersedia untuk petugas pemeriksa pada halaman ini dan tidak dimasukkan ke riwayat aktivitas.</p></section>
    <div className="mt-5 flex flex-wrap gap-3">{request.academic_match_source === "manual" && <a href={`/api/staff/verifications/${parsedId.data}/evidence?kind=pddikti`} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-11 items-center rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold">Buka bukti PDDIKTI (5 menit)</a>}{request.method === "student_card" && <a href={`/api/staff/verifications/${parsedId.data}/evidence?kind=student_card`} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-11 items-center rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold">Buka kartu mahasiswa (5 menit)</a>}</div>
    {request.status === "verified" ? <form action={invalidateVerification} className="mt-8 rounded-[22px] border border-brand-error/40 bg-white p-6"><input type="hidden" name="requestId" value={parsedId.data} /><h2 className="font-heading text-xl font-semibold">Batalkan tanda verifikasi</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Gunakan hanya bila hasil verifikasi terbukti tidak valid. Tindakan ini tercatat dan tidak menghapus bukti secara langsung.</p><button className="focus-ring mt-5 min-h-12 rounded-xl border border-brand-error px-5 font-semibold text-brand-error">Batalkan tanda verifikasi</button></form> : request.academic_match_source === "manual" && request.pddikti_match_status !== "matched" ? <form action={submitManualAcademicReview} className="mt-8 rounded-[22px] border border-brand-border bg-white p-6"><input type="hidden" name="requestId" value={parsedId.data} /><h2 className="font-heading text-xl font-semibold">Keputusan data akademik</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Tangkapan layar hanya menjadi bukti pendukung kecocokan data akademik, bukan bukti kepemilikan akun.</p><div className="mt-5 flex flex-wrap gap-3"><button name="decision" value="approve" className="focus-ring min-h-12 rounded-xl bg-brand-blue px-5 font-semibold text-white">Setujui data akademik</button><button name="decision" value="needs_action" className="focus-ring min-h-12 rounded-xl border border-brand-border px-5 font-semibold">Minta bukti tambahan</button><button name="decision" value="reject" className="focus-ring min-h-12 rounded-xl border border-brand-error px-5 font-semibold text-brand-error">Tolak data akademik</button></div></form> : <form action={submitVerificationReview} className="mt-8 grid gap-5 rounded-[22px] border border-brand-border bg-white p-6 sm:grid-cols-2"><input type="hidden" name="requestId" value={parsedId.data} /><input type="hidden" name="academicResult" value={request.pddikti_match_status} /><label className="text-sm font-semibold">Bukti kepemilikan<select name="ownershipResult" defaultValue={request.ownership_status} className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-3"><option value="not_checked">Belum diperiksa</option>{request.method === "campus_email" ? <option value="campus_email_verified">Email kampus terverifikasi</option> : <option value="document_verified">Dokumen terverifikasi</option>}<option value="failed">Gagal</option></select></label><label className="text-sm font-semibold">Keputusan<select name="requestStatus" defaultValue={request.status} className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-3"><option value="under_review">Sedang diperiksa</option><option value="needs_action">Perlu tindakan</option><option value="verified">Verifikasi</option><option value="rejected">Tolak</option><option value="expired">Kedaluwarsa</option></select></label><label className="text-sm font-semibold">Alasan (bila diperlukan)<select name="rejectionReasonCode" className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-3"><option value="">Tanpa alasan</option><option value="ownership_failed">Kepemilikan gagal</option><option value="evidence_unreadable">Bukti tidak terbaca</option><option value="additional_information_required">Perlu informasi tambahan</option></select></label><div className="sm:col-span-2"><button className="focus-ring min-h-12 rounded-xl bg-brand-blue px-6 font-semibold text-white">Simpan pemeriksaan kepemilikan</button><p className="mt-3 text-sm leading-6 text-brand-muted">Status terverifikasi hanya dapat tersimpan bila data akademik cocok, kepemilikan sudah terbukti, dan petugas menyetujui hasil akhir.</p></div></form>}
  </div></main></StaffShell>;
}

export default function VerificationReviewPage(props: Props) {
  return <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-brand-muted">Menyiapkan detail pemeriksaan…</p></main>}><VerificationReviewContent {...props} /></Suspense>;
}
