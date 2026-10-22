import { AppShell } from "@/components/app/app-shell";
import { AppPage } from "@/components/app/ui";
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
      <AppPage
        kicker="Aktivitas penting"
        title="Notifikasi"
        description="Kabar penting dari perkenalan, Circle, dan acara kamu. Isi pesan tidak pernah ditampilkan di sini."
        mascot={unreadCount > 0 ? "penasaran" : "girang"}
      >
        <div className="max-w-3xl">
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
      </AppPage>
    </AppShell>
  );
}
