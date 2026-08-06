import Link from "next/link";
import { CONVERSATION_STATUS_LABELS } from "@/lib/messages/constants";
import type { ConversationListItem as ConversationItem } from "@/lib/messages/service";
import { getMascotForAlias } from "@/lib/people/constants";
import { BadgeCheck } from "lucide-react";
import Image from "next/image";

function formatActivity(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ConversationListItem({ item }: { item: ConversationItem }) {
  const preview =
    item.preview_body?.trim() ||
    (item.status === "awaiting_chat"
      ? "Perkenalan sudah diterima. Mulai percakapan dengan santai."
      : "Belum ada pesan.");

  return (
    <article className="overflow-hidden rounded-[22px] border border-brand-border bg-white shadow-[0_12px_36px_rgba(15,27,51,0.05)]">
      <Link
        href={`/app/messages/${item.public_id}`}
        className="focus-ring flex gap-4 p-5 sm:p-6"
      >
        <div className="flex h-16 w-16 shrink-0 items-end justify-center overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_20%,#ffffff_0%,#edf4ff_55%,#dfeaff_100%)]">
          <Image
            src={getMascotForAlias(item.counterpart_alias)}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 object-contain object-bottom"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-lg font-semibold text-brand-navy">
              {item.counterpart_alias}
            </h2>
            {item.is_verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-surface px-2 py-0.5 text-xs font-semibold text-brand-blue">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Terverifikasi
              </span>
            ) : null}
            <span className="rounded-full bg-brand-surface px-2.5 py-0.5 text-xs font-semibold text-brand-muted">
              {CONVERSATION_STATUS_LABELS[item.status]}
            </span>
            {item.unread_count > 0 ? (
              <span className="rounded-full bg-brand-blue px-2 py-0.5 text-xs font-semibold text-white">
                {item.unread_count}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-brand-muted">
            {item.study_program} · {item.campus}
            {item.semester ? ` · Semester ${item.semester}` : ""}
          </p>
          <p className="mt-3 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-6 text-brand-navy">
            {preview}
          </p>
          <p className="mt-2 text-xs text-brand-muted">
            {formatActivity(item.last_activity_at)}
          </p>
        </div>
      </Link>
    </article>
  );
}
