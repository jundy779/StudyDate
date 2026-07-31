import { signOut } from "@/app/app/actions";
import Image from "next/image";
import Link from "next/link";

type AppHeaderProps = {
  current: "home" | "people" | "verification";
};

const navItems = [
  { href: "/app", label: "Beranda", key: "home" },
  { href: "/app/people", label: "People", key: "people" },
  { href: "/app/verification", label: "Verifikasi", key: "verification" },
] as const;

export function AppHeader({ current }: AppHeaderProps) {
  return (
    <header className="border-b border-brand-border bg-white">
      <div className="page-shell flex min-h-20 flex-wrap items-center justify-between gap-x-5 gap-y-3 py-3">
        <Link href="/app" className="focus-ring rounded-lg" aria-label="StudyDate ID — Beranda">
          <Image
            src="/brand/logo-horizontal-color.png"
            alt="StudyDate ID"
            width={176}
            height={42}
            className="h-auto w-[142px] sm:w-[160px]"
            priority
          />
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4">
          <nav aria-label="Navigasi aplikasi" className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={current === item.key ? "page" : undefined}
                className={`focus-ring inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-semibold sm:px-4 ${
                  current === item.key
                    ? "bg-brand-surface text-brand-blue"
                    : "text-brand-muted hover:text-brand-navy"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={signOut}>
            <button
              type="submit"
              className="focus-ring min-h-11 rounded-xl border border-brand-border px-3 text-sm font-semibold text-brand-navy hover:border-brand-blue sm:px-4"
            >
              Keluar
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
