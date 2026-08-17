import { StaffShell } from "@/components/staff/staff-shell";
import { requireOwner } from "@/lib/staff/authorization";
import { getVerificationReadiness } from "@/lib/verification/readiness";
import { ShieldCheck, Users, Wrench } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

async function OwnerContent() {
  const access = await requireOwner();
  const readiness = await getVerificationReadiness();
  return (
    <StaffShell role={access.role} current="overview" access={access}>
      <main className="min-h-svh bg-brand-surface">
      <div className="page-shell py-10 sm:py-14">
        <p className="section-label">Owner workspace</p>
        <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Kontrol yang terbatas dan dapat diaudit</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-brand-muted">Owner tetap bekerja melalui operasi terkontrol. Service-role credential, raw SQL, dan data mahasiswa privat tidak tersedia di browser.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <Link href="/owner/staff" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><Users className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Staff</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Kelola admin dengan email akun Auth dan capability terbatas.</p></Link>
          <Link href="/staff/early-access" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><Users className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Akses Awal</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Lihat waitlist operasional tanpa klaim paksa atau kampanye massal.</p></Link>
          <Link href="/staff/users" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><ShieldCheck className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Akun pengguna</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Proyeksi aman status akun, onboarding, dan ringkasan verifikasi.</p></Link>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Link href="/admin/verifications" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><ShieldCheck className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Verification</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Buka antrean review dengan two-condition approval.</p></Link>
          <section id="system-readiness" className="scroll-mt-8 rounded-[22px] border border-brand-border bg-white p-6"><Wrench className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">System readiness</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Manual kartu: <strong className="text-brand-navy">{readiness.manualCardReady ? "Siap" : "Belum siap"}</strong><br />Email kampus: <strong className="text-brand-navy">{readiness.manualEmailReady ? "Siap" : "Belum siap"}</strong><br />Provider: <strong className="text-brand-navy">{readiness.providerReady ? "Siap" : "Tetap nonaktif"}</strong></p></section>
          <Link href="/owner/moderation" className="focus-ring scroll-mt-8 rounded-[22px] border border-brand-border bg-white p-6" id="moderation"><h2 className="font-heading text-xl font-semibold">Moderation</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Antrean laporan Owner dengan status submitted → under_review → resolved/dismissed.</p></Link>
          <Link href="/owner/campuses" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><h2 className="font-heading text-xl font-semibold">Kampus</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Kurasi daftar kampus onboarding: usulan manual, tambah, edit, hapus.</p></Link>
          <Link href="/owner/study-programs" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><h2 className="font-heading text-xl font-semibold">Jurusan</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Kurasi daftar program studi: usulan manual, tambah, edit, hapus.</p></Link>
          <Link href="/owner/audit" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><h2 className="font-heading text-xl font-semibold">Sanitized audit</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Lihat perubahan role tanpa email lengkap atau payload privat.</p></Link>
        </div>
      </div>
      </main>
    </StaffShell>
  );
}

export default function OwnerPage() {
  return <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-brand-muted">Menyiapkan owner workspace…</p></main>}><OwnerContent /></Suspense>;
}
