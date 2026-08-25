import { moderateEarlyAccess } from "@/app/staff/early-access/actions";
import type { StaffAccess } from "@/lib/staff/authorization";
import { staffHasCapability } from "@/lib/staff/authorization";
import { listEarlyAccessWaitlistOps } from "@/lib/staff/service";
import Link from "next/link";

export type EarlyAccessQueueSearchParams = {
  email?: string;
  status?: string;
  campus?: string;
  interest?: string;
  source?: string;
  page?: string;
  state?: string;
};

type Props = {
  access: StaffAccess;
  query: EarlyAccessQueueSearchParams;
  basePath: "/owner/early-access" | "/staff/early-access";
};

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const PAGE_SIZE = 25;

const statusLabels: Record<string, string> = {
  waiting: "Menunggu review",
  approved: "Disetujui",
  rejected: "Tidak disetujui",
  claimed: "Akses diklaim",
};

const sourceLabels: Record<string, string> = {
  navbar: "Navigasi",
  hero: "Bagian utama landing",
  "final-cta": "Ajakan akhir landing",
};

const stateMessages: Record<
  string,
  { text: string; tone: "success" | "error" | "warning" }
> = {
  approved: {
    text: "Akses disetujui dan undangan login sudah dikirim ke email pendaftar.",
    tone: "success",
  },
  rejected: {
    text: "Pendaftaran Akses Awal ditandai tidak disetujui.",
    tone: "success",
  },
  resent: {
    text: "Undangan Akses Awal berhasil dikirim ulang.",
    tone: "success",
  },
  approved_email_error: {
    text: "Akses sudah disetujui, tetapi email undangan belum berhasil dikirim. Gunakan Kirim ulang undangan setelah layanan email siap.",
    tone: "warning",
  },
  email_error: {
    text: "Undangan belum dapat dikirim. Status persetujuan tidak berubah.",
    tone: "error",
  },
  review_error: {
    text: "Keputusan Akses Awal belum dapat disimpan.",
    tone: "error",
  },
  invalid: {
    text: "Permintaan review tidak valid.",
    tone: "error",
  },
};

function StatusNotice({ state }: { state?: string }) {
  if (!state) return null;
  const notice = stateMessages[state];
  if (!notice) return null;

  const toneClass =
    notice.tone === "success"
      ? "border-green-200 bg-green-50 text-brand-success"
      : notice.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-red-200 bg-red-50 text-brand-error";

  return (
    <p
      role={notice.tone === "error" ? "alert" : "status"}
      className={`mt-6 rounded-xl border px-4 py-3 text-sm font-semibold ${toneClass}`}
    >
      {notice.text}
    </p>
  );
}

function ReviewAction({
  email,
  action,
  label,
  basePath,
  danger = false,
}: {
  email: string;
  action: "approve" | "reject" | "resend";
  label: string;
  basePath: Props["basePath"];
  danger?: boolean;
}) {
  return (
    <form action={moderateEarlyAccess}>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="returnTo" value={basePath} />
      <button
        type="submit"
        className={`focus-ring min-h-11 rounded-xl px-4 text-sm font-semibold ${
          danger
            ? "border border-red-200 bg-white text-brand-error"
            : action === "approve"
              ? "bg-brand-blue text-white"
              : "border border-brand-border bg-white text-brand-blue"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

export async function EarlyAccessQueue({ access, query, basePath }: Props) {
  const canReview = staffHasCapability(access, "early_access.review");
  const page = Math.max(1, Number(query.page ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const email = query.email?.trim() || null;
  const status =
    query.status === "waiting" ||
    query.status === "approved" ||
    query.status === "rejected" ||
    query.status === "claimed"
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
    loadError = "Antrean Akses Awal belum dapat dimuat.";
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
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <main className="min-h-svh bg-brand-surface">
      <div className="page-shell py-10 sm:py-14">
        <p className="section-label">
          {access.role === "owner" ? "Khusus Owner" : "Operasional staff"}
        </p>
        <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em]">
          Moderasi Akses Awal
        </h1>
        <p className="mt-4 max-w-3xl leading-7 text-brand-muted">
          Satu antrean untuk pendaftar dari landing page. Owner selalu dapat
          meninjau. Staff hanya dapat melihat atau mengambil keputusan bila
          capability Akses Awal diberikan secara eksplisit.
        </p>
        <div className="mt-6 border-l-2 border-brand-blue pl-4 text-sm leading-6 text-brand-muted">
          <p>
            <strong className="text-brand-navy">Approve:</strong> sistem
            mengirim email resmi berisi tautan login sekali pakai. Setelah email
            yang sama terautentikasi, akses diklaim secara server-side lalu user
            masuk ke onboarding.
          </p>
          <p className="mt-1">
            Approval Akses Awal bukan Student Verification dan tidak membuka
            badge, identitas, atau akses staff apa pun.
          </p>
        </div>

        <StatusNotice state={query.state} />

        {!canReview ? (
          <p className="mt-6 rounded-xl border border-brand-border bg-white px-4 py-3 text-sm leading-6 text-brand-muted">
            Mode baca saja. Hubungi Owner bila tugasmu membutuhkan Approve,
            Reject, atau kirim ulang undangan.
          </p>
        ) : null}

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
              <option value="waiting">Menunggu review</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Tidak disetujui</option>
              <option value="claimed">Akses diklaim</option>
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
              Antrean ({Number(total)})
            </h2>
          </div>
          <div className="divide-y divide-brand-border">
            {rows.length === 0 ? (
              <p className="p-6 text-brand-muted">Tidak ada pendaftar untuk filter ini.</p>
            ) : (
              rows.map((row) => (
                <article
                  key={`${row.email}-${row.created_at}`}
                  className="grid gap-4 p-5 lg:grid-cols-[1.35fr_1fr_auto]"
                >
                  <div>
                    <p className="break-all font-semibold">{row.email}</p>
                    <p className="mt-1 text-sm text-brand-muted">
                      {row.campus || "Kampus tidak diisi"} ·{" "}
                      {(row.interests ?? []).join(", ") || "Tanpa minat"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-brand-muted">
                      Daftar {dateFmt.format(new Date(row.created_at))}
                      {row.reviewed_at
                        ? ` · direview ${dateFmt.format(new Date(row.reviewed_at))}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-sm leading-6 text-brand-muted">
                    <p>
                      Sumber: {row.source ? sourceLabels[row.source] ?? row.source : "—"}
                    </p>
                    <p>Status: {statusLabels[row.status] ?? row.status}</p>
                    <p>{row.activation_label}</p>
                    {row.invitation_sent_at ? (
                      <p>
                        Email terakhir: {dateFmt.format(new Date(row.invitation_sent_at))}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-start gap-2 lg:max-w-[270px] lg:justify-end">
                    {canReview && row.status !== "claimed" ? (
                      <>
                        {row.status !== "approved" ? (
                          <ReviewAction
                            email={row.email}
                            action="approve"
                            label="Approve & kirim email"
                            basePath={basePath}
                          />
                        ) : (
                          <ReviewAction
                            email={row.email}
                            action="resend"
                            label="Kirim ulang undangan"
                            basePath={basePath}
                          />
                        )}
                        {row.status !== "rejected" ? (
                          <ReviewAction
                            email={row.email}
                            action="reject"
                            label="Reject"
                            basePath={basePath}
                            danger
                          />
                        ) : null}
                      </>
                    ) : null}
                  </div>
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
  );
}
