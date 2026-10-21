"use client";

import { staffSignOut } from "@/app/staff/actions";
import { MascotHead } from "@/components/brand/mascot-head";
import {
  BookOpen,
  CalendarDays,
  Gavel,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type StaffNavKey =
  | "overview"
  | "early-access"
  | "users"
  | "verification"
  | "moderation"
  | "events"
  | "memberships"
  | "campuses"
  | "study-programs"
  | "contact"
  | "staff"
  | "audit";

export type StaffNavItem = {
  key: StaffNavKey;
  href: string;
  label: string;
  /** Jumlah yang menunggu ditangani. Tidak ditampilkan bila 0 atau tidak diketahui. */
  count?: number | null;
  urgent?: boolean;
};

export type StaffNavGroup = { label: string; items: StaffNavItem[] };

const icons: Record<StaffNavKey, LucideIcon> = {
  overview: LayoutDashboard,
  "early-access": Inbox,
  users: Users,
  verification: ShieldCheck,
  moderation: Gavel,
  events: CalendarDays,
  memberships: Sparkles,
  campuses: GraduationCap,
  "study-programs": BookOpen,
  contact: MessageCircle,
  staff: UserCog,
  audit: ScrollText,
};

function NavList({
  groups,
  current,
  onNavigate,
}: {
  groups: StaffNavGroup[];
  current: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Menu Ruang Operasional" className="grid gap-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 font-hand text-base text-brand-muted">{group.label}</p>
          <ul className="grid gap-1">
            {group.items.map((item) => {
              const Icon = icons[item.key];
              const active = current === item.key;
              const count = item.count ?? 0;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
                      active
                        ? "border-2 border-brand-navy bg-brand-blue text-white shadow-[3px_3px_0_#0F1B33]"
                        : "text-brand-muted hover:bg-brand-surface hover:text-brand-navy"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    {count > 0 ? (
                      <span
                        className={`min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-bold tabular-nums ${
                          active
                            ? "bg-white text-brand-blue"
                            : item.urgent
                              ? "bg-brand-error text-white"
                              : "bg-[#EAF1FF] text-brand-blue"
                        }`}
                      >
                        {count > 99 ? "99+" : count}
                        <span className="sr-only"> menunggu</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function HelpBox({ role }: { role: "owner" | "admin" }) {
  return (
    <div className="relative rounded-2xl bg-brand-surface p-4 pl-[4.5rem] text-sm leading-5 text-brand-muted">
      <span className="absolute bottom-3 left-3 w-12" aria-hidden="true">
        <MascotHead expression="kedip" />
      </span>
      <span className="block font-semibold text-brand-navy">
        {role === "owner" ? "Kamu masuk sebagai Owner" : "Kamu masuk sebagai Admin"}
      </span>
      {role === "owner"
        ? "Semua keputusan tercatat di Riwayat akses."
        : "Menu yang tampil sesuai tugas yang diberikan Owner."}
    </div>
  );
}

function SignOut() {
  return (
    <form action={staffSignOut}>
      <button
        type="submit"
        className="focus-ring flex min-h-11 w-full items-center gap-3 rounded-xl border border-brand-border px-3 text-sm font-semibold text-brand-navy hover:border-brand-navy"
      >
        <LogOut className="h-5 w-5" aria-hidden="true" />
        Keluar
      </button>
    </form>
  );
}

export function StaffFrame({
  role,
  current,
  groups,
  children,
}: {
  role: "owner" | "admin";
  current: string;
  groups: StaffNavGroup[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const homeHref = role === "owner" ? "/owner" : "/admin";
  const roleLabel = role === "owner" ? "Owner" : "Admin";

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="min-h-svh bg-brand-surface lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-svh flex-col border-r-2 border-brand-navy/10 bg-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-brand-border px-5">
          <Link href={homeHref} className="focus-ring rounded-lg" aria-label="Ringkasan Ruang Operasional">
            <Image
              src="/brand/logo-horizontal-color.png"
              alt="StudyDate ID"
              width={150}
              height={36}
              className="h-auto w-[138px]"
            />
          </Link>
          <span className="rounded-full bg-brand-navy px-2.5 py-0.5 text-xs font-semibold text-white">
            {roleLabel}
          </span>
        </div>
        <div className="app-sidebar-scroll flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
          <NavList groups={groups} current={current} />
          <div className="mt-auto grid gap-3">
            <HelpBox role={role} />
            <SignOut />
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-brand-border bg-white/95 px-4 backdrop-blur lg:hidden">
          <Link href={homeHref} className="focus-ring flex items-center gap-2 rounded-lg" aria-label="Ringkasan Ruang Operasional">
            <Image
              src="/brand/logo-horizontal-color.png"
              alt="StudyDate ID"
              width={140}
              height={34}
              className="h-auto w-[128px]"
              priority
            />
            <span className="rounded-full bg-brand-navy px-2 py-0.5 text-[11px] font-semibold text-white">
              {roleLabel}
            </span>
          </Link>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="staff-menu"
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-brand-navy px-3 text-sm font-semibold text-brand-navy"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            Menu
          </button>
        </header>
        {children}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Tutup menu"
            className="absolute inset-0 bg-brand-navy/45"
            onClick={() => setOpen(false)}
          />
          <aside
            id="staff-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu Ruang Operasional"
            className="absolute inset-y-0 left-0 flex w-[min(320px,88vw)] flex-col bg-white shadow-[6px_0_0_#0F1B33]"
          >
            <div className="flex min-h-16 items-center justify-between border-b border-brand-border px-4">
              <span className="font-heading text-lg font-semibold text-brand-navy">Menu {roleLabel}</span>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-xl border border-brand-border"
                aria-label="Tutup menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
              <NavList groups={groups} current={current} onNavigate={() => setOpen(false)} />
              <div className="mt-auto grid gap-3">
                <HelpBox role={role} />
                <SignOut />
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
