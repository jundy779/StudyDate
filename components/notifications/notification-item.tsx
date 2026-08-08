"use client";

import { markNotificationReadAction } from "@/app/app/notifications/actions";
import {
  getNotificationCopy,
  type NotificationItem as NotificationItemData,
} from "@/lib/notifications/constants";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function NotificationItem({
  item,
  compact = false,
  onNavigate,
}: {
  item: NotificationItemData;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const copy = getNotificationCopy(item);
  const unread = item.readAt === null;

  function openNotification() {
    setError(null);
    startTransition(async () => {
      if (unread) {
        const formData = new FormData();
        formData.set("notificationPublicId", item.publicId);
        const result = await markNotificationReadAction(formData);
        if (!result.ok) {
          setError("Notifikasi belum dapat dibuka. Coba lagi.");
          return;
        }
      }
      onNavigate?.();
      router.push(item.targetPath);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={openNotification}
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "focus-ring group flex w-full items-start gap-3 rounded-xl px-3 text-left transition-colors hover:bg-brand-surface disabled:opacity-70",
        compact ? "py-3" : "py-4",
        unread && "bg-brand-blue/[0.045]",
      )}
    >
      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-surface text-brand-blue">
        <copy.Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-sm font-semibold leading-5 text-brand-navy">
              {copy.title}
            </span>
            <span
              className={cn(
                "mt-1 block text-sm leading-5 text-brand-muted",
                compact && "line-clamp-2",
              )}
            >
              {copy.description}
            </span>
          </span>
          {unread ? (
            <>
              <span
                aria-hidden="true"
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-blue"
              />
              <span className="sr-only">Belum dibaca</span>
            </>
          ) : null}
        </span>
        <time
          dateTime={item.createdAt}
          className="mt-2 block text-xs font-medium text-brand-muted"
        >
          {dateFormatter.format(new Date(item.createdAt))}
        </time>
        {error ? (
          <span role="alert" className="mt-2 block text-xs font-medium text-red-700">
            {error}
          </span>
        ) : null}
      </span>
    </button>
  );
}
