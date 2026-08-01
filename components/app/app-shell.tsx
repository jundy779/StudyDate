import { ResponsiveNavigation } from "@/components/navigation/responsive-navigation";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  current: "home" | "people" | "verification";
};

export function AppShell({ children, current }: AppShellProps) {
  return (
    <ResponsiveNavigation variant="student" current={current}>
      {children}
    </ResponsiveNavigation>
  );
}
