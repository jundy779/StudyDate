import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { StaffShell } from "@/components/staff/staff-shell";
import { setVerificationRequirementAction } from "@/app/owner/actions";
import { ownerGetVerificationRequirement } from "@/lib/staff/platform-settings";
import { requireOwner } from "@/lib/staff/authorization";
import { getVerificationReadiness } from "@/lib/verification/readiness";
import {
  BookOpen,
  CalendarDays,
  CreditCard,
  GraduationCap,
  MessageCircle,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const requirementMessages: Record<string, string> = {
  on: "Verifikasi PDDikti sekarang wajib untuk semua mahasiswa.",
  off: "Verifikasi tidak lagi diwajibkan.",
  not_ready: "Belum bisa diwajibkan: verifikasi mahasiswa belum dibuka atau jalur kartu mahasiswa belum siap.",
  failed: "Pengaturan belum tersimpan. Pastikan migration akses mahasiswa sudah terpasang, lalu coba lagi.",
  invalid: "Pilihan tidak dikenali.",
};

async function OwnerContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireOwner();
  const [readiness, requirement, query] = await Promise.all([
    getVerificationReadiness(),
    ownerGetVerificationRequirement(),
    searchParams,
  ]);
  const requirementState =
    typeof query.verifikasi === "string" ? requirementMessages[query.verifikasi] : undefined;
  const canRequire = readiness.enabled && readiness.manualCardReady;
  return (
    <StaffShell role={access.role} current="overview" access={access}>
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
      <div className="page-shell py-10 sm:py-14">
        <p className="section-label">Area Owner</p>
        <h1 className="mt-4 max-w-3xl font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Kelola StudyDate dari satu tempat</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-brand-muted">Pilih pekerjaan yang perlu ditangani. Akses data mahasiswa tetap dibatasi dan setiap perubahan penting tetap tercatat.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Link href="/staff/users" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><Users className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Akun mahasiswa</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Bantu kendala akun, pengaturan awal, profil, paket, dan apakah profil mereka bisa ditemukan.</p></Link>
          <Link href="/owner/memberships" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><CreditCard className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Paket & pembayaran</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Atur penawaran Plus serta kelola paket mahasiswa melalui email.</p></Link>
          <Link href="/owner/events" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><CalendarDays className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Acara Kampus</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Atur izin penyelenggara, status acara, dan halaman yang dilihat pengguna.</p></Link>
          <Link href="/owner/staff" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><UserCog className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Tim operasional</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Tambahkan Admin dan pilih tugas yang boleh mereka tangani.</p></Link>
          <Link href="/owner/contact" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><MessageCircle className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Media sosial & kontak</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Isi WhatsApp, Telegram, Instagram, dan kanal resmi lain yang tampil di footer situs.</p></Link>
          <Link href="/owner/early-access" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><ScrollText className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Akses Awal</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Periksa pendaftar, terima atau tolak, lalu kirim undangan Akses Awal.</p></Link>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Link href="/admin/verifications" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><ShieldCheck className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Verifikasi mahasiswa</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Tinjau data akademik dan bukti kepemilikan secara terpisah.</p></Link>
          <section id="system-readiness" className="scroll-mt-8 rounded-[22px] border border-brand-border bg-white p-6"><Wrench className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Kesiapan verifikasi</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Kartu mahasiswa: <strong className="text-brand-navy">{readiness.manualCardReady ? "Siap" : "Belum siap"}</strong><br />Email kampus: <strong className="text-brand-navy">{readiness.manualEmailReady ? "Siap" : "Belum siap"}</strong><br />Pemeriksaan otomatis: <strong className="text-brand-navy">{readiness.providerReady ? "Siap" : "Tetap nonaktif"}</strong></p></section>
          <Link href="/owner/moderation" className="focus-ring scroll-mt-8 rounded-[22px] border border-brand-border bg-white p-6" id="moderation"><h2 className="font-heading text-xl font-semibold">Laporan & moderasi</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Tinjau laporan mahasiswa dan catat hasil penanganannya.</p></Link>
          <Link href="/owner/campuses" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><GraduationCap className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Kampus</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Atur daftar kampus yang tersedia saat pendaftaran.</p></Link>
          <Link href="/owner/study-programs" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><BookOpen className="h-6 w-6 text-brand-blue" aria-hidden="true" /><h2 className="mt-7 font-heading text-xl font-semibold">Program studi</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Atur daftar program studi yang tersedia saat pendaftaran.</p></Link>
          <Link href="/owner/audit" className="focus-ring rounded-[22px] border border-brand-border bg-white p-6"><h2 className="font-heading text-xl font-semibold">Riwayat akses</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Lihat perubahan tim dan akses operasional tanpa membuka data privat.</p></Link>
        </div>
        <section
          id="verification-requirement"
          className="mt-8 scroll-mt-8 rounded-[22px] border border-brand-border bg-white p-6"
          aria-labelledby="verification-requirement-title"
        >
          <ShieldCheck className="h-6 w-6 text-brand-blue" aria-hidden="true" />
          <h2 id="verification-requirement-title" className="mt-7 font-heading text-xl font-semibold">
            Wajib verifikasi PDDikti
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
            Kalau dinyalakan, mahasiswa yang belum terverifikasi tidak bisa memakai Cari Teman,
            Perkenalan, Pesan, Circle, dan Acara sampai verifikasinya selesai. Akun email sekolah
            (.sch.id) selalu hanya bisa mengikuti acara edukatif.
          </p>
          <p className="mt-4 text-sm font-semibold text-brand-navy">
            Status sekarang:{" "}
            {requirement.required === null
              ? "belum tersedia (migration belum terpasang)"
              : requirement.required
                ? "wajib"
                : "belum diwajibkan"}
          </p>
          {requirementState ? (
            <p role="status" className="mt-3 rounded-xl bg-brand-surface px-4 py-3 text-sm text-brand-navy">
              {requirementState}
            </p>
          ) : null}
          {requirement.required === null ? null : requirement.required ? (
            <form action={setVerificationRequirementAction} className="mt-5">
              <ConfirmSubmitButton
                name="required"
                value="off"
                triggerLabel="Matikan kewajiban verifikasi"
                title="Matikan kewajiban verifikasi?"
                description="Mahasiswa yang belum terverifikasi bisa kembali memakai fitur utama."
                confirmLabel="Matikan"
                className="focus-ring min-h-11 rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-navy"
              />
            </form>
          ) : canRequire ? (
            <form action={setVerificationRequirementAction} className="mt-5">
              <ConfirmSubmitButton
                name="required"
                value="on"
                triggerLabel="Wajibkan verifikasi"
                title="Wajibkan verifikasi untuk semua mahasiswa?"
                description="Semua mahasiswa yang belum terverifikasi langsung kehilangan akses ke fitur utama sampai verifikasinya selesai."
                confirmLabel="Wajibkan sekarang"
                className="focus-ring min-h-11 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white"
              />
            </form>
          ) : (
            <p className="mt-4 text-sm leading-6 text-brand-muted">
              Tombol akan muncul setelah verifikasi mahasiswa dibuka dan jalur kartu mahasiswa siap,
              supaya tidak ada mahasiswa yang terkunci tanpa bisa menyelesaikan verifikasi.
            </p>
          )}
        </section>
      </div>
      </main>
    </StaffShell>
  );
}

export default function OwnerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-brand-muted">Menyiapkan halaman Owner…</p></main>}><OwnerContent searchParams={searchParams} /></Suspense>;
}
