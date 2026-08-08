import { ResponsiveNavigation } from "@/components/navigation/responsive-navigation";
import { countPendingReceivedIntroductions } from "@/lib/introductions/service";
import { countUnreadConversations } from "@/lib/messages/service";
import { countUnreadNotifications } from "@/lib/notifications/service";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  current:
    | "home"
    | "people"
    | "introductions"
    | "messages"
    | "notifications"
    | "verification"
    | "profile"
    | "privacy-safety";
  pendingIntroductions?: number;
  unreadMessages?: number;
  unreadNotifications?: number;
};

export async function AppShell({
  children,
  current,
  pendingIntroductions,
  unreadMessages,
  unreadNotifications,
}: AppShellProps) {
  const [pending, unread, notifications] = await Promise.all([
    pendingIntroductions !== undefined
      ? Promise.resolve(pendingIntroductions)
      : countPendingReceivedIntroductions(),
    unreadMessages !== undefined
      ? Promise.resolve(unreadMessages)
      : countUnreadConversations(),
    unreadNotifications !== undefined
      ? Promise.resolve(unreadNotifications)
      : countUnreadNotifications(),
  ]);

  return (
    <ResponsiveNavigation
      variant="student"
      current={current}
      pendingIntroductions={pending}
      unreadMessages={unread}
      unreadNotifications={notifications}
    >
      {children}
    </ResponsiveNavigation>
  );
}
