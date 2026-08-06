import { ResponsiveNavigation } from "@/components/navigation/responsive-navigation";
import { countPendingReceivedIntroductions } from "@/lib/introductions/service";
import { countUnreadConversations } from "@/lib/messages/service";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  current: "home" | "people" | "introductions" | "messages" | "verification";
  pendingIntroductions?: number;
  unreadMessages?: number;
};

export async function AppShell({
  children,
  current,
  pendingIntroductions,
  unreadMessages,
}: AppShellProps) {
  const [pending, unread] = await Promise.all([
    pendingIntroductions !== undefined
      ? Promise.resolve(pendingIntroductions)
      : countPendingReceivedIntroductions(),
    unreadMessages !== undefined
      ? Promise.resolve(unreadMessages)
      : countUnreadConversations(),
  ]);

  return (
    <ResponsiveNavigation
      variant="student"
      current={current}
      pendingIntroductions={pending}
      unreadMessages={unread}
    >
      {children}
    </ResponsiveNavigation>
  );
}
