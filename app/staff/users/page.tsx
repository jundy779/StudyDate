import { StaffShell } from "@/components/staff/staff-shell";
import {
  EmptyState,
  Notice,
  Panel,
  StaffPage,
  StatusChip,
  staffButton,
  staffField,
  staffLabel,
} from "@/components/staff/ui";
import {
  requireStaffCapability,
  staffHasCapability,
} from "@/lib/staff/authorization";
import { listStudentAccountOps } from "@/lib/staff/service";
import { Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

type Props = {
  searchParams: Promise<{
    alias?: string;
    email?: string;
    page?: string;
  }>;
};

const dateFmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });
const PAGE_SIZE = 25;

function onboardingLabel(value: string) {
  return value.replace("Onboarding", "Penyiapan akun");
}

async function UsersContent({ searchParams }: Props) {
  const access = await requireStaffCapability("users.read");
  const canSupport = staffHasCapability(access, "users.support");
  const query = await searchParams;
  const page = Math.max(1, Number(query.page ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const alias = query.alias?.trim() || null;
  const email = canSupport ? query.email?.trim() || null : null;

  let rows: Awaited<ReturnType<typeof listStudentAccountOps>> = [];
  let loadError = "";
  try {
    rows = await listStudentAccountOps({
      alias,
      email,
      limit: PAGE_SIZE,
      offset,
    });
  } catch {
    loadError = "Daftar akun belum dapat dimuat. Muat ulang halaman sebentar lagi.";
  }

  const total = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));
  const searching = Boolean(alias || email);

  function pageHref(nextPage: number) {
    const params = new URLSearchParams();
    if (alias) params.set("alias", alias);
    if (email) params.set("email", email);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/staff/users?${qs}` : "/staff/users";
  }

  return (
    <StaffShell role={access.role} current="users" access={access}>
      <StaffPage
        kicker="Area Admin"
        title="Akun mahasiswa"
        description={
          <>
            Cari akun untuk membantu kendala masuk, penyiapan akun, paket, atau tampilan profil.{" "}
            NIM, kontak, percakapan, foto identitas, dan bukti verifikasi tidak tersedia di sini.
          </>
        }
        mascot="penasaran"
      >
        <Panel title="Cari akun">
          <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label className={staffLabel}>
              Nama samaran
              <input
                name="alias"
                defaultValue={alias ?? ""}
                className={staffField}
                placeholder="Partner #123456"
                autoComplete="off"
              />
            </label>
            {canSupport ? (
              <label className={staffLabel}>
                Email lengkap
                <input
                  name="email"
                  type="email"
                  defaultValue={email ?? ""}
                  className={staffField}
                  placeholder="nama@email.com"
                  autoComplete="off"
                />
              </label>
            ) : (
              <p className="text-sm leading-6 text-brand-muted">
                Cari pakai email lengkap hanya bisa untuk petugas dukungan akun (izin users.support).
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" className={`${staffButton.primary} flex-1`}>
                <Search className="h-4 w-4" aria-hidden="true" />
                Cari
              </button>
              {searching ? (
                <Link href="/staff/users" className={staffButton.quiet}>
                  Hapus
                </Link>
              ) : null}
            </div>
          </form>
        </Panel>

        {loadError ? <Notice tone="danger">{loadError}</Notice> : null}

        <Panel
          title={searching ? `Hasil pencarian (${Number(total)})` : `Semua akun (${Number(total)})`}
          description="Paling baru di atas."
          quiet
        >
          {rows.length === 0 ? (
            <EmptyState title="Tidak ada akun yang cocok" expression="kaget">
              Periksa ejaan nama samaran, atau pakai email lengkap.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-brand-border">
              {rows.map((row) => (
                <li
                  key={row.account_ref}
                  className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-navy">{row.alias}</p>
                    <p className="mt-0.5 break-all text-sm text-brand-muted">{row.email_display}</p>
                    <p className="mt-0.5 text-sm text-brand-muted">
                      {row.campus} · {row.study_program}
                      {row.semester != null ? ` · semester ${row.semester}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusChip tone="info">{row.account_status}</StatusChip>
                    <StatusChip tone="muted">{onboardingLabel(row.onboarding_status)}</StatusChip>
                    <StatusChip tone={row.verification_summary === "Terverifikasi" ? "go" : "wait"}>
                      {row.verification_summary}
                    </StatusChip>
                    <StatusChip tone="muted">Paket: {row.membership_plan}</StatusChip>
                    <StatusChip tone={row.is_discoverable ? "go" : "muted"}>
                      {row.is_discoverable ? "Tampil di pencarian teman" : "Tidak tampil di pencarian teman"}
                    </StatusChip>
                  </div>
                  <div className="flex items-center gap-3 lg:flex-col lg:items-end">
                    <span className="text-sm text-brand-muted">
                      Daftar {dateFmt.format(new Date(row.created_at))}
                    </span>
                    <Link href={`/staff/users/${row.account_ref}`} className={staffButton.quiet}>
                      Lihat ringkasan
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 ? (
            <nav className="mt-5 flex flex-wrap items-center gap-3" aria-label="Paginasi akun">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className={staffButton.quiet}>
                  Sebelumnya
                </Link>
              ) : null}
              <span className="text-sm text-brand-muted">
                Halaman {page} dari {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className={staffButton.quiet}>
                  Berikutnya
                </Link>
              ) : null}
            </nav>
          ) : null}
        </Panel>
      </StaffPage>
    </StaffShell>
  );
}

export default function StaffUsersPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">Menyiapkan daftar akun...</p>
        </main>
      }
    >
      <UsersContent {...props} />
    </Suspense>
  );
}
