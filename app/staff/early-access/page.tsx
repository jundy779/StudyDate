import { StaffShell } from "@/components/staff/staff-shell";
import { requireStaffCapability } from "@/lib/staff/authorization";
import { listEarlyAccessWaitlistOps } from "@/lib/staff/service";
import Link from "next/link";
import { Suspense } from "react";

type Props = {
  searchParams: Promise<{
    email?: string;
    status?: string;
    campus?: string;
    interest?: string;
    source?: string;
    page?: string;
  }>;
};

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const PAGE_SIZE = 25;

async function EarlyAccessContent({ searchParams }: Props) {
  const access = await requireStaffCapability("early_access.read");
  const query = await searchParams;
  const page = Math.max(1, Number(query.page ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const email = query.email?.trim() || null;
  const status =
    query.status === "waiting" || query.status === "claimed"
      ? query.status
      : null;
  const campus = query.campus?.trim() || null;
  const interest =
    query.interest === "people" ||
    query.interest === "groups" ||
    query.interest === "events"
      ? query.interest
      : null;
  const source =
    query.source === "navbar" ||
    query.source === "hero" ||
    query.source === "final-cta"
      ? query.source
      : null;

  let rows: Awaited<ReturnType<typeof listEarlyAccessWaitlistOps>> = [];
  let loadError = "";
  try {
    rows = await listEarlyAccessWaitlistOps({
      email,
      status,
      campus,
      interest,
      source,
      limit: PAGE_SIZE,
      offset,
    });
  } catch {
    loadError = "Daftar Akses Awal belum dapat dimuat.";
  }

  const total = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));

  function pageHref(nextPage: number) {
    const params = new URLSearchParams();
    if (email) params.set("email", email);
    if (status) params.set("status", status);
    if (campus) params.set("campus", campus);
    if (interest) params.set("interest", interest);
    if (source) params.set("source", source);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/staff/early-access?${qs}` : "/staff/early-access";
  }

  return (
    <StaffShell role={access.role} current="early-access" access={access}>
      <main className="min-h-svh bg-brand-surface">
        <div className="page-shell py-10 sm:py-14">
          <p className="section-label">Operasional staff</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em]">
            Akses Awal
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-brand-muted">
            Daftar minat Early Access untuk dukungan operasional. Waitlist bukan
            akun. Tidak ada klaim paksa atau undangan massal dari halaman ini.
          </p>

          <form
            method="get"
            className="mt-8 grid gap-4 rounded-[22px] border border-brand-border bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
          >
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
            <label className="text-sm font-semibold">
              Status
              <select
                name="status"
                defaultValue={status ?? ""}
                className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 text-sm"
              >
                <option value="">Semua</option>
                <option value="waiting">Menunggu</option>
                <option value="claimed">Sudah diklaim</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Kampus
              <input
                name="campus"
                defaultValue={campus ?? ""}
                className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 text-sm"
              />
            </label>
            <label className="text-sm font-semibold">
              Minat
              <select
                name="interest"
                defaultValue={interest ?? ""}
                className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 text-sm"
              >
                <option value="">Semua</option>
                <option value="people">People</option>
                <option value="groups">Groups</option>
                <option value="events">Events</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Sumber CTA
              <select
                name="source"
                defaultValue={source ?? ""}
                className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 text-sm"
              >
                <option value="">Semua</option>
                <option value="navbar">Navbar</option>
                <option value="hero">Hero</option>
                <option value="final-cta">Final CTA</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="focus-ring min-h-11 w-full rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
              >
                Filter
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
            aria-labelledby="early-access-list"
          >
            <div className="border-b border-brand-border p-5">
              <h2 id="early-access-list" className="font-heading text-xl font-semibold">
                Hasil ({Number(total)})
              </h2>
            </div>
            <div className="divide-y divide-brand-border">
              {rows.length === 0 ? (
                <p className="p-6 text-brand-muted">Tidak ada baris untuk filter ini.</p>
              ) : (
                rows.map((row) => (
                  <article
                    key={`${row.email}-${row.created_at}`}
                    className="grid gap-2 p-5 lg:grid-cols-[1.4fr_1fr_auto]"
                  >
                    <div>
                      <p className="font-semibold break-all">{row.email}</p>
                      <p className="mt-1 text-sm text-brand-muted">
                        {row.campus || "Kampus tidak diisi"} ·{" "}
                        {(row.interests ?? []).join(", ") || "Tanpa minat"}
                      </p>
                    </div>
                    <div className="text-sm text-brand-muted">
                      <p>Sumber: {row.source ?? "—"}</p>
                      <p>Status: {row.status}</p>
                      <p>{row.activation_label}</p>
                    </div>
                    <time className="text-sm text-brand-muted">
                      {dateFmt.format(new Date(row.created_at))}
                      {row.claimed_at
                        ? ` · aktif ${dateFmt.format(new Date(row.claimed_at))}`
                        : ""}
                    </time>
                  </article>
                ))
              )}
            </div>
          </section>

          {totalPages > 1 ? (
            <nav
              className="mt-6 flex flex-wrap items-center gap-3"
              aria-label="Paginasi Akses Awal"
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

export default function EarlyAccessOpsPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            Menyiapkan daftar Akses Awal…
          </p>
        </main>
      }
    >
      <EarlyAccessContent {...props} />
    </Suspense>
  );
}
