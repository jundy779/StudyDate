import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { StaffShell } from "@/components/staff/staff-shell";
import { setVerificationRequirementAction } from "@/app/owner/actions";
import { ownerGetVerificationRequirement } from "@/lib/staff/platform-settings";
import { requireOwner } from "@/lib/staff/authorization";
import { getVerificationReadiness } from "@/lib/verification/readiness";
import {
  CalendarDays,
  Gavel,
  GraduationCap,
  Inbox,
  MailWarning,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
} from "lucide-react";
import {
  HelpTip,
  Notice,
  Panel,
  StaffPage,
  StatusChip,
  TodoItem,
  staffButton,
} from "@/components/staff/ui";
import { countUnresolvedModerationReports } from "@/lib/moderation/service";
import { getEarlyAccessQueueSummary, listVerificationQueue } from "@/lib/staff/service";
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
  const [earlyAccess, openReports, verificationRows] = await Promise.all([
    getEarlyAccessQueueSummary().catch(() => null),
    countUnresolvedModerationReports().catch(() => null),
    listVerificationQueue().catch(() => null),
  ]);
  const openVerifications = verificationRows
    ? verificationRows.filter((row) => ["pending", "under_review", "needs_action"].includes(row.status)).length
    : null;
  const totalTodo =
    (earlyAccess?.waiting_count ?? 0) + (openReports ?? 0) + (openVerifications ?? 0) +
    (earlyAccess?.unsent_invitation_count ?? 0);

  return (
    <StaffShell role={access.role} current="overview" access={access}>
      <StaffPage
        kicker="Halo, Owner"
        title={totalTodo > 0 ? "Ini yang perlu ditangani" : "Semua beres untuk sekarang"}
        description="Mulai dari daftar di bawah. Angka diambil langsung dari sistem, dan setiap keputusan tercatat di Riwayat akses."
        mascot={totalTodo > 0 ? "mikir" : "girang"}
      >
        <Panel title="Daftar tugas" description="Yang merah sebaiknya ditangani hari ini.">
          <ul className="grid gap-3 lg:grid-cols-2">
            <TodoItem
              href="/owner/early-access?status=waiting&sort=oldest"
              icon={Inbox}
              title="Pendaftar Akses Awal menunggu"
              description={
                earlyAccess && earlyAccess.stale_waiting_count > 0
                  ? `${earlyAccess.stale_waiting_count} di antaranya sudah lebih dari 7 hari.`
                  : "Periksa lalu setujui, minta perbaikan, atau tolak."
              }
              count={earlyAccess?.waiting_count ?? null}
              urgent={(earlyAccess?.stale_waiting_count ?? 0) > 0}
            />
            <TodoItem
              href="/owner/moderation"
              icon={Gavel}
              title="Laporan pengguna belum selesai"
              description="Laporan pelecehan, spam, atau tempat tidak aman dari mahasiswa."
              count={openReports}
              urgent
            />
            <TodoItem
              href="/admin/verifications"
              icon={ShieldCheck}
              title="Verifikasi mahasiswa menunggu"
              description="Cocokkan data kampus dan bukti kepemilikan akun."
              count={openVerifications}
            />
            <TodoItem
              href="/owner/early-access?queue=unsent_invitation"
              icon={MailWarning}
              title="Undangan belum terkirim"
              description="Sudah disetujui, tetapi emailnya gagal. Kirim ulang dari Akses Awal."
              count={earlyAccess?.unsent_invitation_count ?? null}
              urgent={(earlyAccess?.unsent_invitation_count ?? 0) > 0}
            />
          </ul>
        </Panel>

        <Panel title="Menu lain" description="Pengaturan yang jarang berubah." quiet>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { href: "/staff/users", icon: Users, title: "Akun mahasiswa", text: "Bantu masalah login, profil, paket, dan apakah profil mereka bisa ditemukan." },
              { href: "/owner/events", icon: CalendarDays, title: "Acara Kampus", text: "Beri izin penyelenggara dan tandai acara resmi." },
              { href: "/owner/memberships", icon: Sparkles, title: "StudyDate Plus", text: "Atur penawaran dan paket mahasiswa." },
              { href: "/owner/contact", icon: MessageCircle, title: "Kontak dan media sosial", text: "Tautan resmi yang tampil di bagian bawah situs." },
              { href: "/owner/staff", icon: UserCog, title: "Tim dan hak akses", text: "Tambah Admin dan pilih tugasnya." },
              { href: "/owner/campuses", icon: GraduationCap, title: "Daftar kampus dan jurusan", text: "Pilihan yang muncul saat mahasiswa mendaftar." },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="focus-ring group flex h-full items-start gap-3 rounded-2xl border border-brand-border bg-white p-4 transition-colors hover:border-brand-navy"
                >
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" />
                  <span>
                    <span className="block font-semibold text-brand-navy group-hover:text-brand-blue">{item.title}</span>
                    <span className="mt-0.5 block text-sm leading-5 text-brand-muted">{item.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel
            id="system-readiness"
            title="Kesiapan verifikasi mahasiswa"
            description="Jalur yang bisa dipakai mahasiswa untuk membuktikan dirinya."
            quiet
          >
            <ul className="grid gap-3 text-sm">
              {[
                ["Kartu mahasiswa", readiness.manualCardReady, "Mahasiswa unggah foto kartu, petugas memeriksa."],
                ["Email kampus", readiness.manualEmailReady, "Mahasiswa menerima kode di email kampus."],
                ["Pemeriksaan otomatis PDDikti", readiness.providerReady, "Dicocokkan otomatis ke data PDDikti."],
              ].map(([label, ready, help]) => (
                <li key={label as string} className="flex items-start justify-between gap-3 rounded-xl bg-brand-surface px-4 py-3">
                  <span>
                    <span className="block font-semibold text-brand-navy">{label as string}</span>
                    <span className="block text-brand-muted">{help as string}</span>
                  </span>
                  <StatusChip tone={ready ? "go" : "muted"}>{ready ? "Siap" : "Belum siap"}</StatusChip>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            id="verification-requirement"
            title="Wajib verifikasi PDDikti"
            description="Kalau dinyalakan, mahasiswa yang belum terverifikasi tidak bisa memakai Cari Teman, Perkenalan, Pesan, Circle, dan Acara."
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-brand-navy">Sekarang:</span>
              {requirement.required === null ? (
                <StatusChip tone="muted">Belum tersedia</StatusChip>
              ) : requirement.required ? (
                <StatusChip tone="stop">Wajib</StatusChip>
              ) : (
                <StatusChip tone="go">Tidak diwajibkan</StatusChip>
              )}
            </div>
            {requirementState ? (
              <div className="mt-4">
                <Notice tone={query.verifikasi === "failed" ? "danger" : "success"}>{requirementState}</Notice>
              </div>
            ) : null}
            <div className="mt-4">
              {requirement.required === null ? (
                <p className="text-sm leading-6 text-brand-muted">Pengaturan ini belum terpasang di database.</p>
              ) : requirement.required ? (
                <form action={setVerificationRequirementAction}>
                  <ConfirmSubmitButton
                    name="required"
                    value="off"
                    triggerLabel="Matikan kewajiban verifikasi"
                    title="Matikan kewajiban verifikasi?"
                    description="Mahasiswa yang belum terverifikasi bisa kembali memakai fitur utama."
                    confirmLabel="Matikan"
                    className={staffButton.secondary}
                  />
                </form>
              ) : canRequire ? (
                <form action={setVerificationRequirementAction}>
                  <ConfirmSubmitButton
                    name="required"
                    value="on"
                    triggerLabel="Wajibkan verifikasi"
                    title="Wajibkan verifikasi untuk semua mahasiswa?"
                    description="Semua mahasiswa yang belum terverifikasi langsung kehilangan akses ke fitur utama sampai verifikasinya selesai."
                    confirmLabel="Wajibkan sekarang"
                    className={staffButton.primary}
                  />
                </form>
              ) : (
                <p className="text-sm leading-6 text-brand-muted">
                  Tombolnya muncul setelah jalur kartu mahasiswa siap, supaya tidak ada mahasiswa yang
                  terkunci tanpa bisa menyelesaikan verifikasi.
                </p>
              )}
            </div>
            <div className="mt-4">
              <HelpTip>
                Akun email sekolah (.sch.id) selalu hanya bisa ikut acara edukatif, apa pun pengaturan ini.
                Akun email kampus (.ac.id) dan email pribadi ikut aturan ini.
              </HelpTip>
            </div>
          </Panel>
        </div>
      </StaffPage>
    </StaffShell>
  );
}

export default function OwnerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-brand-muted">Menyiapkan ringkasan...</p></main>}><OwnerContent searchParams={searchParams} /></Suspense>;
}
