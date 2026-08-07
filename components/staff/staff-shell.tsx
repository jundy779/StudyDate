import { ResponsiveNavigation } from "@/components/navigation/responsive-navigation";
import type { StaffRole } from "@/lib/staff/authorization";
import type { ReactNode } from "react";

type StaffShellProps = {
  children: ReactNode;
  current: "overview" | "staff" | "verification" | "audit" | "moderation";
  role: StaffRole;
};

export function StaffShell({ children, current, role }: StaffShellProps) {
  return (
    <ResponsiveNavigation variant="staff" current={current} role={role}>
      {children}
    </ResponsiveNavigation>
  );
}
