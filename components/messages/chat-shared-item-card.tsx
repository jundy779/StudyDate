"use client";

import {
  CHAT_SHARE_KIND_LABELS,
  getChatShareHref,
  getChatShareMetaLabel,
  type ChatShareKind,
} from "@/lib/messages/shares";
import { ArrowUpRight, CalendarDays, UsersRound } from "lucide-react";
import Link from "next/link";

type ChatSharedItemCardProps = {
  item: {
    share_kind: ChatShareKind;
    share_public_slug: string;
    share_title: string;
    share_description: string;
    share_meta: string;
    share_starts_at: string | null;
    share_timezone_name: string | null;
  };
};

function formatEventDate(value: string | null, timezoneName: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezoneName ?? "Asia/Jakarta",
  }).format(new Date(value));
}

export function ChatSharedItemCard({ item }: ChatSharedItemCardProps) {
  const href = getChatShareHref(item.share_kind, item.share_public_slug);
  const eventDate =
    item.share_kind === "event"
      ? formatEventDate(item.share_starts_at, item.share_timezone_name)
      : null;
  const Icon = item.share_kind === "event" ? CalendarDays : UsersRound;

  return (
    <div className="w-[min(19rem,calc(100vw-4.5rem))] overflow-hidden rounded-xl bg-white text-brand-navy">
      <div className="border-b border-brand-border bg-brand-surface px-3 py-2">
        <p className="flex items-center gap-2 text-xs font-semibold text-brand-blue">
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          Ajakan {CHAT_SHARE_KIND_LABELS[item.share_kind]}
        </p>
      </div>
      <div className="space-y-2 px-3 py-3">
        <h2 className="break-words text-sm font-semibold leading-5">
          {item.share_title}
        </h2>
        <p className="line-clamp-2 text-xs leading-5 text-brand-muted">
          {item.share_description}
        </p>
        <p className="break-words text-xs font-medium text-brand-muted">
          {eventDate ? `${eventDate} · ` : ""}
          {getChatShareMetaLabel(item)}
        </p>
        {href ? (
          <Link
            href={href}
            className="focus-ring inline-flex min-h-9 items-center gap-1 rounded-lg text-xs font-semibold text-brand-blue"
          >
            {item.share_kind === "event" ? "Lihat acara" : "Lihat Circle"}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <p className="text-xs text-brand-muted">
            Detail sudah tidak tersedia.
          </p>
        )}
      </div>
    </div>
  );
}
