import {
  assignStaffMemberByEmail,
  updateStaffMember,
} from "@/app/owner/staff/actions";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { StaffShell } from "@/components/staff/staff-shell";
import {
  EmptyState,
  HelpTip,
  Notice,
  Panel,
  StaffPage,
  StatusChip,
  staffButton,
  staffField,
  staffLabel,
} from "@/components/staff/ui";
import { requireOwner } from "@/lib/staff/authorization";
import { listStaffMembers } from "@/lib/staff/service";
import { Suspense } from "react";

type Props = { searchParams: Promise<{ state?: string }> };
const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

const stateMessage: Record<string, string> = {
  saved: "Perubahan tim tersimpan. Admin perlu masuk ulang agar akses baru aktif.",
  error: "Perubahan tim belum dapat disimpan.",
  invalid: "Data yang dimasukkan belum sesuai. Periksa kembali email dan pilihan tugas.",
  not_found:
    "Belum ada akun StudyDate dengan email ini. Minta orang tersebut masuk memakai email itu terlebih dahulu. Setelah akun dibuat, Owner dapat menambahkannya sebagai Admin.",
  ambiguous: "Lebih dari satu akun ditemukan. Minta bantuan tim teknis sebelum melanjutkan.",
};

function CapabilityForm({
  userId,
  action,
  label,
  tone = "quiet",
}: {
  userId: string;
  action: string;
  label: string;
  tone?: keyof typeof staffButton;
}) {
  return (
    <form action={updateStaffMember}>
      <input type="hidden" name="targetUserId" value={userId} />
      <input type="hidden" name="action" value={action} />
      <button className={staffButton[tone]}>{label}</button>
    </form>
  );
}

type Member = Awaited<ReturnType<typeof listStaffMembers>>[number];

/** Satu baris per tugas: nama tugas, penjelasan awam, status, dan tombol ubah. */
function permissionRows(member: Member) {
  return [
    {
      title: "Lihat Akses Awal",
      help: "Melihat daftar pendaftar Akses Awal, tanpa bisa memutuskan.",
      on: member.can_early_access_read || member.can_early_access_review,
      grant: "grant_early_access",
      remove: "remove_early_access",
      lockedOn: member.can_early_access_review,
    },
    {
      title: "Periksa dan undang Akses Awal",
      help: "Menyetujui, menolak, minta perbaikan, dan mengirim undangan.",
      on: member.can_early_access_review,
      grant: "grant_early_access_review",
      remove: "remove_early_access_review",
      lockedOn: false,
    },
    {
      title: "Lihat ringkasan akun",
      help: "Membuka status akun mahasiswa untuk membantu kendala.",
      on: member.can_users_read || member.can_users_support,
      grant: "grant_users_read",
      remove: "remove_users_read",
      lockedOn: member.can_users_support,
    },
    {
      title: "Cari akun dengan email",
      help: "Mencari akun memakai email lengkap untuk dukungan.",
      on: member.can_users_support,
      grant: "grant_users_support",
      remove: "remove_users_support",
      lockedOn: false,
    },
    {
      title: "Tinjau verifikasi",
      help: "Memeriksa data kampus dan bukti kepemilikan akun mahasiswa.",
      on: member.verification_reviewer,
      grant: "grant_reviewer",
      remove: "remove_reviewer",
      lockedOn: false,
    },
  ];
}

async function StaffContent({ searchParams }: Props) {
  const access = await requireOwner();
  const [members, query] = await Promise.all([listStaffMembers(), searchParams]);
  const message = query.state ? stateMessage[query.state] : null;
  const isError =
    query.state === "error" ||
    query.state === "invalid" ||
    query.state === "not_found" ||
    query.state === "ambiguous";

  return (
    <StaffShell role={access.role} current="staff" access={access}>
      <StaffPage
        kicker="Khusus Owner"
        title="Tim dan hak akses"
        description="Tambahkan Admin dengan email akun StudyDate yang sudah ada, lalu pilih tugas yang boleh ditangani. Tugas lain tidak akan diberikan."
        mascot="kedip"
      >
        {message ? <Notice tone={isError ? "danger" : "success"}>{message}</Notice> : null}

        <Panel
          title="Tambah Admin"
          description="Orangnya harus sudah pernah masuk ke StudyDate memakai email ini."
        >
          <form action={assignStaffMemberByEmail} className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label className={staffLabel}>
              Email akun StudyDate
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                className={staffField}
                placeholder="admin@contoh.com"
                autoComplete="off"
              />
            </label>
            <label className={staffLabel}>
              Tugas pertama
              <select name="action" defaultValue="grant_admin" className={staffField}>
                <option value="grant_admin">Tambah Admin dulu, tugas diatur nanti</option>
                <option value="grant_early_access">Lihat Akses Awal</option>
                <option value="grant_early_access_review">Periksa dan undang Akses Awal</option>
                <option value="grant_users_read">Lihat ringkasan akun</option>
                <option value="grant_users_support">Cari akun dengan email</option>
                <option value="grant_reviewer">Tinjau verifikasi</option>
              </select>
            </label>
            <button className={staffButton.primary}>Simpan Admin</button>
          </form>
          <div className="mt-4">
            <HelpTip label="Kapan akses baru aktif?">
              Setelah disimpan, Admin perlu keluar lalu masuk lagi supaya menu barunya muncul.
            </HelpTip>
          </div>
        </Panel>

        <Panel title="Anggota tim" description={`${members.length} orang.`} quiet>
          {members.length === 0 ? (
            <EmptyState title="Belum ada anggota tim" expression="penasaran">
              Tambahkan Admin pertama lewat formulir di atas.
            </EmptyState>
          ) : (
            <ul className="grid gap-4">
              {members.map((member) => (
                <li key={member.user_id} className="rounded-2xl border border-brand-border p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-heading text-lg font-semibold text-brand-navy">
                          {member.role === "owner" ? "Owner" : "Admin"}
                        </p>
                        <StatusChip tone={member.status === "active" ? "go" : "muted"}>
                          {member.status === "active" ? "Aktif" : "Nonaktif"}
                        </StatusChip>
                      </div>
                      <p className="mt-1 font-mono text-xs text-brand-muted">
                        Nomor akun ...{member.user_id.slice(-8)} · ditambahkan {date.format(new Date(member.created_at))}
                      </p>
                    </div>
                    {member.role === "admin" ? (
                      member.status === "active" ? (
                        <form action={updateStaffMember}>
                          <input type="hidden" name="targetUserId" value={member.user_id} />
                          <ConfirmSubmitButton
                            name="action"
                            value="deactivate_admin"
                            triggerLabel="Nonaktifkan"
                            title="Nonaktifkan Admin ini?"
                            description="Admin tidak bisa membuka Ruang Operasional sampai diaktifkan lagi. Riwayat tindakannya tetap tersimpan."
                            confirmLabel="Ya, nonaktifkan"
                            className={staffButton.dangerQuiet}
                          />
                        </form>
                      ) : (
                        <CapabilityForm
                          userId={member.user_id}
                          action="reactivate_admin"
                          label="Aktifkan kembali"
                          tone="primary"
                        />
                      )
                    ) : null}
                  </div>

                  {member.role === "owner" ? (
                    <p className="mt-3 text-sm text-brand-muted">Owner bisa membuka semua menu.</p>
                  ) : (
                    <ul className="mt-4 divide-y divide-brand-border rounded-xl border border-brand-border">
                      {permissionRows(member).map((row) => (
                        <li
                          key={row.title}
                          className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-brand-navy">{row.title}</span>
                              <StatusChip tone={row.on ? "go" : "muted"}>{row.on ? "Aktif" : "Nonaktif"}</StatusChip>
                            </div>
                            <p className="text-sm text-brand-muted">{row.help}</p>
                          </div>
                          {member.status !== "active" ? null : row.lockedOn ? (
                            <span className="text-xs text-brand-muted">Ikut aktif karena tugas di bawahnya</span>
                          ) : (
                            <CapabilityForm
                              userId={member.user_id}
                              action={row.on ? row.remove : row.grant}
                              label={row.on ? "Cabut" : "Aktifkan"}
                              tone={row.on ? "dangerQuiet" : "secondary"}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </StaffPage>
    </StaffShell>
  );
}

export default function OwnerStaffPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            Menyiapkan tim...
          </p>
        </main>
      }
    >
      <StaffContent {...props} />
    </Suspense>
  );
}
