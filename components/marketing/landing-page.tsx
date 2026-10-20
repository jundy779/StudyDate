import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  MapPin,
  Ticket,
  Users,
} from "lucide-react";
import {
  EarlyAccessProvider,
  EarlyAccessTrigger,
} from "@/components/marketing/early-access-dialog";
import { MascotHead } from "@/components/brand/mascot-head";
import { stickerButton, WaveEdge } from "@/components/marketing/brand-ui";
import { MascotBuddy } from "@/components/marketing/mascot-buddy";
import { MobileNav } from "@/components/marketing/mobile-nav";
import { PillarOrbit } from "@/components/marketing/pillar-orbit";
import { PrivacyReveal } from "@/components/marketing/privacy-reveal";
import { TiltCard } from "@/components/marketing/tilt-card";
import { PublicFooter } from "@/components/marketing/public-footer";

const navigation = [
  { label: "Cari Teman", href: "/#people" },
  { label: "Circle Belajar", href: "/#groups" },
  { label: "Acara Kampus", href: "/events" },
  { label: "Cara Kerja", href: "/#cara-kerja" },
  { label: "Tentang", href: "/about" },
  { label: "Keamanan", href: "/safety" },
];

type BrandAssetPath =
  | "/brand/symbol-blue.png"
  | "/brand/app-icon.png"
  | "/brand/logo-horizontal-color.png"
  | "/brand/logo-horizontal-white.png"
  | "/brand/mascot/chat.png"
  | "/brand/mascot/chat-1024.png"
  | "/brand/mascot/front.png"
  | "/brand/mascot/front-1024.png"
  | "/brand/mascot/front-cropped.png"
  | "/brand/mascot/hello.png"
  | "/brand/mascot/hello-1024.png"
  | "/brand/mascot/study.png"
  | "/brand/mascot/study-1024.png"
  | "/brand/mascot/avatar.png";

function assetExists(src: string) {
  return existsSync(join(process.cwd(), "public", src.replace(/^\//, "")));
}

function BrandAsset({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  inverted = false,
  sizes,
}: {
  src: BrandAssetPath;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  inverted?: boolean;
  sizes?: string;
}) {
  if (!assetExists(src)) {
    return (
      <span
        className={`asset-placeholder ${inverted ? "asset-placeholder-dark" : ""} ${className ?? ""}`}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        data-missing-asset={src}
      >
        {alt ? "Aset brand" : ""}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      priority={priority}
    />
  );
}

function BrandLogo({
  inverted = false,
  priority = false,
}: {
  inverted?: boolean;
  priority?: boolean;
}) {
  const horizontalSrc = inverted
    ? "/brand/logo-horizontal-white.png"
    : "/brand/logo-horizontal-color.png";

  if (assetExists(horizontalSrc)) {
    return (
      <span className="brand-logo-slot">
        <BrandAsset
          src={horizontalSrc}
          alt="StudyDate ID"
          width={718}
          height={160}
          sizes="160px"
          className="h-full w-full object-contain object-left"
          priority={priority}
          inverted={inverted}
        />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-3">
      <BrandAsset
        src={inverted ? "/brand/app-icon.png" : "/brand/symbol-blue.png"}
        alt=""
        width={48}
        height={48}
        className="h-10 w-10 rounded-[12px] object-cover"
        priority={priority}
        inverted={inverted}
      />
      <span
        className={`font-heading text-xl font-semibold tracking-[-0.025em] ${
          inverted ? "text-white" : "text-brand-navy"
        }`}
      >
        StudyDate ID
      </span>
    </span>
  );
}

export function PublicNavbar({ static: isStatic = false }: { static?: boolean }) {
  return (
    <header
      className={`${isStatic ? "" : "absolute inset-x-0 top-0"} z-30 border-b border-brand-border bg-white`}
    >
      <div className="page-shell flex h-[76px] items-center justify-between">
        <Link
          href="/#beranda"
          aria-label="StudyDate ID, kembali ke beranda"
          className="focus-ring rounded-[12px]"
        >
          <BrandLogo priority />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Utama">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="focus-ring text-sm font-medium text-brand-muted transition-colors hover:text-brand-navy"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <EarlyAccessTrigger
          source="navbar"
          className="focus-ring hidden rounded-xl border-2 border-brand-navy bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_#0F1B33] transition-transform hover:-translate-y-0.5 lg:inline-flex"
        >
          Ikut Akses Awal
        </EarlyAccessTrigger>

        <MobileNav items={navigation} />
      </div>
    </header>
  );
}

function Hero() {
  const notes = [
    { text: "Teman diskusi", tone: undefined, rotate: "-5deg", place: "left-0 top-[46%]" },
    { text: "Workshop UI Sabtu", tone: "blue", rotate: "4deg", place: "-right-[6%] top-[60%]" },
    { text: "Circle skripsi", tone: "white", rotate: "-2deg", place: "left-[10%] bottom-[2%]" },
  ];

  return (
    <section id="beranda" className="notebook-paper relative overflow-x-clip pt-[76px]">
      <span className="notebook-margin hidden sm:block" aria-hidden="true" />
      <div className="page-shell relative grid gap-10 pb-14 pt-12 sm:pt-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-6 lg:pb-20">
        <div className="animate-enter min-w-0 max-w-[660px] sm:pl-10 lg:pl-14">
          <p className="font-hand text-xl text-brand-blue sm:text-2xl">
            Ketemu lewat hal yang sama.
          </p>
          <h1 className="mt-3 text-balance font-heading text-[2rem] min-[400px]:text-[2.35rem] font-semibold leading-[1.04] tracking-[-0.04em] text-brand-navy sm:text-[3.4rem] lg:text-[3.3rem] xl:text-[3.7rem]">
            Temukan teman baru lewat{" "}
            <span className="marker-underline">
              hal yang kamu suka.
              <svg viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true">
                <path
                  d="M4 14 C60 6 120 4 180 9 S270 15 296 7"
                  fill="none"
                  stroke="#014FE7"
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              </svg>
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-brand-muted">
            Cari teman belajar, gabung circle, dan temukan acara kampus. Mulai dari
            sesama mahasiswa dan alumni, tanpa harus langsung membuka nama atau kontak.
          </p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <EarlyAccessTrigger
              source="hero"
              className={`${stickerButton} bg-brand-blue text-white`}
            >
              Daftar Akses Awal
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </EarlyAccessTrigger>
            <a href="#events" className={`${stickerButton} bg-white text-brand-navy`}>
              <CalendarDays className="h-4 w-4 text-brand-blue" aria-hidden="true" />
              Lihat Acara Kampus
            </a>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[460px] pt-4 sm:pt-0">
          <div className="pointer-events-none absolute inset-0 z-[3] hidden sm:block lg:hidden xl:block" aria-hidden="true">
          {notes.map((note, index) => (
            <span
              key={note.text}
              className={`sticky-note float-slow absolute ${note.place}`}
              data-tone={note.tone}
              style={
                {
                  "--note-rotate": note.rotate,
                  animationDelay: `${index * -2.3}s`,
                } as React.CSSProperties
              }
            >
              {note.text}
            </span>
          ))}
          </div>
          <MascotBuddy className="relative z-[2] mx-auto w-[min(100%,340px)] pt-6" />
        </div>
      </div>
    </section>
  );
}

function PillarsOverview() {
  return (
    <section id="people" className="scroll-mt-20 overflow-x-clip bg-white py-20 sm:py-28">
      <div className="page-shell">
        <div className="max-w-2xl">
          <h2 className="section-title">Tiga pintu untuk mulai.</h2>
          <p className="mt-4 text-lg leading-8 text-brand-muted">
            Cari teman, gabung circle, atau datang ke acara kampus. Pilih satu, maskotnya
            ikut menyesuaikan.
          </p>
        </div>
        <div className="mt-14">
          <PillarOrbit />
        </div>
      </div>
    </section>
  );
}

function IntroductionFlow() {
  return (
    <section id="cara-kerja" className="scroll-mt-20 bg-brand-surface">
      <WaveEdge fill="#FFFFFF" flip />
      <div className="page-shell py-16 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="section-title">Kenalan dulu. Identitas menyusul kalau sama-sama nyaman.</h2>
          <p className="mt-4 text-lg leading-8 text-brand-muted">
            Gulir pelan-pelan. Lihat bagaimana profil tanpa nama asli terbuka sedikit demi
            sedikit, dan hanya kalau kalian berdua setuju.
          </p>
        </div>
        <div className="mt-12">
          <PrivacyReveal />
        </div>
      </div>
    </section>
  );
}

function ProgressivePrivacy() {
  const promises = [
    "Kalian berdua harus setuju sebelum kontak dibagikan.",
    "Membuka satu kontak tidak otomatis membuka kontak lainnya.",
    "Blokir, laporkan, dan akhiri percakapan selalu tersedia, gratis.",
    "Kalau ketemuan, hanya di tempat umum yang ramai.",
  ];

  return (
    <section className="relative overflow-hidden bg-brand-navy text-white">
      <WaveEdge fill="#F7F9FC" flip />
      <div className="page-shell grid items-center gap-12 pb-24 pt-14 sm:pb-32 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="font-hand text-2xl text-[#8DB9F6]">Kamu pegang kendali.</p>
          <h2 className="mt-3 max-w-xl font-heading text-3xl font-semibold leading-tight sm:text-4xl lg:text-[2.75rem]">
            Ngobrol dulu secara online. Bertemu nanti kalau sama-sama nyaman.
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/70">
            Kenalan bisa jadi teman belajar, rekan proyek, teman ngobrol, atau hubungan
            yang lebih dekat. Tidak perlu ditentukan dari awal.
          </p>
          <ul className="mt-9 space-y-4 text-base text-white/80">
            {promises.map((item) => (
              <li key={item} className="flex gap-3">
                <Check className="mt-1 h-4 w-4 shrink-0 text-[#8DB9F6]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mx-auto w-full max-w-[360px]">
          <MascotBuddy
            className="w-full"
            greeting="Psst. Nama dan kontakmu tetap tertutup dulu."
            label="Maskot StudyDate di bagian privasi"
            reactions={[
              { expression: "kedip", line: "Yang terlihat cuma nama samaran dan minatmu." },
              { expression: "mikir", line: "Tiap kontak dibuka satu per satu, dengan persetujuan kalian berdua." },
              { expression: "kaget", line: "Ada yang maksa minta kontak? Blokir dan laporkan saja." },
              { expression: "senang", line: "Ketemuan? Pilih tempat umum yang ramai, ya." },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function Groups() {
  const circles = [
    {
      name: "Riset & desain produk kampus",
      meta: "Online, Kamis malam",
      scope: "Terbuka",
      rotate: "-2.5deg",
    },
    {
      name: "Persiapan ujian akhir Statistika",
      meta: "Perpustakaan pusat, Sabtu pagi",
      scope: "Satu kampus",
      rotate: "1.5deg",
    },
    {
      name: "Ngobrol bahasa Jepang santai",
      meta: "Online, Selasa sore",
      scope: "Terbuka",
      rotate: "-1deg",
    },
  ];

  return (
    <section id="groups" className="scroll-mt-20 overflow-x-clip bg-white py-20 sm:py-28">
      <div className="page-shell grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <h2 className="section-title max-w-md">Belajar dan berdiskusi dalam circle kecil.</h2>
          <p className="mt-5 max-w-md text-lg leading-8 text-brand-muted">
            Tiga sampai tiga puluh anggota. Bisa terbuka untuk semua kampus, atau khusus
            mahasiswa dari kampus yang sama. Gabung circle tidak otomatis membuka identitasmu.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <span className="w-20 shrink-0">
              <MascotHead expression="mikir" />
            </span>
            <p className="font-hand text-xl leading-snug text-brand-navy">
              Belajar bareng lebih awet kalau kelompoknya kecil.
            </p>
          </div>
        </div>

        <ul className="relative grid gap-5" aria-label="Contoh circle">
          {circles.map((circle) => (
            <li key={circle.name} style={{ rotate: circle.rotate }}>
              <TiltCard strength={6}>
                <article className="rounded-2xl border-2 border-brand-navy bg-[#FFFDF4] p-5 shadow-[5px_5px_0_#0F1B33] sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-heading text-lg font-semibold text-brand-navy sm:text-xl">
                      {circle.name}
                    </h3>
                    <span className="rounded-full bg-[#DCE8FF] px-3 py-1 text-xs font-semibold text-brand-blue">
                      {circle.scope}
                    </span>
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-sm text-brand-muted">
                    <Users className="h-4 w-4 text-brand-blue" aria-hidden="true" />
                    {circle.meta}
                  </p>
                </article>
              </TiltCard>
            </li>
          ))}
          <li className="text-right text-xs text-brand-muted">Contoh circle, bukan data sungguhan.</li>
        </ul>
      </div>
    </section>
  );
}

function CampusEvents() {
  const tickets = [
    { kind: "Workshop", title: "Dasar riset pengguna", when: "Sabtu, 09.00", where: "Perpustakaan kampus" },
    { kind: "Hackathon", title: "48 jam bikin aplikasi kampus", when: "Jumat, 18.00", where: "Ruang kerja bersama" },
    { kind: "Meetup", title: "Ngopi bareng anak desain", when: "Rabu, 16.00", where: "Kafe dekat kampus" },
  ];
  const categories = [
    "Seminar",
    "Workshop",
    "Meetup",
    "Hackathon",
    "Komunitas kampus",
    "Kumpul belajar",
    "Kompetisi",
    "Karier dan kerja bareng",
  ];

  return (
    <section id="events" className="scroll-mt-20 overflow-x-clip bg-brand-blue text-white">
      <WaveEdge fill="#FFFFFF" flip />
      <div className="page-shell py-16 sm:py-24">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl">
            <h2 className="font-heading text-3xl font-semibold leading-tight sm:text-4xl lg:text-[2.75rem]">
              Cari kegiatan kampus yang benar-benar ingin kamu ikuti.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/80">
              Lihat waktu, tempat, dan cara mendaftar. Setelah masuk, tiket acaramu
              tersimpan di akun StudyDate dan bisa dipindai saat datang.
            </p>
          </div>
          <Link
            href="/events"
            className={`${stickerButton} bg-white text-brand-navy`}
          >
            Lihat acara mendatang
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <ul className="mt-14 grid gap-6 md:grid-cols-3" aria-label="Contoh tiket acara">
          {tickets.map((ticket) => (
            <li key={ticket.title}>
              <TiltCard>
                <article className="ticket p-6 text-brand-navy">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-blue">
                    <Ticket className="h-4 w-4" aria-hidden="true" />
                    {ticket.kind}
                  </p>
                  <h3 className="tilt-pop mt-3 min-h-[3.5rem] font-heading text-xl font-semibold leading-snug">
                    {ticket.title}
                  </h3>
                  <div className="ticket-perforation mt-6 pt-5 text-sm text-brand-muted">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-brand-blue" aria-hidden="true" />
                      {ticket.when}
                    </p>
                    <p className="mt-2 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-brand-blue" aria-hidden="true" />
                      {ticket.where}
                    </p>
                  </div>
                </article>
              </TiltCard>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-white/70">Contoh tiket, bukan acara sungguhan.</p>

        <ul className="mt-12 flex flex-wrap gap-2.5" aria-label="Jenis acara">
          {categories.map((item) => (
            <li
              key={item}
              className="rounded-full border border-white/35 px-4 py-2 text-sm font-medium text-white"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
      <WaveEdge fill="#F6F9FF" />
    </section>
  );
}

function EarlyAccessCTA() {
  return (
    <section id="mulai" className="notebook-paper relative overflow-x-clip py-16 sm:py-24">
      <div className="page-shell grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative mx-auto w-full max-w-[220px] lg:max-w-[260px]">
          <BrandAsset
            src="/brand/mascot/front-cropped.png"
            alt="Maskot StudyDate membawa buku"
            width={472}
            height={843}
            sizes="(max-width: 1023px) 220px, 260px"
            className="mascot-cta-shadow h-auto w-full object-contain"
          />
        </div>
        <div className="max-w-xl">
          <p className="font-hand text-2xl text-brand-blue">Akses awal sudah dibuka.</p>
          <h2 className="section-title mt-3">Mulai kenalan dari lingkungan kampusmu.</h2>
          <p className="mt-5 text-lg leading-8 text-brand-muted">
            Daftar akses awal untuk mencoba StudyDate ID dan bantu kami memperluas
            komunitas mahasiswa dan alumni Indonesia. Fitur dibuka bertahap, dan belum
            dibuka untuk semua pengguna sekaligus.
          </p>
          <EarlyAccessTrigger
            source="final-cta"
            className={`${stickerButton} mt-8 bg-brand-blue text-white`}
          >
            Ikut Akses Awal
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </EarlyAccessTrigger>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <EarlyAccessProvider>
      <PublicNavbar />
      <main>
        <Hero />
        <PillarsOverview />
        <IntroductionFlow />
        <ProgressivePrivacy />
        <Groups />
        <CampusEvents />
        <EarlyAccessCTA />
      </main>
      <PublicFooter />
    </EarlyAccessProvider>
  );
}
