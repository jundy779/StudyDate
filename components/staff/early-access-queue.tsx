import { moderateEarlyAccess } from "@/app/staff/early-access/actions";
import {
  EARLY_ACCESS_REVIEW_REASONS,
  getEarlyAccessReviewReasonLabel,
} from "@/lib/early-access/review-reasons";
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
  waiting: "Menunggu pemeriksaan",
  approved: "Disetujui",
  needs_revision: "Perlu diperbaiki",
  rejected: "Tidak disetujui",
  claimed: "Akses diklaim",
};

const sourceLabels: Record<string, string> = {
  navbar: "Navigasi atas",
  hero: "Bagian pembuka",
  "final-cta": "Ajakan di bagian akhir",
};

const interestLabels: Record<string, string> = {
  people: "Cari teman",
  groups: "Circle belajar",
  events: "Acara kampus",
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
    text: "Pendaftaran ditolak dan email pemberitahuan sudah dikirim.",
    tone: "success",
  },
  revision_requested: {
    text: "Permintaan perbaikan sudah disimpan dan email petunjuk dikirim ke pendaftar.",
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
  revision_email_error: {
    text: "Status Perlu diperbaiki sudah tersimpan, tetapi email belum terkirim. Kirim Minta perbaikan lagi untuk membuat tautan baru dan mencoba ulang.",
    tone: "warning",
  },
  rejected_email_error: {
    text: "Status penolakan sudah tersimpan, tetapi email pemberitahuan belum terkirim. Pilih Tolak lagi untuk mencoba mengirim ulang.",
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
    text: "Permintaan pemeriksaan tidak valid. Untuk Tolak atau Minta perbaikan, pilih minimal satu alasan.",
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

function DirectReviewAction({
  email,
  action,
  label,
  basePath,
}: {
  email: string;
  action: "approve" | "resend";
  label: string;
  basePath: Props["basePath"];
}) {
  return (
    <form action={moderateEarlyAccess}>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="returnTo" value={basePath} />
      <button
        type="submit"
        className={`focus-ring min-h-11 rounded-xl px-4 text-sm font-semibold ${
          action === "approve"
            ? "bg-brand-blue text-white"
            : "border border-brand-border bg-white text-brand-blue"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

function DecisionForm({
  email,
  action,
  basePath,
}: {
  email: string;
  action: "needs_revision" | "reject";
  basePath: Props["basePath"];
}) {
  const revision = action === "needs_revision";
  return (
    <details className="relative">
      <summary
        className={`focus-ring flex min-h-11 cursor-pointer list-none items-center rounded-xl border px-4 text-sm font-semibold ${
          revision
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-red-200 bg-white text-brand-error"
        }`}
      >
        {revision ? "Minta perbaikan" : "Tolak"}
      </summary>
      <div className="mt-2 w-full rounded-2xl border border-brand-border bg-white p-4 shadow-sm lg:absolute lg:right-0 lg:z-20 lg:w-[390px]">
        <form action={moderateEarlyAccess} className="space-y-4">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="action" value={action} />
          <input type="hidden" name="returnTo" value={basePath} />
          <fieldset>
            <legend className="text-sm font-semibold text-brand-navy">
              Alasan keputusan
            </legend>
            <p className="mt-1 text-xs leading-5 text-brand-muted">
              Pilih minimal satu. Alasan ini akan dijelaskan ke pendaftar lewat email.
            </p>
            <div className="mt-3 space-y-2">
              {EARLY_ACCESS_REVIEW_REASONS.map((reason) => (
                <label
                  key={reason.code}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="reasonCode"
                    value={reason.code}
                    className="mt-1 size-4"
                  />
                  <span>
                    <span className="font-semibold text-brand-navy">{reason.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-brand-muted">
                      {reason.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold text-brand-navy">
            Catatan untuk pendaftar (opsional)
            <textarea
              name="userNote"
              maxLength={500}
              rows={3}
              className="focus-ring mt-2 w-full rounded-xl border border-brand-border px-3 py-2 text-sm font-normal"
              placeholder="Contoh: gunakan nama lengkap Universitas Indonesia, bukan UI."
            />
          </label>
          <label className="block text-sm font-semibold text-brand-navy">
            Catatan internal (opsional)
            <textarea
              name="internalNote"
              maxLength={800}
              rows={2}
              className="focus-ring mt-2 w-full rounded-xl border border-brand-border px-3 py-2 text-sm font-normal"
              placeholder="Hanya Owner atau Admin yang bertugas yang dapat melihat catatan ini."
            />
          </label>
          <button
            type="submit"
            className={`focus-ring min-h-11 w-full rounded-xl px-4 text-sm font-semibold ${
              revision
                ? "bg-amber-500 text-brand-navy"
                : "bg-brand-error text-white"
            }`}
          >
            {revision ? "Kirim permintaan perbaikan" : "Tolak & kirim email"}
          </button>
        </form>
      </div>
    </details>
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
    query.status === "needs_revision" ||
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
          {access.role === "owner" ? "Khusus Owner" : "Area Admin"}
        </p>
        <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em]">
          Pemeriksaan Akses Awal
        </h1>
        <p className="mt-4 max-w-3xl leading-7 text-brand-muted">
          Satu antrean untuk pendaftar dari halaman utama. Owner selalu dapat
          memeriksa. Admin hanya dapat melihat atau mengambil keputusan jika
          sudah diberi izin untuk menangani Akses Awal.
        </p>
        <div className="mt-6 border-l-2 border-brand-blue pl-4 text-sm leading-6 text-brand-muted">
          <p>
            <strong className="text-brand-navy">Setujui:</strong> kirim undangan
            login sekali pakai. <strong className="text-brand-navy">Minta perbaikan:</strong>{" "}
            kirim alasan dan tautan perbaikan yang aman. <strong className="text-brand-navy">Tolak:</strong>{" "}
            simpan penolakan dan kirim alasannya melalui email.
          </p>
          <p className="mt-1">
            Catatan untuk tim tidak pernah dimasukkan ke email pendaftar.
            Persetujuan Akses Awal tetap terpisah dari verifikasi mahasiswa.
          </p>
        </div>

        <StatusNotice state={query.state} />

        {!canReview ? (
          <p className="mt-6 rounded-xl border border-brand-border bg-white px-4 py-3 text-sm leading-6 text-brand-muted">
            Kamu hanya dapat melihat daftar ini. Hubungi Owner jika perlu
            menyetujui, meminta perbaikan, menolak, atau mengirim ulang undangan.
          </p>
        ) : null}

        <form
          method="get"
          className="mt-8 grid gap-4 rounded-[22px] border border-brand-border bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="text-sm font-semibold">
            Email lengkap
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
              <option value="waiting">Menunggu pemeriksaan</option>
              <option value="approved">Disetujui</option>
              <option value="needs_revision">Perlu diperbaiki</option>
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
              <option value="people">Cari teman</option>
              <option value="groups">Circle belajar</option>
              <option value="events">Acara kampus</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Bagian asal pendaftaran
            <select
              name="source"
              defaultValue={source ?? ""}
              className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 text-sm"
            >
              <option value="">Semua</option>
              <option value="navbar">Navigasi atas</option>
              <option value="hero">Bagian pembuka</option>
              <option value="final-cta">Ajakan di bagian akhir</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="focus-ring min-h-11 w-full rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
            >
              Terapkan filter
            </button>
          </div>
        </form>

        {loadError ? (
          <p role="alert" className="mt-6 text-sm font-semibold text-brand-error">
            {loadError}
          </p>
        ) : null}

        <section
          className="mt-8 overflow-visible rounded-[22px] border border-brand-border bg-white"
          aria-labelledby="early-access-list"
        >
          <div className="border-b border-brand-border p-5">
            <h2 id="early-access-list" className="font-heading text-xl font-semibold">
              Pendaftar Akses Awal ({Number(total)})
            </h2>
          </div>
          <div className="divide-y divide-brand-border">
            {rows.length === 0 ? (
              <p className="p-6 text-brand-muted">Tidak ada pendaftar untuk pilihan ini.</p>
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
                      {(row.interests ?? [])
                        .map((item) => interestLabels[item] ?? item)
                        .join(", ") || "Tanpa minat"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-brand-muted">
                      Daftar {dateFmt.format(new Date(row.created_at))}
                      {row.reviewed_at
                        ? ` · diperiksa ${dateFmt.format(new Date(row.reviewed_at))}`
                        : ""}
                      {row.resubmitted_at
                        ? ` · diperbaiki ${dateFmt.format(new Date(row.resubmitted_at))}`
                        : ""}
                    </p>
                    {row.review_reason_codes?.length ? (
                      <div className="mt-3 rounded-xl bg-brand-surface px-3 py-2 text-xs leading-5 text-brand-muted">
                        <p className="font-semibold text-brand-navy">Hasil pemeriksaan terakhir</p>
                        <ul className="mt-1 list-disc pl-4">
                          {row.review_reason_codes.map((code) => (
                            <li key={code}>{getEarlyAccessReviewReasonLabel(code)}</li>
                          ))}
                        </ul>
                        {row.review_user_note ? (
                          <p className="mt-1">Untuk pendaftar: {row.review_user_note}</p>
                        ) : null}
                        {row.review_internal_note ? (
                          <p className="mt-1 font-medium text-brand-navy">
                            Catatan tim: {row.review_internal_note}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-sm leading-6 text-brand-muted">
                    <p>
                      Sumber: {row.source ? sourceLabels[row.source] ?? row.source : "—"}
                    </p>
                    <p>Status: {statusLabels[row.status] ?? row.status}</p>
                    <p>{row.activation_label}</p>
                    {row.invitation_sent_at ? (
                      <p>Email terakhir: {dateFmt.format(new Date(row.invitation_sent_at))}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-start gap-2 lg:max-w-[320px] lg:justify-end">
                    {canReview && row.status !== "claimed" ? (
                      <>
                        {row.status !== "approved" ? (
                          <DirectReviewAction
                            email={row.email}
                            action="approve"
                            label="Setujui dan kirim email"
                            basePath={basePath}
                          />
                        ) : (
                          <DirectReviewAction
                            email={row.email}
                            action="resend"
                            label="Kirim ulang undangan"
                            basePath={basePath}
                          />
                        )}
                        {row.status !== "approved" ? (
                          <DecisionForm
                            email={row.email}
                            action="needs_revision"
                            basePath={basePath}
                          />
                        ) : null}
                        <DecisionForm
                          email={row.email}
                          action="reject"
                          basePath={basePath}
                        />
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
            aria-label="Navigasi halaman Akses Awal"
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
