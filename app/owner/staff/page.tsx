import {
  assignStaffMemberByEmail,
  updateStaffMember,
} from "@/app/owner/staff/actions";
import { StaffShell } from "@/components/staff/staff-shell";
import { requireOwner } from "@/lib/staff/authorization";
import { listStaffMembers } from "@/lib/staff/service";
import { Suspense } from "react";

type Props = { searchParams: Promise<{ state?: string }> };
const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

const stateMessage: Record<string, string> = {
  saved: "Perubahan tim tersimpan. Admin perlu masuk ulang agar akses baru aktif.",
  error: "Perubahan tim belum dapat disimpan.",
  invalid: "Input tidak valid.",
  not_found:
    "Belum ada akun StudyDate dengan email ini. Minta orang tersebut masuk memakai email itu terlebih dahulu. Setelah akun dibuat, Owner dapat menambahkannya sebagai Admin.",
  ambiguous: "Lebih dari satu akun cocok. Hubungi dukungan teknis secara privat.",
};

function CapabilityForm({
  userId,
  action,
  label,
}: {
  userId: string;
  action: string;
  label: string;
}) {
  return (
    <form action={updateStaffMember}>
      <input type="hidden" name="targetUserId" value={userId} />
      <input type="hidden" name="action" value={action} />
      <button className="focus-ring min-h-11 rounded-xl border border-brand-border px-4 text-sm font-semibold">
        {label}
      </button>
    </form>
  );
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
      <main className="min-h-svh bg-brand-surface">
        <div className="page-shell py-10 sm:py-14">
          <p className="section-label">Khusus Owner</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em]">
            Tim operasional
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-brand-muted">
            Tambahkan Admin dengan email akun StudyDate yang sudah ada, lalu
            pilih tugas yang boleh ditangani. Akses lain tetap nonaktif.
          </p>

          {message ? (
            <p
              role="status"
              className={`mt-6 rounded-xl px-4 py-3 text-sm font-semibold ${
                isError
                  ? "bg-red-50 text-brand-error"
                  : "bg-green-50 text-brand-success"
              }`}
            >
              {message}
            </p>
          ) : null}

          <form
            action={assignStaffMemberByEmail}
            className="mt-8 grid gap-4 rounded-[22px] border border-brand-border bg-white p-6 sm:grid-cols-[1fr_auto_auto] sm:items-end"
          >
            <label className="text-sm font-semibold">
              Email akun StudyDate
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 text-sm"
                placeholder="staff@contoh.com"
                autoComplete="off"
              />
            </label>
            <label className="text-sm font-semibold">
              Tindakan awal
              <select
                name="action"
                defaultValue="grant_admin"
                className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 text-sm"
              >
                <option value="grant_admin">Tambah Admin tanpa akses tugas</option>
                <option value="grant_early_access">Boleh melihat Akses Awal</option>
                <option value="grant_early_access_review">Boleh review & kirim undangan Akses Awal</option>
                <option value="grant_users_read">Boleh melihat ringkasan akun</option>
                <option value="grant_users_support">Boleh mencari akun dengan email</option>
                <option value="grant_reviewer">Boleh meninjau verifikasi</option>
              </select>
            </label>
            <button className="focus-ring min-h-11 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white">
              Simpan Admin
            </button>
          </form>

          <section
            className="mt-8 overflow-hidden rounded-[22px] border border-brand-border bg-white"
            aria-labelledby="staff-list"
          >
            <div className="border-b border-brand-border p-5">
              <h2 id="staff-list" className="font-heading text-xl font-semibold">
                Anggota tim
              </h2>
            </div>
            <div className="divide-y divide-brand-border">
              {members.map((member) => (
                <article
                  key={member.user_id}
                  className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-start"
                >
                  <div>
                    <p className="font-semibold capitalize">
                      {member.role} · {member.status}
                    </p>
                    <p className="mt-1 font-mono text-xs text-brand-muted">
                      UUID suffix {member.user_id.slice(-8)} · dibuat{" "}
                      {date.format(new Date(member.created_at))}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-brand-muted">
                      <li>
                        Tinjau verifikasi:{" "}
                        {member.verification_reviewer ? "Aktif" : "Nonaktif"}
                      </li>
                      <li>
                        Lihat Akses Awal:{" "}
                        {member.can_early_access_read || member.can_early_access_review
                          ? "Aktif"
                          : "Nonaktif"}
                      </li>
                      <li>
                        Review & undang Akses Awal:{" "}
                        {member.can_early_access_review ? "Aktif" : "Nonaktif"}
                      </li>
                      <li>
                        Lihat ringkasan akun:{" "}
                        {member.can_users_read ? "Aktif" : "Nonaktif"}
                      </li>
                      <li>
                        Cari akun dengan email:{" "}
                        {member.can_users_support ? "Aktif" : "Nonaktif"}
                      </li>
                    </ul>
                  </div>
                  {member.role === "admin" ? (
                    <div className="flex max-w-xl flex-wrap gap-2">
                      {member.status === "active" ? (
                        <>
                          <CapabilityForm
                            userId={member.user_id}
                            action={
                              member.verification_reviewer
                                ? "remove_reviewer"
                                : "grant_reviewer"
                            }
                            label={
                              member.verification_reviewer
                                ? "Cabut reviewer"
                                : "Aktifkan reviewer"
                            }
                          />
                          <CapabilityForm
                            userId={member.user_id}
                            action={
                              member.can_early_access_read
                                ? "remove_early_access"
                                : "grant_early_access"
                            }
                            label={
                              member.can_early_access_read
                                ? "Cabut Akses Awal"
                                : "Aktifkan Akses Awal"
                            }
                          />
                          <CapabilityForm
                            userId={member.user_id}
                            action={
                              member.can_early_access_review
                                ? "remove_early_access_review"
                                : "grant_early_access_review"
                            }
                            label={
                              member.can_early_access_review
                                ? "Cabut review Akses Awal"
                                : "Boleh review Akses Awal"
                            }
                          />
                          <CapabilityForm
                            userId={member.user_id}
                            action={
                              member.can_users_read
                                ? "remove_users_read"
                                : "grant_users_read"
                            }
                            label={
                              member.can_users_read
                                ? "Cabut ringkasan akun"
                                : "Boleh lihat ringkasan akun"
                            }
                          />
                          <CapabilityForm
                            userId={member.user_id}
                            action={
                              member.can_users_support
                                ? "remove_users_support"
                                : "grant_users_support"
                            }
                            label={
                              member.can_users_support
                                ? "Cabut pencarian email"
                                : "Boleh cari dengan email"
                            }
                          />
                          <CapabilityForm
                            userId={member.user_id}
                            action="deactivate_admin"
                            label="Nonaktifkan"
                          />
                        </>
                      ) : (
                        <CapabilityForm
                          userId={member.user_id}
                          action="reactivate_admin"
                          label="Aktifkan kembali"
                        />
                      )}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </StaffShell>
  );
}

export default function StaffPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            Menyiapkan tim operasional…
          </p>
        </main>
      }
    >
      <StaffContent {...props} />
    </Suspense>
  );
}
