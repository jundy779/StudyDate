import Link from "next/link";
import { ResponsiveNavigation } from "@/components/navigation/responsive-navigation";
import {
  getMyStudentAccess,
  SCHOOL_HIDDEN_NAV_KEYS,
} from "@/lib/account/student-access";
import { countPendingReceivedIntroductions } from "@/lib/introductions/service";
import { countUnreadConversations } from "@/lib/messages/service";
import { countUnreadNotifications } from "@/lib/notifications/service";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  current:
    | "home"
    | "people"
    | "circles"
    | "events"
    | "introductions"
    | "messages"
    | "notifications"
    | "verification"
    | "profile"
    | "settings"
    | "privacy-safety"
    | "membership";
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
  const [pending, unread, notifications, access] = await Promise.all([
    pendingIntroductions !== undefined
      ? Promise.resolve(pendingIntroductions)
      : countPendingReceivedIntroductions(),
    unreadMessages !== undefined
      ? Promise.resolve(unreadMessages)
      : countUnreadConversations(),
    unreadNotifications !== undefined
      ? Promise.resolve(unreadNotifications)
      : countUnreadNotifications(),
    getMyStudentAccess(),
  ]);

  const isSchool = access?.tier === "school";
  const needsVerification =
    access?.tier === "student" &&
    access.verificationRequired &&
    access.verificationStatus !== "verified" &&
    current !== "verification";

  return (
    <ResponsiveNavigation
      variant="student"
      current={current}
      pendingIntroductions={pending}
      unreadMessages={unread}
      unreadNotifications={notifications}
      hiddenItemKeys={isSchool ? [...SCHOOL_HIDDEN_NAV_KEYS] : []}
    >
      {needsVerification ? (
        <div
          role="status"
          className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:px-6"
        >
          <p className="mx-auto max-w-5xl">
            {access?.verificationStatus === "pending"
              ? "Verifikasimu sedang diperiksa. Cari Teman, Circle, Pesan, dan Acara terbuka setelah verifikasi selesai."
              : "Selesaikan verifikasi mahasiswa lewat PDDikti untuk memakai Cari Teman, Circle, Pesan, dan Acara."}{" "}
            {access?.verificationStatus === "pending" ? null : (
              <Link href="/app/verification" className="font-semibold underline">
                Mulai verifikasi
              </Link>
            )}
          </p>
        </div>
      ) : null}
      {children}
    </ResponsiveNavigation>
  );
}
