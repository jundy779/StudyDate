import { ArrowRight } from "lucide-react";
import { MascotHead } from "@/components/brand/mascot-head";
import { stickerButton } from "@/components/marketing/brand-ui";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { SocialIcon } from "@/components/brand/social-icon";
import { getPublicContactLinks } from "@/lib/marketing/contact-links";
import { CONTACT_LINK_META } from "@/lib/marketing/contact-links-config";

const footerGroups = [
  {
    title: "Jelajahi",
    links: [
      { label: "Cari Teman", href: "/#people" },
      { label: "Circle Belajar", href: "/#groups" },
      { label: "Acara Kampus", href: "/events" },
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

async function FooterContactLinks() {
  const links = await getPublicContactLinks().catch(() => []);
  if (!links.length) return null;

  return (
    <div className="mt-8">
      <p className="font-hand text-lg text-[#8DB9F6]">Ikuti dan hubungi kami</p>
      <ul className="mt-3 flex flex-wrap gap-2.5" aria-label="Media sosial dan kontak StudyDate">
        {links.map((link) => {
          const label = CONTACT_LINK_META[link.kind].label;
          const external = link.kind !== "email";
          return (
            <li key={link.kind}>
              <a
                href={link.url}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 text-white/80 transition-colors hover:border-white hover:bg-white hover:text-brand-navy"
                aria-label={`${label} StudyDate${external ? " (tab baru)" : ""}`}
                title={label}
              >
                <SocialIcon kind={link.kind} />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer id="footer" className="relative mt-auto bg-brand-navy text-white">
      <svg
        className="wave-edge absolute inset-x-0 -top-[clamp(27px,5vw,63px)]"
        viewBox="0 0 1440 64"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 32 C120 8 240 8 360 32 S600 56 720 32 960 8 1080 32 1320 56 1440 32 V64 H0 Z"
          fill="#0F1B33"
        />
      </svg>

      <div className="page-shell relative">
        <div className="grid gap-12 pb-12 pt-14 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20 lg:pb-16 lg:pt-20">
          <div className="relative max-w-xl">
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
                sizes="170px"
                className="h-auto w-[170px]"
              />
            </Link>
            <p className="mt-8 text-balance font-heading text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] sm:text-[2.1rem]">
              Ketemu lewat hal yang sama.
              <br />
              Lanjut kalau sama-sama nyaman.
            </p>
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/65">
              Temukan teman, circle, dan acara kampus. Kenalan tanpa harus langsung
              membuka nama atau kontak pribadi.
            </p>
            <Link href="/#mulai" className={`${stickerButton} mt-8 bg-white text-brand-navy !border-white !shadow-[4px_4px_0_#014FE7]`}>
              Ikut Akses Awal
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
            <Suspense fallback={null}>
              <FooterContactLinks />
            </Suspense>
          </div>

          <nav
            aria-label="Navigasi footer"
            className="grid grid-cols-2 gap-x-6 gap-y-10 self-center sm:grid-cols-4 lg:gap-x-8"
          >
            {footerGroups.map((group) => (
              <div key={group.title} className="min-w-0">
                <h2 className="font-hand text-lg text-[#8DB9F6]">{group.title}</h2>
                <ul className="mt-4 space-y-3">
                  {group.links.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="focus-ring inline-flex rounded-sm text-sm leading-6 text-white/75 underline-offset-4 transition-colors hover:text-white hover:underline"
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

        <div className="flex flex-col gap-4 border-t border-white/15 py-6 text-xs leading-5 text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 StudyDate ID. Hak cipta dilindungi. Untuk mahasiswa dan alumni Indonesia.</p>
          <p className="flex items-center gap-3">
            <span className="font-hand text-base text-white/70">Sampai ketemu di kampus.</span>
            <span className="w-9 shrink-0" aria-hidden="true">
              <MascotHead expression="kedip" />
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
