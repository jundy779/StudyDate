"use client";

import { NotificationItem } from "@/components/notifications/notification-item";
import type { NotificationItem as NotificationItemData } from "@/lib/notifications/constants";
import { Bell, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 25_000;

export function NotificationBell({
  initialUnreadCount,
  onUnreadCountChange,
}: {
  initialUnreadCount: number;
  onUnreadCountChange?: (count: number) => void;
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [items, setItems] = useState<NotificationItemData[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const requestActive = useRef(false);
  const pendingItemsRequest = useRef(false);
  const previousOpen = useRef(false);

  const fetchNotifications = useCallback(async (withItems: boolean) => {
    if (document.visibilityState === "hidden") return;
    if (requestActive.current) {
      if (withItems) {
        pendingItemsRequest.current = true;
        setLoading(true);
      }
      return;
    }
    requestActive.current = true;
    if (withItems) setLoading(true);

    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("unavailable");
      const payload = (await response.json()) as {
        unreadCount: number;
        notifications: NotificationItemData[];
      };
      setUnreadCount(payload.unreadCount);
      onUnreadCountChange?.(payload.unreadCount);
      if (withItems || pendingItemsRequest.current) {
        setItems(payload.notifications.slice(0, 5));
      }
      setError(false);
    } catch {
      if (withItems || pendingItemsRequest.current) setError(true);
    } finally {
      requestActive.current = false;
      if (withItems || pendingItemsRequest.current) setLoading(false);
      pendingItemsRequest.current = false;
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchNotifications(false);
    }, POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchNotifications(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) {
      if (previousOpen.current) triggerRef.current?.focus();
      previousOpen.current = false;
      return;
    }
    previousOpen.current = true;
    void fetchNotifications(true);
    closeButtonRef.current?.focus();

    const close = (event: KeyboardEvent | MouseEvent) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        setOpen(false);
      } else if (
        event instanceof MouseEvent &&
        !containerRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    window.addEventListener("mousedown", close);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("mousedown", close);
    };
  }, [fetchNotifications, open]);

  const badge = unreadCount > 99 ? "99+" : String(unreadCount);
  const label =
    unreadCount > 0
      ? `Notifikasi, ${unreadCount} belum dibaca`
      : "Notifikasi, tidak ada yang belum dibaca";

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => setOpen((current) => !current)}
        className="focus-ring relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-brand-border bg-white text-brand-navy transition-colors hover:border-brand-blue hover:text-brand-blue"
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand-blue px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
          >
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          id="notification-panel"
          aria-label="Notifikasi terbaru"
          className="absolute right-0 top-[calc(100%+0.75rem)] z-40 hidden w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-brand-border bg-white shadow-[0_24px_70px_rgba(15,27,51,0.18)] md:block"
        >
          <div className="flex min-h-16 items-center justify-between border-b border-brand-border px-4">
            <div>
              <h2 className="font-heading text-base font-semibold text-brand-navy">
                Notifikasi
              </h2>
              <p className="mt-0.5 text-xs text-brand-muted">
                {unreadCount > 0
                  ? `${unreadCount} belum dibaca`
                  : "Semua sudah dibaca"}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Tutup notifikasi"
              onClick={() => setOpen(false)}
              className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-xl text-brand-muted hover:bg-brand-surface hover:text-brand-navy"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[min(60vh,520px)] overflow-y-auto px-1 py-1">
            {loading ? (
              <p
                role="status"
                className="flex min-h-32 items-center justify-center gap-2 text-sm text-brand-muted"
              >
                <LoaderCircle
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin motion-reduce:animate-none"
                />
                Memuat notifikasi…
              </p>
            ) : error ? (
              <div className="px-5 py-8 text-center">
                <p role="alert" className="text-sm text-brand-muted">
                  Notifikasi belum dapat dimuat.
                </p>
                <button
                  type="button"
                  onClick={() => void fetchNotifications(true)}
                  className="focus-ring mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-brand-blue"
                >
                  Coba lagi
                </button>
              </div>
            ) : items.length > 0 ? (
              items.map((item) => (
                <NotificationItem
                  key={item.publicId}
                  item={item}
                  compact
                  onNavigate={() => setOpen(false)}
                />
              ))
            ) : (
              <div className="px-6 py-9 text-center">
                <p className="font-heading text-sm font-semibold text-brand-navy">
                  Belum ada notifikasi
                </p>
                <p className="mt-1 text-sm leading-5 text-brand-muted">
                  Update penting akan muncul di sini.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-brand-border p-3">
            <Link
              href="/app/notifications"
              onClick={() => setOpen(false)}
              className="focus-ring flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-brand-blue hover:bg-brand-surface"
            >
              Lihat semua notifikasi
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
