import { StaffShell } from "@/components/staff/staff-shell";
import { requireOwner } from "@/lib/staff/authorization";
import { getVerificationReadiness } from "@/lib/verification/readiness";
import {
  BookOpen,
  CalendarDays,
  CreditCard,
  GraduationCap,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

async function OwnerContent() {
  const access = await requireOwner();
  const readiness = await getVerificationReadiness();
  return (
    <StaffShell role={access.role} current="overview" access={access}>
      <main className="min-h-svh bg-brand-surface">
      <div className="page-shell py-10 sm:py-14">
        <p className="section-label">Ruang operasional Owner</p>
        <h1 className="mt-4 max-w-3xl font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Kelola StudyDate dari satu tempat</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-brand-muted">Pilih pekerjaan yang perlu ditangani. Akses data mahasiswa tetap dibatasi dan setiap operasi penting dapat ditelusuri.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <Link href="/staff/users" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><Users className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Akun mahasiswa</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Bantu kendala akun, onboarding, profil belajar, membership, dan visibilitas.</p></Link>
          <Link href="/owner/memberships" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><CreditCard className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Paket & pembayaran</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Atur penawaran Plus serta kelola paket mahasiswa melalui email.</p></Link>
          <Link href="/owner/events" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><CalendarDays className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Campus Events</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Kelola izin organizer dan status resmi Event melalui alias atau slug publik.</p></Link>
          <Link href="/owner/staff" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><UserCog className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Tim operasional</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Tambahkan Admin dan pilih tugas yang boleh mereka tangani.</p></Link>
          <Link href="/owner/early-access" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><ScrollText className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Akses Awal</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Review pendaftar, approve/reject, dan kirim undangan Akses Awal.</p></Link>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Link href="/admin/verifications" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><ShieldCheck className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Verifikasi mahasiswa</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Tinjau data akademik dan bukti kepemilikan secara terpisah.</p></Link>
          <section id="system-readiness" className="scroll-mt-8 rounded-[22px] border border-brand-border bg-white p-6"><Wrench className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Kesiapan verifikasi</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Kartu mahasiswa: <strong className="text-brand-navy">{readiness.manualCardReady ? "Siap" : "Belum siap"}</strong><br />Email kampus: <strong className="text-brand-navy">{readiness.manualEmailReady ? "Siap" : "Belum siap"}</strong><br />Pencarian provider: <strong className="text-brand-navy">{readiness.providerReady ? "Siap" : "Tetap nonaktif"}</strong></p></section>
          <Link href="/owner/moderation" className="focus-ring scroll-mt-8 rounded-[22px] border border-brand-border bg-white p-6" id="moderation"><h2 className="font-heading text-xl font-semibold">Laporan & moderasi</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Tinjau laporan mahasiswa dan catat hasil penanganannya.</p></Link>
          <Link href="/owner/campuses" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><GraduationCap className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Kampus</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Kurasi kampus yang tersedia saat onboarding.</p></Link>
          <Link href="/owner/study-programs" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><BookOpen className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Program studi</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Kurasi program studi yang tersedia saat onboarding.</p></Link>
          <Link href="/owner/audit" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><h2 className="font-heading text-xl font-semibold">Riwayat akses</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Lihat perubahan tim dan akses operasional tanpa membuka data privat.</p></Link>
        </div>
      </div>
      </main>
    </StaffShell>
  );
}

export default function OwnerPage() {
  return <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-brand-muted">Menyiapkan owner workspace…</p></main>}><OwnerContent /></Suspense>;
}
