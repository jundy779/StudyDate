import { StaffShell } from "@/components/staff/staff-shell";
import { EmptyState, HelpTip, Panel, StaffPage, StatusChip, staffButton } from "@/components/staff/ui";
import { requireVerificationReviewer } from "@/lib/staff/authorization";
import { listVerificationQueue } from "@/lib/staff/service";
import Link from "next/link";
import { Suspense } from "react";

const statuses = ["pending", "under_review", "needs_action", "verified", "rejected"] as const;
const statusLabels: Record<string, string> = {
  pending: "Menunggu",
  under_review: "Sedang diperiksa",
  needs_action: "Perlu tindakan",
  verified: "Disetujui",
  rejected: "Ditolak",
};
const statusTone: Record<string, "go" | "wait" | "warn" | "stop" | "info" | "muted"> = {
  pending: "wait",
  under_review: "info",
  needs_action: "warn",
  verified: "go",
  rejected: "muted",
};
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
const methodLabels: Record<string, string> = {
  campus_email: "Email kampus",
  student_card: "Kartu mahasiswa",
};
const OPEN = ["pending", "under_review", "needs_action"];
const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });
type Props = { searchParams: Promise<{ status?: string }> };

async function VerificationAdminContent({ searchParams }: Props) {
  const access = await requireVerificationReviewer();
  const query = await searchParams;
  const selected = statuses.includes(query.status as (typeof statuses)[number]) ? query.status : undefined;
  const requests = await listVerificationQueue(selected);
  const filters = [{ key: undefined, label: "Semua" }, ...statuses.map((key) => ({ key, label: statusLabels[key] }))];

  return (
    <StaffShell role={access.role} current="verification" access={access}>
      <StaffPage
        kicker="Verifikasi mahasiswa"
        title="Pengajuan verifikasi"
        description="Daftar ini hanya memakai nomor pengajuan. Nama, NIM, dan bukti baru terlihat saat kamu membuka satu pengajuan."
        mascot={requests.some((item) => OPEN.includes(item.status)) ? "mikir" : "girang"}
      >
        <Panel
          title="Antrean"
          description={`${requests.length} pengajuan pada pilihan ini.`}
          quiet
        >
          <nav aria-label="Saring status pengajuan" className="mb-5 flex flex-wrap gap-2">
            {filters.map((item) => {
              const active = selected === item.key;
              return (
                <Link
                  key={item.label}
                  href={item.key ? `/admin/verifications?status=${item.key}` : "/admin/verifications"}
                  aria-current={active ? "page" : undefined}
                  className={`focus-ring inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold ${
                    active
                      ? "border-2 border-brand-navy bg-brand-navy text-white"
                      : "border border-brand-border bg-white text-brand-navy hover:border-brand-navy"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {requests.length ? (
            <ul className="divide-y divide-brand-border" aria-label="Daftar pengajuan verifikasi">
              {requests.map((request) => (
                <li key={request.request_id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-brand-navy">Pengajuan ...{request.request_id.slice(-8)}</h3>
                      <StatusChip tone={statusTone[request.status] ?? "muted"}>
                        {statusLabels[request.status] ?? request.status}
                      </StatusChip>
                    </div>
                    <p className="mt-1 text-sm text-brand-muted">
                      {methodLabels[request.method] ?? "Bukti kepemilikan belum dipilih"} · masuk{" "}
                      {date.format(new Date(request.submitted_at))}
                    </p>
                    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-muted">
                      <div>
                        <dt className="inline">Data kampus: </dt>
                        <dd className="inline font-semibold text-brand-navy">
                          {academicStatusLabels[request.pddikti_match_status] ?? "Status tidak dikenal"}
                          {request.academic_match_source === "provider" ? " (otomatis)" : " (dicek petugas)"}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline">Kepemilikan akun: </dt>
                        <dd className="inline font-semibold text-brand-navy">
                          {ownershipStatusLabels[request.ownership_status] ?? "Status tidak dikenal"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  {request.method === "academic_pending" ? (
                    <span className="text-sm font-semibold text-brand-muted">Menunggu mahasiswa mengirim bukti</span>
                  ) : OPEN.includes(request.status) ? (
                    <Link href={`/admin/verifications/${request.request_id}`} className={staffButton.primary}>
                      Periksa
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-brand-muted">Sudah selesai</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Tidak ada pengajuan di sini" expression="girang">
              Antrean kosong untuk pilihan ini. Coba pilih &ldquo;Semua&rdquo; untuk melihat riwayat.
            </EmptyState>
          )}

          <div className="mt-4">
            <HelpTip label="Bagaimana cara memeriksa?">
              Ada dua hal yang dicek. Pertama, data kampus (nama, NIM, kampus) cocok dengan PDDikti. Kedua,
              akun ini memang milik mahasiswa tersebut, lewat email kampus atau foto kartu mahasiswa. Tanda
              terverifikasi hanya bisa diberikan kalau keduanya lolos.
            </HelpTip>
          </div>
        </Panel>
      </StaffPage>
    </StaffShell>
  );
}

export default function VerificationAdminPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">Menyiapkan antrean verifikasi...</p>
        </main>
      }
    >
      <VerificationAdminContent {...props} />
    </Suspense>
  );
}
