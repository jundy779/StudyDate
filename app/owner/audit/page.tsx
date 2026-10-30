import { StaffShell } from "@/components/staff/staff-shell";
import { EmptyState, Panel, StaffPage } from "@/components/staff/ui";
import { requireOwner } from "@/lib/staff/authorization";
import {
  listStaffOpsAuditEvents,
  listStaffRoleEvents,
} from "@/lib/staff/service";
import { Suspense } from "react";

const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });
const eventLabels: Record<string, string> = {
  owner_bootstrapped: "Owner pertama diaktifkan",
  admin_granted: "Admin ditambahkan",
  admin_deactivated: "Admin dinonaktifkan",
  admin_reactivated: "Admin diaktifkan kembali",
  reviewer_granted: "Akses pemeriksaan verifikasi diberikan",
  reviewer_removed: "Akses pemeriksaan verifikasi dicabut",
  early_access_granted: "Akses daftar Akses Awal diberikan",
  early_access_removed: "Akses daftar Akses Awal dicabut",
  users_read_granted: "Akses ringkasan akun diberikan",
  users_read_removed: "Akses ringkasan akun dicabut",
  users_support_granted: "Akses pencarian email diberikan",
  users_support_removed: "Akses pencarian email dicabut",
  early_access_viewed: "Pencarian Akses Awal dilakukan",
  early_access_approved: "Pendaftaran Akses Awal disetujui",
  early_access_rejected: "Pendaftaran Akses Awal tidak disetujui",
  early_access_invitation_sent: "Undangan Akses Awal dikirim",
  early_access_review_capability_granted: "Akses pemeriksaan Akses Awal diberikan",
  early_access_review_capability_removed: "Akses pemeriksaan Akses Awal dicabut",
  user_support_viewed: "Pencarian akun dengan email dilakukan",
  student_account_viewed: "Ringkasan akun mahasiswa dibuka",
  staff_capability_changed: "Akses tugas Admin diubah",
  staff_assigned_by_email: "Admin ditambahkan melalui email",
  event_blast_enabled: "Pengumuman acara dinyalakan",
  event_blast_disabled: "Pengumuman acara dimatikan",
  event_email_enabled: "Email pengumuman acara dinyalakan",
  event_email_disabled: "Email pengumuman acara dimatikan",
};

async function AuditContent() {
  const access = await requireOwner();
  const [roleEvents, opsEvents] = await Promise.all([
    listStaffRoleEvents(),
    listStaffOpsAuditEvents(),
  ]);
  const events = [
    ...roleEvents.map((event) => ({
      actorSuffix: event.actor_suffix,
      eventType: event.event_type,
      subjectSuffix: event.target_suffix,
      createdAt: event.created_at,
    })),
    ...opsEvents.map((event) => ({
      actorSuffix: event.actor_suffix,
      eventType: event.event_type,
      subjectSuffix: event.subject_suffix,
      createdAt: event.created_at,
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);

  return (
    <StaffShell role={access.role} current="audit" access={access}>
      <StaffPage
        kicker="Khusus Owner"
        title="Riwayat akses"
        description="Perubahan tim dan pembukaan data dukungan dicatat tanpa email lengkap, isi profil privat, atau nomor internal akun."
        mascot="penasaran"
      >
        <Panel title="100 tindakan terakhir" description="Paling baru di atas." quiet>
          {events.length ? (
            <ol className="relative grid gap-0 border-l-2 border-dashed border-brand-navy/15 pl-5">
              {events.map((event, index) => (
                <li key={`${event.createdAt}-${event.eventType}-${index}`} className="relative py-3">
                  <span
                    className="absolute -left-[27px] top-[18px] h-3 w-3 rounded-full border-2 border-brand-navy bg-brand-blue"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <p className="font-semibold text-brand-navy">
                      {eventLabels[event.eventType] ?? "Aktivitas lain"}
                    </p>
                    <time className="shrink-0 text-sm text-brand-muted">{date.format(new Date(event.createdAt))}</time>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-brand-muted">
                    Petugas ...{event.actorSuffix ?? "dihapus"}
                    {event.subjectSuffix ? ` · referensi ...${event.subjectSuffix}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="Belum ada tindakan tim yang tercatat" expression="ngantuk" />
          )}
        </Panel>
      </StaffPage>
    </StaffShell>
  );
}

export default function AuditPage() {
  return <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-brand-muted">Menyiapkan riwayat...</p></main>}><AuditContent /></Suspense>;
}
