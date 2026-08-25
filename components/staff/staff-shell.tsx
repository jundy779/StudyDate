import { ResponsiveNavigation } from "@/components/navigation/responsive-navigation";
import type { StaffAccess, StaffRole } from "@/lib/staff/authorization";
import type { ReactNode } from "react";

type StaffShellProps = {
  children: ReactNode;
  current:
    | "overview"
    | "staff"
    | "verification"
    | "audit"
    | "moderation"
    | "campuses"
    | "study-programs"
    | "early-access"
    | "users"
    | "memberships"
    | "events";
  role: StaffRole;
  access?: Pick<
    StaffAccess,
    "canEarlyAccessRead" | "canEarlyAccessReview" | "canUsersRead" | "canUsersSupport" | "verificationReviewer"
  >;
};

export function StaffShell({ children, current, role, access }: StaffShellProps) {
  return (
    <ResponsiveNavigation
      variant="staff"
      current={current}
      role={role}
      staffCapabilities={access}
    >
      {children}
    </ResponsiveNavigation>
  );
}
