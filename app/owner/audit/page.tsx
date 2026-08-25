import { StaffShell } from "@/components/staff/staff-shell";
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
  reviewer_granted: "Akses tinjau verifikasi diberikan",
  reviewer_removed: "Akses tinjau verifikasi dicabut",
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
  early_access_review_capability_granted: "Akses review Akses Awal diberikan",
  early_access_review_capability_removed: "Akses review Akses Awal dicabut",
  user_support_viewed: "Pencarian akun dengan email dilakukan",
  student_account_viewed: "Ringkasan akun mahasiswa dibuka",
  staff_capability_changed: "Akses tugas Admin diubah",
  staff_assigned_by_email: "Admin ditambahkan melalui email",
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
      <main className="min-h-svh bg-brand-surface">
        <div className="page-shell py-10 sm:py-14">
          <p className="section-label">Khusus Owner</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold">Riwayat akses operasional</h1>
          <p className="mt-4 max-w-3xl leading-7 text-brand-muted">
            Perubahan tim dan pembukaan data dukungan dicatat tanpa email lengkap,
            isi profil privat, atau identifier akun mentah.
          </p>
          <div className="mt-8 overflow-hidden rounded-[22px] border border-brand-border bg-white">
            <div className="divide-y divide-brand-border">
              {events.length ? (
                events.map((event, index) => (
                  <article
                    key={`${event.createdAt}-${event.eventType}-${index}`}
                    className="grid gap-2 p-5 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="font-semibold">
                        {eventLabels[event.eventType] ?? event.eventType.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 font-mono text-xs text-brand-muted">
                        Petugas …{event.actorSuffix ?? "dihapus"}
                        {event.subjectSuffix
                          ? ` · referensi …${event.subjectSuffix}`
                          : ""}
                      </p>
                    </div>
                    <time className="text-sm text-brand-muted">
                      {date.format(new Date(event.createdAt))}
                    </time>
                  </article>
                ))
              ) : (
                <p className="p-6 text-brand-muted">Belum ada aktivitas operasional.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </StaffShell>
  );
}

export default function AuditPage() {
  return <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-brand-muted">Menyiapkan audit…</p></main>}><AuditContent /></Suspense>;
}
