import { AppShell } from "@/components/app/app-shell";
import { NotificationCenter } from "@/components/notifications/notification-center";
import {
  countUnreadNotifications,
  listNotifications,
} from "@/lib/notifications/service";

export default async function NotificationsPage() {
  const [rows, unreadCount] = await Promise.all([
    listNotifications({ limit: 21 }),
    countUnreadNotifications(),
  ]);
  const hasMore = rows.length > 20;
  const items = rows.slice(0, 20);
  const last = items.at(-1);

  return (
    <AppShell current="notifications" unreadNotifications={unreadCount}>
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell max-w-3xl py-8 sm:py-12 lg:py-16">
          <p className="section-label">Aktivitas penting</p>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl">
            Notifikasi
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-brand-muted sm:text-base">
            Update penting dari koneksi dan aktivitas StudyDate kamu.
          </p>

          <div className="mt-8">
            <NotificationCenter
              initialItems={items}
              initialUnreadCount={unreadCount}
              initialNextCursor={
                hasMore && last
                  ? {
                      beforeCreatedAt: last.createdAt,
                      beforePublicId: last.publicId,
                    }
                  : null
              }
            />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
