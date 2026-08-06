import {
  acceptIntroduction,
  blockFromIntroduction,
  cancelIntroduction,
  declineIntroduction,
  reportFromIntroduction,
} from "@/app/app/introductions/actions";
import { AcceptedConversationLink } from "@/components/messages/accepted-conversation-link";
import {
  INTRODUCTION_STATUS_LABELS,
  REPORT_REASON_LABELS,
  REPORT_REASON_CODES,
  type IntroductionStatus,
} from "@/lib/introductions/constants";
import type { IntroductionListItem } from "@/lib/introductions/service";
import { getMascotForAlias } from "@/lib/people/constants";
import { BadgeCheck } from "lucide-react";
import Image from "next/image";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusClass(status: IntroductionStatus) {
  switch (status) {
    case "pending":
      return "bg-[#edf4ff] text-brand-blue";
    case "accepted":
      return "bg-emerald-50 text-emerald-800";
    case "declined":
    case "cancelled":
    case "expired":
      return "bg-brand-surface text-brand-muted";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function StatusBadge({ status }: { status: IntroductionStatus }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold tracking-[0.04em] ${statusClass(status)}`}
    >
      {INTRODUCTION_STATUS_LABELS[status]}
    </span>
  );
}

export function IntroductionCard({
  item,
  direction,
}: {
  item: IntroductionListItem;
  direction: "received" | "sent";
}) {
  const isPending = item.status === "pending";
  const reportReasonId = `reason-${item.request_id}`;
  const reportDetailsId = `details-${item.request_id}`;

  return (
    <article className="overflow-hidden rounded-[22px] border border-brand-border bg-white shadow-[0_12px_36px_rgba(15,27,51,0.05)]">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
        <div className="flex h-20 w-20 shrink-0 items-end justify-center overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_20%,#ffffff_0%,#edf4ff_55%,#dfeaff_100%)]">
          <Image
            src={getMascotForAlias(item.counterpart_alias)}
            alt=""
            width={72}
            height={72}
            className="h-[68px] w-[68px] object-contain object-bottom"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-xl font-semibold text-brand-navy">
              {item.counterpart_alias}
            </h2>
            {item.is_verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-surface px-2.5 py-1 text-xs font-semibold text-brand-blue">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Terverifikasi
              </span>
            ) : null}
            <StatusBadge status={item.status} />
          </div>

          <p className="mt-2 text-sm leading-6 text-brand-muted">
            {item.study_program} · {item.campus}
            {item.semester ? ` · Semester ${item.semester}` : ""}
          </p>
          <p className="mt-1 text-xs text-brand-muted">
            {direction === "received" ? "Diterima" : "Dikirim"}{" "}
            {formatDate(item.created_at)}
          </p>

          <blockquote className="mt-4 border-l-2 border-brand-blue/30 pl-4">
            <p className="whitespace-pre-wrap break-words text-base leading-7 text-brand-navy">
              {item.opening_message}
            </p>
          </blockquote>

          {item.status === "accepted" ? (
            <div className="mt-4 space-y-3">
              <p
                className="rounded-xl bg-[#edf4ff] px-4 py-3 text-sm leading-6 text-brand-navy"
                role="status"
              >
                Perkenalan diterima. Percakapan anonim sudah tersedia.
              </p>
              <AcceptedConversationLink requestId={item.request_id} />
            </div>
          ) : null}

          {item.status === "declined" ? (
            <p className="mt-4 text-sm leading-6 text-brand-muted" role="status">
              Perkenalan ditolak. Alasan pribadi tidak dibagikan.
            </p>
          ) : null}

          {item.status === "cancelled" ? (
            <p className="mt-4 text-sm leading-6 text-brand-muted" role="status">
              Perkenalan dibatalkan. Kamu bisa mencoba lagi nanti sesuai batas
              waktu yang berlaku.
            </p>
          ) : null}

          {item.status === "expired" ? (
            <p className="mt-4 text-sm leading-6 text-brand-muted" role="status">
              Perkenalan kedaluwarsa karena tidak dijawab dalam waktu yang
              tersedia.
            </p>
          ) : null}

          {direction === "received" && isPending ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <form action={acceptIntroduction}>
                <input type="hidden" name="requestId" value={item.request_id} />
                <button
                  type="submit"
                  className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white transition-colors hover:bg-[#003FBA] motion-reduce:transition-none"
                >
                  Terima perkenalan
                </button>
              </form>
              <form action={declineIntroduction}>
                <input type="hidden" name="requestId" value={item.request_id} />
                <button
                  type="submit"
                  className="focus-ring inline-flex min-h-11 items-center rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy"
                >
                  Tolak
                </button>
              </form>
              <form action={blockFromIntroduction}>
                <input type="hidden" name="alias" value={item.counterpart_alias} />
                <button
                  type="submit"
                  className="focus-ring inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-brand-muted hover:bg-brand-surface"
                >
                  Blokir
                </button>
              </form>
            </div>
          ) : null}

          {direction === "sent" && isPending ? (
            <form action={cancelIntroduction} className="mt-5">
              <input type="hidden" name="requestId" value={item.request_id} />
              <button
                type="submit"
                className="focus-ring inline-flex min-h-11 items-center rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy"
              >
                Batalkan
              </button>
            </form>
          ) : null}

          <details className="mt-5 rounded-xl border border-brand-border bg-brand-surface/60 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-brand-navy">
              Laporkan
            </summary>
            <form action={reportFromIntroduction} className="mt-4 space-y-3">
              <input type="hidden" name="requestId" value={item.request_id} />
              <div>
                <label
                  htmlFor={reportReasonId}
                  className="text-sm font-medium text-brand-navy"
                >
                  Alasan
                </label>
                <select
                  id={reportReasonId}
                  name="reasonCode"
                  required
                  className="focus-ring mt-1.5 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm"
                >
                  {REPORT_REASON_CODES.map((code) => (
                    <option key={code} value={code}>
                      {REPORT_REASON_LABELS[code]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor={reportDetailsId}
                  className="text-sm font-medium text-brand-navy"
                >
                  Keterangan singkat (opsional)
                </label>
                <textarea
                  id={reportDetailsId}
                  name="details"
                  rows={3}
                  maxLength={300}
                  className="focus-ring mt-1.5 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm"
                />
              </div>
              <button
                type="submit"
                className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white"
              >
                Kirim laporan
              </button>
            </form>
          </details>
        </div>
      </div>
    </article>
  );
}
