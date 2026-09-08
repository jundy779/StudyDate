import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const footerGroups = [
  {
    title: "Jelajahi",
    links: [
      { label: "Cari Teman", href: "/#people" },
      { label: "Circle Belajar", href: "/#groups" },
      { label: "Acara Kampus", href: "/#events" },
      { label: "Cara Kerja", href: "/#cara-kerja" },
    ],
  },
  {
    title: "StudyDate",
    links: [
      { label: "Tentang", href: "/about" },
      { label: "Insight", href: "/insight" },
    ],
  },
  {
    title: "Keamanan & bantuan",
    links: [
      { label: "Keamanan", href: "/safety" },
      { label: "Pedoman Komunitas", href: "/community-guidelines" },
      { label: "Bantuan", href: "/help" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privasi", href: "/privacy" },
      { label: "Ketentuan", href: "/terms" },
    ],
  },
] as const;

export function PublicFooter() {
  return (
    <footer className="bg-brand-navy text-white">
      <div className="page-shell">
        <div className="grid gap-12 py-14 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.95fr)] lg:gap-16 lg:py-20">
          <div className="max-w-md">
            <Link
              href="/#beranda"
              aria-label="StudyDate ID, kembali ke beranda"
              className="focus-ring inline-flex rounded-[12px]"
            >
              <Image
                src="/brand/logo-horizontal-white.png"
                alt="StudyDate ID"
                width={718}
                height={160}
                sizes="180px"
                className="h-auto w-[180px]"
              />
            </Link>
            <p className="mt-7 font-heading text-2xl font-semibold leading-tight tracking-[-0.025em] sm:text-3xl">
              Ketemu lewat hal yang sama.
            </p>
            <p className="mt-4 max-w-sm text-sm leading-7 text-white/65">
              Temukan teman, circle, dan acara kampus. Kenalan tanpa harus
              langsung membuka nama atau kontak pribadi.
            </p>
            <Link
              href="/#mulai"
              className="focus-ring mt-7 inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-white px-5 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-surface"
            >
              Ikut Akses Awal
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>

          <nav
            aria-label="Navigasi footer"
            className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4"
          >
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h2 className="text-sm font-semibold text-white">{group.title}</h2>
                <ul className="mt-5 space-y-3.5">
                  {group.links.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="focus-ring inline-flex text-sm leading-6 text-white/60 transition-colors hover:text-white"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/15 py-6 text-xs leading-5 text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 StudyDate ID. Hak cipta dilindungi.</p>
          <p>Untuk mahasiswa dan alumni Indonesia.</p>
        </div>
      </div>
    </footer>
  );
}
