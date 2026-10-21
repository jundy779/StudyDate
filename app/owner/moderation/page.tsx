import { StaffShell } from "@/components/staff/staff-shell";
import {
  EmptyState,
  FilterChips,
  Notice,
  Panel,
  StaffPage,
  StatusChip,
  staffButton,
} from "@/components/staff/ui";
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

const STATUS_TONE: Record<ModerationStatus, "stop" | "info" | "go" | "muted"> = {
  submitted: "stop",
  under_review: "info",
  resolved: "go",
  dismissed: "muted",
};

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
      "Daftar laporan belum dapat dibuka. Coba muat ulang atau periksa kesiapan sistem.";
  }

  return (
    <StaffShell role={access.role} current="moderation">
      <StaffPage
        kicker="Khusus Owner"
        title={MODERATION_COPY.heading}
        description={MODERATION_COPY.description}
        mascot={unresolved > 0 ? "kaget" : "girang"}
      >
        {query.state === "invalid" ? (
          <Notice tone="danger">Pilihan laporan belum sesuai. Muat ulang halaman dan coba lagi.</Notice>
        ) : null}
        {loadError ? <Notice tone="danger">{loadError}</Notice> : null}
        {!loadError && unresolved > 0 ? (
          <Notice tone="warn" title={`${MODERATION_COPY.unresolvedLabel}: ${unresolved}`}>
            Laporan baru sebaiknya diperiksa di hari yang sama. Mulai dari yang paling lama.
          </Notice>
        ) : null}

        <Panel title="Daftar laporan" description={`${items.length} laporan pada pilihan ini.`} quiet>
          <FilterChips
            label="Pilih status laporan"
            items={[
              { href: "/owner/moderation", label: "Semua", active: !selected },
              ...MODERATION_STATUSES.map((status) => ({
                href: `/owner/moderation?status=${status}`,
                label: MODERATION_STATUS_LABELS[status],
                active: selected === status,
              })),
            ]}
          />

          {loadError ? null : items.length ? (
            <ul className="divide-y divide-brand-border" aria-label="Daftar laporan">
              {items.map((item) => (
                <li key={item.report_id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-brand-navy">{reasonLabel(item.reason_code)}</h3>
                      <StatusChip tone={STATUS_TONE[item.moderation_status]}>
                        {MODERATION_STATUS_LABELS[item.moderation_status]}
                      </StatusChip>
                    </div>
                    <p className="mt-1 text-sm text-brand-muted">
                      Di {MODERATION_TARGET_LABELS[item.target_kind] ?? item.target_kind} · laporan ...
                      {item.report_id.slice(-8)} · {date.format(new Date(item.created_at))}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-muted">
                      Akun yang dilaporkan ...{item.subject_suffix}
                      {item.has_message_ref ? " · ada cuplikan pesan" : ""}
                    </p>
                  </div>
                  <Link href={`/owner/moderation/${item.report_id}`} className={staffButton.primary}>
                    Periksa
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={MODERATION_COPY.empty} expression="girang" />
          )}
        </Panel>
      </StaffPage>
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
