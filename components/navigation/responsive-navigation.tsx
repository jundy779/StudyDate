"use client";

import { signOut } from "@/app/app/actions";
import { staffSignOut } from "@/app/staff/actions";
import { NotificationBell } from "@/components/notifications/notification-bell";
import type { StaffRole } from "@/lib/staff/authorization";
import {
  Activity,
  Bell,
  BookOpen,
  CalendarDays,
  CircleUserRound,
  Gavel,
  GraduationCap,
  Handshake,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MessageSquare,
  ScrollText,
  Shield,
  ShieldCheck,
  Settings,
  UserCog,
  Sparkles,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type NavigationVariant = "student" | "staff";
type NavigationIcon =
  | "home"
  | "people"
  | "circles"
  | "events"
  | "introductions"
  | "messages"
  | "notifications"
  | "verification"
  | "overview"
  | "staff"
  | "audit"
  | "readiness"
  | "moderation"
  | "campuses"
  | "study-programs"
  | "early-access"
  | "users"
  | "profile"
  | "settings"
  | "help"
  | "privacy-safety"
  | "membership"
  | "memberships";

type NavigationItem = {
  href: string;
  label: string;
  key: string;
  icon: NavigationIcon;
  badge?: number;
};

type StaffNavCapabilities = {
  canEarlyAccessRead?: boolean;
  canUsersRead?: boolean;
  canUsersSupport?: boolean;
  verificationReviewer?: boolean;
};

type ResponsiveNavigationProps = {
  children: ReactNode;
  current: string;
  variant: NavigationVariant;
  role?: StaffRole;
  staffCapabilities?: StaffNavCapabilities;
  pendingIntroductions?: number;
  unreadMessages?: number;
  unreadNotifications?: number;
};

const iconMap = {
  home: Home,
  people: Users,
  circles: UsersRound,
  events: CalendarDays,
  introductions: Handshake,
  messages: MessageSquare,
  notifications: Bell,
  verification: ShieldCheck,
  overview: LayoutDashboard,
  staff: UserCog,
  audit: ScrollText,
  readiness: Activity,
  moderation: Gavel,
  campuses: GraduationCap,
  "study-programs": BookOpen,
  "early-access": ScrollText,
  users: Users,
  profile: CircleUserRound,
  settings: Settings,
  help: LifeBuoy,
  "privacy-safety": Shield,
  membership: Sparkles,
  memberships: Sparkles,
} as const;

const studentItems: NavigationItem[] = [
  { href: "/app", label: "Beranda", key: "home", icon: "home" },
  { href: "/app/people", label: "People", key: "people", icon: "people" },
  {
    href: "/app/circles",
    label: "Study Circle",
    key: "circles",
    icon: "circles",
  },
  {
    href: "/app/events",
    label: "Campus Events",
    key: "events",
    icon: "events",
  },
  {
    href: "/app/introductions",
    label: "Perkenalan",
    key: "introductions",
    icon: "introductions",
  },
  {
    href: "/app/messages",
    label: "Pesan",
    key: "messages",
    icon: "messages",
  },
  {
    href: "/app/notifications",
    label: "Notifikasi",
    key: "notifications",
    icon: "notifications",
  },
  {
    href: "/app/verification",
    label: "Verifikasi",
    key: "verification",
    icon: "verification",
  },
  {
    href: "/app/settings",
    label: "Pengaturan",
    key: "settings",
    icon: "settings",
  },
];

const studentAccountItems: NavigationItem[] = [
  {
    href: "/app/membership",
    label: "StudyDate Plus",
    key: "membership",
    icon: "membership",
  },
  { href: "/help", label: "Bantuan", key: "help", icon: "help" },
  {
    href: "/app/account/privacy",
    label: "Privasi & keamanan",
    key: "privacy-safety",
    icon: "privacy-safety",
  },
];

function getStaffItems(
  role: StaffRole,
  capabilities?: StaffNavCapabilities,
): NavigationItem[] {
  const canEarlyAccess =
    role === "owner" || capabilities?.canEarlyAccessRead === true;
  const canUsers =
    role === "owner" ||
    capabilities?.canUsersRead === true ||
    capabilities?.canUsersSupport === true;
  const canVerification =
    role === "owner" || capabilities?.verificationReviewer === true;

  if (role === "admin") {
    const items: NavigationItem[] = [
      {
        href: "/admin",
        label: "Ringkasan",
        key: "overview",
        icon: "overview",
      },
    ];
    if (canEarlyAccess) {
      items.push({
        href: "/staff/early-access",
        label: "Akses Awal",
        key: "early-access",
        icon: "early-access",
      });
    }
    if (canUsers) {
      items.push({
        href: "/staff/users",
        label: "Akun pengguna",
        key: "users",
        icon: "users",
      });
    }
    if (canVerification) {
      items.push({
        href: "/admin/verifications",
        label: "Verifikasi",
        key: "verification",
        icon: "verification",
      });
    }
    items.push(
      {
        href: "/admin/campuses",
        label: "Kampus",
        key: "campuses",
        icon: "campuses",
      },
      {
        href: "/admin/study-programs",
        label: "Jurusan",
        key: "study-programs",
        icon: "study-programs",
      },
    );
    return items;
  }

  return [
    { href: "/owner", label: "Ringkasan", key: "overview", icon: "overview" },
    { href: "/owner/staff", label: "Staff", key: "staff", icon: "staff" },
    {
      href: "/owner/memberships",
      label: "Paket & pembayaran",
      key: "memberships",
      icon: "memberships",
    },
    {
      href: "/staff/early-access",
      label: "Akses Awal",
      key: "early-access",
      icon: "early-access",
    },
    {
      href: "/staff/users",
      label: "Akun mahasiswa",
      key: "users",
      icon: "users",
    },
    {
      href: "/admin/verifications",
      label: "Verifikasi",
      key: "verification",
      icon: "verification",
    },
    {
      href: "/owner/campuses",
      label: "Kampus",
      key: "campuses",
      icon: "campuses",
    },
    {
      href: "/owner/study-programs",
      label: "Jurusan",
      key: "study-programs",
      icon: "study-programs",
    },
    { href: "/owner/audit", label: "Riwayat akses", key: "audit", icon: "audit" },
    {
      href: "/owner#system-readiness",
      label: "Kesiapan sistem",
      key: "readiness",
      icon: "readiness",
    },
    {
      href: "/owner/moderation",
      label: "Moderasi",
      key: "moderation",
      icon: "moderation",
    },
  ];
}

function NavigationLinks({
  current,
  items,
  compact = false,
  onNavigate,
  ariaLabel = "Navigasi utama",
  sectionLabel,
}: {
  current: string;
  items: NavigationItem[];
  compact?: boolean;
  onNavigate?: () => void;
  ariaLabel?: string;
  sectionLabel?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="space-y-1.5">
      {sectionLabel && !compact ? (
        <p className="px-3.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted">
          {sectionLabel}
        </p>
      ) : null}
      {items.map((item) => {
        const Icon = iconMap[item.icon];
        const active = current === item.key;
        return (
          <Link
            key={`${item.key}-${item.href}`}
            href={item.href}
            title={compact ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={`focus-ring group flex min-h-12 items-center rounded-xl text-sm font-semibold transition-colors ${
              compact ? "justify-center px-3" : "gap-3 px-3.5"
            } ${
              active
                ? "bg-brand-blue text-white"
                : "text-brand-muted hover:bg-brand-surface hover:text-brand-navy"
            }`}
          >
            <Icon
              aria-hidden="true"
              className={`h-5 w-5 shrink-0 ${
                active ? "text-white" : "text-brand-muted group-hover:text-brand-blue"
              }`}
            />
            <span className={compact ? "sr-only" : "flex-1"}>{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  compact
                    ? "sr-only"
                    : active
                      ? "bg-white/20 text-white"
                      : "bg-brand-blue text-white"
                }`}
              >
                <span aria-hidden="true">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
                <span className="sr-only">
                  {item.badge} belum dibaca
                </span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function StudentNavigation({
  current,
  items,
  accountItems,
  compact = false,
  onNavigate,
}: {
  current: string;
  items: NavigationItem[];
  accountItems: NavigationItem[];
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-6">
      <NavigationLinks
        current={current}
        items={items}
        compact={compact}
        onNavigate={onNavigate}
        ariaLabel="Navigasi utama"
      />
      <NavigationLinks
        current={current}
        items={accountItems}
        compact={compact}
        onNavigate={onNavigate}
        ariaLabel="Akun"
        sectionLabel="Akun"
      />
    </div>
  );
}

function SignOutButton({ compact, variant }: { compact?: boolean; variant: NavigationVariant }) {
  const action = variant === "staff" ? staffSignOut : signOut;
  return (
    <form action={action}>
      <button
        type="submit"
        title={compact ? "Keluar" : undefined}
        className={`focus-ring flex min-h-12 w-full items-center rounded-xl border border-brand-border text-sm font-semibold text-brand-navy transition-colors hover:border-brand-blue hover:text-brand-blue ${
          compact ? "justify-center px-3" : "gap-3 px-3.5"
        }`}
      >
        <LogOut aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span className={compact ? "sr-only" : undefined}>Keluar</span>
      </button>
    </form>
  );
}

export function ResponsiveNavigation({
  children,
  current,
  variant,
  role,
  staffCapabilities,
  pendingIntroductions = 0,
  unreadMessages = 0,
  unreadNotifications = 0,
}: ResponsiveNavigationProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [liveUnreadNotifications, setLiveUnreadNotifications] =
    useState(unreadNotifications);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLElement>(null);
  const isStaff = variant === "staff" && Boolean(role);
  const items = isStaff
    ? getStaffItems(role as StaffRole, staffCapabilities)
    : studentItems.map((item) => {
        if (item.key === "introductions" && pendingIntroductions > 0) {
          return { ...item, badge: pendingIntroductions };
        }
        if (item.key === "messages" && unreadMessages > 0) {
          return { ...item, badge: unreadMessages };
        }
        if (item.key === "notifications" && liveUnreadNotifications > 0) {
          return { ...item, badge: liveUnreadNotifications };
        }
        return item;
      });
  const accountItems = isStaff ? [] : studentAccountItems;
  const homeHref =
    variant === "staff"
      ? role === "owner"
        ? "/owner"
        : "/admin"
      : "/app";
  const areaLabel =
    variant === "staff"
      ? role === "owner"
        ? "Ruang operasional Owner"
        : "Ruang operasional Admin"
      : "Ruang mahasiswa";

  useEffect(() => {
    setLiveUnreadNotifications(unreadNotifications);
  }, [unreadNotifications]);

  useEffect(() => {
    if (!mobileOpen) return;
    const trigger = mobileTriggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = mobilePanelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeys);
    return () => {
      window.removeEventListener("keydown", handleDialogKeys);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-svh bg-brand-surface md:grid md:grid-cols-[88px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-svh flex-col border-r border-brand-border bg-white md:flex">
        <div className="flex h-24 items-center justify-center border-b border-brand-border px-4 lg:justify-start lg:px-6">
          <Link href={homeHref} className="focus-ring rounded-lg" aria-label="StudyDate ID">
            <Image
              src="/brand/symbol-blue.png"
              alt=""
              width={42}
              height={42}
              className="h-10 w-10 object-contain lg:hidden"
            />
            <Image
              src="/brand/logo-horizontal-color.png"
              alt="StudyDate ID"
              width={176}
              height={42}
              className="hidden h-auto w-[158px] lg:block"
            />
          </Link>
        </div>

        <div className="app-sidebar-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-5 lg:px-4">
          <div className="mb-5 hidden px-3 lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted">
              {areaLabel}
            </p>
          </div>
          <div className="md:hidden lg:block">
            {isStaff ? (
              <NavigationLinks current={current} items={items} />
            ) : (
              <StudentNavigation
                current={current}
                items={items}
                accountItems={accountItems}
              />
            )}
          </div>
          <div className="lg:hidden">
            {isStaff ? (
              <NavigationLinks current={current} items={items} compact />
            ) : (
              <StudentNavigation
                current={current}
                items={items}
                accountItems={accountItems}
                compact
              />
            )}
          </div>
          <div className="mt-auto pt-6">
            <div className="md:hidden lg:block">
              <SignOutButton variant={variant} />
            </div>
            <div className="lg:hidden">
              <SignOutButton variant={variant} compact />
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-brand-border bg-white/95 px-4 backdrop-blur md:hidden sm:px-5">
          <Link href={homeHref} className="focus-ring rounded-lg" aria-label="StudyDate ID">
            <Image
              src="/brand/logo-horizontal-color.png"
              alt="StudyDate ID"
              width={156}
              height={38}
              className="h-auto w-[142px]"
              priority
            />
          </Link>
          <div className="flex items-center gap-2">
            {!isStaff ? (
              <Link
                href="/app/notifications"
                aria-label={
                  liveUnreadNotifications > 0
                    ? `Notifikasi, ${liveUnreadNotifications} belum dibaca`
                    : "Notifikasi, tidak ada yang belum dibaca"
                }
                className="focus-ring relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-brand-border bg-white text-brand-navy"
              >
                <Bell aria-hidden="true" className="h-5 w-5" />
                {liveUnreadNotifications > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand-blue px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
                  >
                    {liveUnreadNotifications > 99
                      ? "99+"
                      : liveUnreadNotifications}
                  </span>
                ) : null}
              </Link>
            ) : null}
            <button
              ref={mobileTriggerRef}
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-app-navigation"
              aria-label="Buka menu navigasi"
              className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-xl border border-brand-border text-brand-navy"
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </header>

        {!isStaff ? (
          <div className="fixed right-6 top-6 z-40 hidden md:block">
            <NotificationBell
              initialUnreadCount={liveUnreadNotifications}
              onUnreadCountChange={setLiveUnreadNotifications}
            />
          </div>
        ) : null}

        {children}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Tutup menu navigasi"
            tabIndex={-1}
            className="animate-in fade-in absolute inset-0 bg-brand-navy/45 duration-200"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            ref={mobilePanelRef}
            id="mobile-app-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Menu navigasi"
            className="animate-in slide-in-from-right-8 absolute inset-y-0 right-0 flex w-[min(88vw,340px)] flex-col bg-white shadow-[-24px_0_60px_rgba(15,27,51,0.18)] duration-200"
          >
            <div className="flex min-h-20 items-center justify-between border-b border-brand-border px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">
                  StudyDate ID
                </p>
                <p className="mt-1 text-sm font-semibold text-brand-navy">{areaLabel}</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Tutup menu"
                className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-xl border border-brand-border"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="app-sidebar-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
              {isStaff ? (
                <NavigationLinks
                  current={current}
                  items={items}
                  onNavigate={() => setMobileOpen(false)}
                />
              ) : (
                <StudentNavigation
                  current={current}
                  items={items}
                  accountItems={accountItems}
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              <div className="mt-auto pt-8">
                <SignOutButton variant={variant} />
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
