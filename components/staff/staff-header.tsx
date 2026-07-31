import { staffSignOut } from "@/app/staff/actions";
import type { StaffRole } from "@/lib/staff/authorization";
import Image from "next/image";
import Link from "next/link";

type StaffHeaderProps = {
  role: StaffRole;
  current: "overview" | "staff" | "verification" | "audit";
};

export function StaffHeader({ role, current }: StaffHeaderProps) {
  const items = role === "owner"
    ? [
        { href: "/owner", label: "Overview", key: "overview" },
        { href: "/owner/staff", label: "Staff", key: "staff" },
        { href: "/admin/verifications", label: "Verification", key: "verification" },
        { href: "/owner/audit", label: "Audit", key: "audit" },
      ] as const
    : [{ href: "/admin/verifications", label: "Verification", key: "verification" }] as const;

  return (
    <header className="border-b border-brand-border bg-white">
      <div className="page-shell flex min-h-20 flex-wrap items-center justify-between gap-4 py-3">
        <Link href={role === "owner" ? "/owner" : "/admin/verifications"} className="focus-ring rounded-lg" aria-label="StudyDate Staff">
          <Image src="/brand/logo-horizontal-color.png" alt="StudyDate ID" width={160} height={38} className="h-auto w-[145px]" priority />
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <nav aria-label="Navigasi staff" className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {items.map((item) => <Link key={item.key} href={item.href} aria-current={current === item.key ? "page" : undefined} className={`focus-ring min-h-11 shrink-0 rounded-xl px-3 py-3 text-sm font-semibold ${current === item.key ? "bg-brand-surface text-brand-blue" : "text-brand-muted"}`}>{item.label}</Link>)}
          </nav>
          <form action={staffSignOut}><button type="submit" className="focus-ring min-h-11 rounded-xl border border-brand-border px-4 text-sm font-semibold">Keluar</button></form>
        </div>
      </div>
    </header>
  );
}
