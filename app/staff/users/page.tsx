import { StaffShell } from "@/components/staff/staff-shell";
import {
  requireStaffCapability,
  staffHasCapability,
} from "@/lib/staff/authorization";
import { listStudentAccountOps } from "@/lib/staff/service";
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
    loadError = "Daftar akun belum dapat dimuat.";
  }

  const total = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));

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
      <main className="min-h-svh bg-brand-surface">
        <div className="page-shell py-10 sm:py-14">
          <p className="section-label">Operasional staff</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em]">
            Akun pengguna
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-brand-muted">
            Proyeksi aman untuk dukungan operasional. Data verifikasi privat,
            chat, Contact Reveal, dan NIM tidak tersedia di sini.
          </p>

          <form
            method="get"
            className="mt-8 grid gap-4 rounded-[22px] border border-brand-border bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            <label className="text-sm font-semibold">
              Alias
              <input
                name="alias"
                defaultValue={alias ?? ""}
                className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 text-sm"
                placeholder="Partner #123456"
                autoComplete="off"
              />
            </label>
            {canSupport ? (
              <label className="text-sm font-semibold">
                Email (tepat)
                <input
                  name="email"
                  type="email"
                  defaultValue={email ?? ""}
                  className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 text-sm"
                  placeholder="nama@email.com"
                  autoComplete="off"
                />
              </label>
            ) : (
              <p className="text-sm leading-6 text-brand-muted sm:col-span-1">
                Pencarian email penuh membutuhkan kemampuan dukungan
                (users.support).
              </p>
            )}
            <div className="flex items-end">
              <button
                type="submit"
                className="focus-ring min-h-11 w-full rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
              >
                Cari
              </button>
            </div>
          </form>

          {loadError ? (
            <p role="alert" className="mt-6 text-sm font-semibold text-brand-error">
              {loadError}
            </p>
          ) : null}

          <section
            className="mt-8 overflow-hidden rounded-[22px] border border-brand-border bg-white"
            aria-labelledby="users-list"
          >
            <div className="border-b border-brand-border p-5">
              <h2 id="users-list" className="font-heading text-xl font-semibold">
                Hasil ({Number(total)})
              </h2>
            </div>
            <div className="divide-y divide-brand-border">
              {rows.length === 0 ? (
                <p className="p-6 text-brand-muted">Tidak ada akun untuk filter ini.</p>
              ) : (
                rows.map((row) => (
                  <article
                    key={`${row.alias}-${row.created_at}`}
                    className="grid gap-3 p-5 lg:grid-cols-[1.2fr_1fr_auto]"
                  >
                    <div>
                      <p className="font-semibold">{row.alias}</p>
                      <p className="mt-1 break-all text-sm text-brand-muted">
                        {row.email_display}
                      </p>
                      <p className="mt-1 text-sm text-brand-muted">
                        {row.campus} · {row.study_program}
                        {row.semester != null ? ` · semester ${row.semester}` : ""}
                      </p>
                    </div>
                    <div className="text-sm text-brand-muted">
                      <p>{row.account_status}</p>
                      <p>{row.onboarding_status}</p>
                      <p>Verifikasi: {row.verification_summary}</p>
                      <p>
                        Discoverable: {row.is_discoverable ? "Ya" : "Tidak"}
                      </p>
                    </div>
                    <time className="text-sm text-brand-muted">
                      {dateFmt.format(new Date(row.created_at))}
                    </time>
                  </article>
                ))
              )}
            </div>
          </section>

          {totalPages > 1 ? (
            <nav
              className="mt-6 flex flex-wrap items-center gap-3"
              aria-label="Paginasi akun"
            >
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className="focus-ring rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold"
                >
                  Sebelumnya
                </Link>
              ) : null}
              <span className="text-sm text-brand-muted">
                Halaman {page} dari {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1)}
                  className="focus-ring rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold"
                >
                  Berikutnya
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </main>
    </StaffShell>
  );
}

export default function StaffUsersPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            Menyiapkan daftar akun…
          </p>
        </main>
      }
    >
      <UsersContent {...props} />
    </Suspense>
  );
}
