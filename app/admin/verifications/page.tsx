import { StaffShell } from "@/components/staff/staff-shell";
import { requireVerificationReviewer } from "@/lib/staff/authorization";
import { listVerificationQueue } from "@/lib/staff/service";
import Link from "next/link";
import { Suspense } from "react";

const statuses = ["pending", "under_review", "needs_action", "verified", "rejected"] as const;
const statusLabels: Record<string, string> = { pending: "Menunggu", under_review: "Sedang diperiksa", needs_action: "Perlu tindakan", verified: "Disetujui", rejected: "Ditolak" };
const academicStatusLabels: Record<string, string> = {
  not_checked: "Belum diperiksa",
  matched: "Cocok",
  not_found: "Tidak ditemukan",
  mismatch: "Tidak cocok",
  unavailable: "Belum tersedia",
};
const ownershipStatusLabels: Record<string, string> = {
  not_checked: "Belum diperiksa",
  campus_email_verified: "Email kampus terverifikasi",
  document_verified: "Dokumen terverifikasi",
  failed: "Gagal",
};
const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });
type Props = { searchParams: Promise<{ status?: string }> };

async function VerificationAdminContent({ searchParams }: Props) {
  const access = await requireVerificationReviewer();
  const query = await searchParams;
  const selected = statuses.includes(query.status as (typeof statuses)[number]) ? query.status : undefined;
  const requests = await listVerificationQueue(selected);
  return <StaffShell role={access.role} current="verification" access={access}><main className="min-h-svh bg-brand-surface"><div className="page-shell py-10 sm:py-14">
    <p className="section-label">Pengelolaan verifikasi</p><h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em]">Pengajuan verifikasi mahasiswa</h1>
    <p className="mt-4 max-w-3xl leading-7 text-brand-muted">Daftar ini memakai nomor pengajuan tanpa menampilkan data pribadi. Data akademik baru dibuka saat petugas memeriksa satu pengajuan.</p>
    <nav aria-label="Filter status" className="mt-7 flex gap-2 overflow-x-auto pb-2"><Link href="/admin/verifications" className="focus-ring shrink-0 rounded-full border border-brand-border bg-white px-4 py-2 text-sm font-semibold">Semua</Link>{statuses.map((status) => <Link key={status} href={`/admin/verifications?status=${status}`} className="focus-ring shrink-0 rounded-full border border-brand-border bg-white px-4 py-2 text-sm font-semibold">{statusLabels[status]}</Link>)}</nav>
    <section className="mt-6 overflow-hidden rounded-[22px] border border-brand-border bg-white" aria-label="Daftar pengajuan verifikasi"><div className="divide-y divide-brand-border">{requests.length ? requests.map((request) => <article key={request.request_id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="font-semibold">Pengajuan …{request.request_id.slice(-8)}</p><p className="mt-1 text-sm text-brand-muted">{statusLabels[request.status] ?? request.status} · {request.method === "campus_email" ? "Email kampus" : request.method === "student_card" ? "Kartu mahasiswa" : "Kepemilikan belum dipilih"} · {date.format(new Date(request.submitted_at))}</p><p className="mt-2 text-xs font-semibold uppercase tracking-wide text-brand-blue">{request.academic_match_source === "provider" ? "Data cocok otomatis" : "Pemeriksaan manual"}</p><p className="mt-1 text-xs text-brand-muted">Data akademik: {academicStatusLabels[request.pddikti_match_status] ?? "Status tidak dikenal"} · Kepemilikan akun:{" "} 
      {ownershipStatusLabels[request.ownership_status] ?? "Status tidak dikenal"}</p></div>{request.method === "academic_pending" ? <span className="text-sm font-semibold text-brand-muted">Menunggu bukti kepemilikan</span> : ["pending", "under_review", "needs_action"].includes(request.status) ? <Link href={`/admin/verifications/${request.request_id}`} className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white">Periksa</Link> : <span className="text-sm font-semibold text-brand-muted">Riwayat</span>}</article>) : <p className="p-7 text-brand-muted">Tidak ada pengajuan pada pilihan ini.</p>}</div></section>
  </div></main></StaffShell>;
}

export default function VerificationAdminPage(props: Props) {
  return <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-brand-muted">Menyiapkan antrean verifikasi…</p></main>}><VerificationAdminContent {...props} /></Suspense>;
}
