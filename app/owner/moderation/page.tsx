import { StaffShell } from "@/components/staff/staff-shell";
import {
  MODERATION_COPY,
  MODERATION_STATUS_LABELS,
  MODERATION_STATUSES,
  MODERATION_TARGET_LABELS,
  type ModerationStatus,
} from "@/lib/moderation/constants";
import {
  countUnresolvedModerationReports,
  listModerationReports,
} from "@/lib/moderation/service";
import { REPORT_REASON_LABELS, type ReportReasonCode } from "@/lib/introductions/constants";
import { requireOwner } from "@/lib/staff/authorization";
import Link from "next/link";
import { Suspense } from "react";

const date = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

type Props = {
  searchParams: Promise<{ status?: string; state?: string }>;
};

function reasonLabel(code: string) {
  return REPORT_REASON_LABELS[code as ReportReasonCode] ?? code;
}

async function ModerationInboxContent({ searchParams }: Props) {
  const access = await requireOwner();
  const query = await searchParams;
  const selected = MODERATION_STATUSES.includes(
    query.status as ModerationStatus,
  )
    ? (query.status as ModerationStatus)
    : undefined;

  let items: Awaited<ReturnType<typeof listModerationReports>> = [];
  let unresolved = 0;
  let loadError: string | null = null;
  try {
    [items, unresolved] = await Promise.all([
      listModerationReports(selected),
      countUnresolvedModerationReports(),
    ]);
  } catch {
    loadError =
      "Antrean belum tersedia. Pastikan migrasi moderasi sudah diterapkan, lalu muat ulang.";
  }

  return (
    <StaffShell role={access.role} current="moderation">
      <main className="min-h-svh bg-brand-surface">
        <div className="page-shell py-10 sm:py-14">
          <p className="section-label">Owner only</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            {MODERATION_COPY.heading}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-muted">
            {MODERATION_COPY.description}
          </p>
          <p className="mt-4 text-sm font-semibold text-brand-navy">
            {MODERATION_COPY.unresolvedLabel}: {unresolved}
          </p>

          {query.state === "invalid" && (
            <p
              role="status"
              className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-brand-error"
            >
              Input tidak valid.
            </p>
          )}

          <nav
            aria-label="Filter status moderasi"
            className="mt-7 flex gap-2 overflow-x-auto pb-2"
          >
            <Link
              href="/owner/moderation"
              className="focus-ring shrink-0 rounded-full border border-brand-border bg-white px-4 py-2 text-sm font-semibold"
            >
              Semua
            </Link>
            {MODERATION_STATUSES.map((status) => (
              <Link
                key={status}
                href={`/owner/moderation?status=${status}`}
                className="focus-ring shrink-0 rounded-full border border-brand-border bg-white px-4 py-2 text-sm font-semibold"
              >
                {MODERATION_STATUS_LABELS[status]}
              </Link>
            ))}
          </nav>

          <section
            className="mt-6 overflow-hidden rounded-[22px] border border-brand-border bg-white"
            aria-label="Antrean laporan"
          >
            {loadError ? (
              <p className="p-7 text-brand-muted">{loadError}</p>
            ) : (
              <div className="divide-y divide-brand-border">
                {items.length ? (
                  items.map((item) => (
                    <article
                      key={item.report_id}
                      className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center"
                    >
                      <div>
                        <p className="font-semibold text-brand-navy">
                          Laporan …{item.report_id.slice(-8)}
                        </p>
                        <p className="mt-1 text-sm text-brand-muted">
                          {MODERATION_STATUS_LABELS[item.moderation_status]} ·{" "}
                          {MODERATION_TARGET_LABELS[item.target_kind] ??
                            item.target_kind}{" "}
                          · {reasonLabel(item.reason_code)}
                        </p>
                        <p className="mt-1 text-xs text-brand-muted">
                          Subjek …{item.subject_suffix} ·{" "}
                          {date.format(new Date(item.created_at))}
                          {item.has_message_ref ? " · ada referensi pesan" : ""}
                        </p>
                      </div>
                      <Link
                        href={`/owner/moderation/${item.report_id}`}
                        className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white"
                      >
                        Buka
                      </Link>
                    </article>
                  ))
                ) : (
                  <p className="p-7 text-brand-muted">{MODERATION_COPY.empty}</p>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </StaffShell>
  );
}

export default function OwnerModerationPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            {MODERATION_COPY.loading}
          </p>
        </main>
      }
    >
      <ModerationInboxContent {...props} />
    </Suspense>
  );
}
