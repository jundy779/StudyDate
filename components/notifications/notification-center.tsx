"use client";

import { markAllNotificationsReadAction } from "@/app/app/notifications/actions";
import { NotificationItem } from "@/components/notifications/notification-item";
import type { NotificationItem as NotificationItemData } from "@/lib/notifications/constants";
import { Bell, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Cursor = {
  beforeCreatedAt: string;
  beforePublicId: string;
};

export function NotificationCenter({
  initialItems,
  initialNextCursor,
  initialUnreadCount,
}: {
  initialItems: NotificationItemData[];
  initialNextCursor: Cursor | null;
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, startMarkingAll] = useTransition();

  function markAllRead() {
    startMarkingAll(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) {
        setError("Notifikasi belum dapat diperbarui. Coba lagi.");
        return;
      }
      const now = new Date().toISOString();
      setItems((current) =>
        current.map((item) => ({ ...item, readAt: item.readAt ?? now })),
      );
      setUnreadCount(0);
      setError(null);
      router.refresh();
    });
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    const query = new URLSearchParams(nextCursor);

    try {
      const response = await fetch(`/api/notifications?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("unavailable");

      const payload = (await response.json()) as {
        notifications: NotificationItemData[];
        nextCursor: Cursor | null;
        unreadCount: number;
      };
      setItems((current) => {
        const existingIds = new Set(current.map((item) => item.publicId));
        return [
          ...current,
          ...payload.notifications.filter(
            (item) => !existingIds.has(item.publicId),
          ),
        ];
      });
      setNextCursor(payload.nextCursor);
      setUnreadCount(payload.unreadCount);
    } catch {
      setError("Notifikasi berikutnya belum dapat dimuat. Coba lagi.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-brand-border bg-white px-6 py-14 text-center sm:px-10">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-surface text-brand-blue">
          <Bell aria-hidden="true" className="h-6 w-6" />
        </span>
        <h2 className="mt-5 font-heading text-xl font-semibold text-brand-navy">
          Belum ada notifikasi
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-brand-muted">
          Update tentang perkenalan, pesan, dan koneksi kamu akan muncul di
          sini.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Daftar notifikasi"
      className="overflow-hidden rounded-2xl border border-brand-border bg-white"
    >
      <div className="flex min-h-14 items-center justify-between gap-4 border-b border-brand-border px-4 sm:px-5">
        <p className="text-sm text-brand-muted">
          {unreadCount > 0
            ? `${unreadCount} belum dibaca`
            : "Semua sudah dibaca"}
        </p>
        <button
          type="button"
          onClick={markAllRead}
          disabled={markingAll || unreadCount === 0}
          className="focus-ring rounded-lg px-2 py-2 text-sm font-semibold text-brand-blue disabled:text-brand-muted"
        >
          Tandai semua dibaca
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-b border-brand-border bg-red-50 px-5 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <div className="divide-y divide-brand-border px-1 sm:px-2">
        {items.map((item) => (
          <NotificationItem key={item.publicId} item={item} />
        ))}
      </div>

      {nextCursor ? (
        <div className="border-t border-brand-border px-4 py-4 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-border px-5 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-blue hover:text-brand-blue disabled:opacity-60"
          >
            {loadingMore ? (
              <LoaderCircle
                aria-hidden="true"
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {loadingMore ? "Memuat…" : "Muat lebih banyak"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
