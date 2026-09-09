import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Flag,
  LockKeyhole,
  Users,
} from "lucide-react";
import {
  EarlyAccessProvider,
  EarlyAccessTrigger,
} from "@/components/marketing/early-access-dialog";
import { MobileNav } from "@/components/marketing/mobile-nav";
import { PublicFooter } from "@/components/marketing/public-footer";

const navigation = [
  { label: "Cari Teman", href: "/#people" },
  { label: "Circle Belajar", href: "/#groups" },
  { label: "Acara Kampus", href: "/events" },
  { label: "Cara Kerja", href: "/#cara-kerja" },
  { label: "Tentang", href: "/about" },
  { label: "Keamanan", href: "/safety" },
];

const peopleFlow = [
  ["01", "Lihat profil anonim", "Kenali minat, kampus, dan tujuan koneksinya lebih dulu."],
  ["02", "Kirim perkenalan", "Tulis alasan singkat kenapa kamu ingin terhubung."],
  ["03", "Tunggu persetujuan", "Chat terbuka hanya jika perkenalanmu diterima."],
  ["04", "Ngobrol tanpa buru-buru", "Nama asli, foto, dan kontak tetap disembunyikan."],
  ["05", "Sama-sama ingin lanjut", "Kalian berdua memilih apakah ingin saling mengenal lebih jauh."],
  ["06", "Bagikan seperlunya", "Identitas dan kontak dibuka bertahap dengan persetujuan bersama."],
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
          className="focus-ring hidden rounded-[12px] bg-brand-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#013FC7] lg:inline-flex"
        >
          Ikut Akses Awal
        </EarlyAccessTrigger>

        <MobileNav items={navigation} />
      </div>
    </header>
  );
}

function ConnectionPreview() {
  const connectionGoals = [
    "Belajar bersama",
    "Obrolan kampus",
    "Jejaring",
  ];

  return (
    <div
      className="product-window animate-enter-delay mx-auto w-full max-w-[500px] shadow-[0_20px_50px_rgba(15,27,51,0.10)]"
      aria-label="Pratinjau profil anonim mahasiswa di StudyDate"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <BrandAsset
            src="/brand/symbol-blue.png"
            alt=""
            width={40}
            height={40}
            className="h-6 w-6 object-contain"
          />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">
            CONTOH TAMPILAN • PROFIL ANONIM
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-muted">
          <LockKeyhole className="h-3.5 w-3.5 text-brand-blue" aria-hidden="true" />
          Belum ada kontak dibuka
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid min-w-0 grid-cols-[96px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[116px_minmax(0,1fr)] sm:gap-5">
          <div className="relative aspect-square overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_50%_24%,#ffffff_0%,#edf4ff_66%,#e3edfc_100%)]">
            <BrandAsset
              src="/brand/mascot/front-1024.png"
              alt="Mascot StudyDate membawa buku"
              width={1024}
              height={1024}
              sizes="(max-width: 639px) 96px, 116px"
              className="h-full w-full object-contain object-bottom p-2 drop-shadow-[0_8px_14px_rgba(15,27,51,0.13)]"
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl font-semibold tracking-[-0.025em] text-brand-navy sm:text-[1.4rem]">
                Profil mahasiswa
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-surface px-2.5 py-1 text-xs font-semibold text-brand-blue">
                <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                Nama dan kontak belum dibagikan
              </span>
            </div>
            <p className="mt-3 font-heading text-lg font-semibold leading-tight text-brand-navy">
              Program studi
            </p>
            <p className="mt-1 text-sm text-brand-muted">
              Semester • wilayah umum
            </p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-muted">
            Ingin terhubung lewat
          </p>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-brand-navy">
            {connectionGoals.map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-brand-blue"
                  aria-hidden="true"
                />
                {item}
              </span>
            ))}
          </div>
        </div>

        <dl className="mt-5 grid min-w-0 gap-4 rounded-[16px] bg-brand-surface/75 p-4 sm:grid-cols-3">
          {[
            ["Minat", "Teknologi, desain, kopi"],
            ["Lagi cari", "Teman diskusi & kolaborasi"],
            ["Aktivitas", "Workshop UI kampus"],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-semibold text-brand-muted">{label}</dt>
              <dd className="mt-1 text-sm font-medium leading-5 text-brand-navy">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 flex items-start gap-2.5 rounded-[14px] bg-[#EDF4FF] px-3.5 py-3 text-xs leading-5 text-brand-muted">
          <LockKeyhole
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue"
            aria-hidden="true"
          />
          Nama asli, foto, dan kontak baru dibagikan jika kalian sama-sama setuju.
        </p>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section id="beranda" className="bg-white pt-[76px]">
      <div className="page-shell grid gap-12 py-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-start lg:gap-14 lg:py-16 xl:grid-cols-[1.14fr_0.86fr]">
        <div className="animate-enter min-w-0 max-w-[640px] lg:max-w-[680px]">
          <p className="mb-6 border-l-2 border-brand-blue pl-4 text-sm font-semibold leading-6 text-brand-navy">
            Ketemu lewat hal yang sama. Kenalan tanpa perlu terburu-buru.
          </p>
          <h1 className="text-balance font-heading max-w-none text-[1.9rem] font-semibold leading-[1.03] tracking-[-0.035em] text-brand-navy sm:text-[3.35rem] sm:leading-[1.08] sm:tracking-[-0.04em] lg:text-[3.65rem] xl:text-[3.9rem]">
            Temukan koneksi baru{" "}
            <span className="text-brand-blue">lewat hal yang sama.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-[1.6] text-brand-muted sm:mt-7 sm:leading-8">
            Cari teman belajar, gabung circle, dan temukan acara kampus. Mulai dari
            lingkungan mahasiswa dan alumni, tanpa harus langsung membuka nama atau kontak.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row">
            <EarlyAccessTrigger
              source="hero"
              className="focus-ring inline-flex min-h-13 items-center justify-center gap-2 rounded-[12px] bg-brand-blue px-6 py-4 font-semibold text-white transition-colors hover:bg-[#013FC7]"
            >
              Daftar Akses Awal
              <ArrowRight className="h-4 w-4" />
            </EarlyAccessTrigger>
            <a
              href="#events"
              className="focus-ring inline-flex min-h-13 items-center justify-center gap-2 rounded-[12px] border border-brand-border bg-white px-6 py-4 font-semibold text-brand-navy transition-colors hover:border-brand-navy"
            >
              <CalendarDays className="h-4 w-4 text-brand-blue" />
              Lihat Acara Kampus
            </a>
          </div>
        </div>

        <div className="relative min-h-[380px] min-w-0 pb-6 lg:-mt-4 lg:pl-4 xl:-mt-6">
          <div className="absolute -right-5 -top-5 h-[72%] w-[68%] bg-brand-surface" />
          <ConnectionPreview />
          <p className="relative mt-4 text-right text-xs text-brand-muted">
            Contoh tampilan, bukan akun mahasiswa sungguhan.
          </p>
        </div>
      </div>
    </section>
  );
}

function MascotCompanion() {
  const moments = [
    {
      pose: "/brand/mascot/hello.png" as const,
      label: "Temukan",
      title: "Mulai dari kesamaan",
      copy: "Lihat minat, tujuan, dan konteks kampus sebelum memutuskan untuk menyapa.",
      imageClass:
        "h-[17.5rem] w-[17.5rem] object-contain object-bottom drop-shadow-[0_14px_24px_rgba(15,27,51,0.14)] sm:h-[19rem] sm:w-[19rem]",
    },
    {
      pose: "/brand/mascot/study.png" as const,
      label: "Kenalan",
      title: "Kirim alasan untuk terhubung",
      copy: "Percakapan baru terbuka setelah perkenalan diterima.",
      imageClass:
        "h-[15.5rem] w-[15.5rem] object-contain object-bottom drop-shadow-[0_14px_24px_rgba(15,27,51,0.14)] sm:h-[16.5rem] sm:w-[16.5rem]",
    },
    {
      pose: "/brand/mascot/chat.png" as const,
      label: "Bagikan",
      title: "Buka identitas bertahap",
      copy: "Nama, foto, dan kontak dibagikan hanya dengan persetujuan bersama.",
      imageClass:
        "h-[16rem] w-[16rem] origin-bottom scale-[1.02] object-contain object-bottom drop-shadow-[0_14px_24px_rgba(15,27,51,0.14)] sm:h-[17rem] sm:w-[17rem] sm:scale-[1.03]",
    },
  ];

  return (
    <section
      aria-labelledby="mascot-companion-title"
      className="border-b border-brand-border bg-white py-16 sm:py-20"
    >
      <div className="page-shell">
        <div className="max-w-2xl">
          <p className="section-label">Cara StudyDate bekerja</p>
          <h2 id="mascot-companion-title" className="section-title mt-4">
            Mulai dari satu kesamaan. Lanjut kalau sama-sama nyaman.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
            Mulai dari hal yang sama-sama kalian sukai, lanjutkan percakapan jika
            perkenalan diterima, lalu bagikan identitas hanya saat sudah nyaman.
          </p>
        </div>
        <ul className="mt-12 grid gap-6 lg:grid-cols-3">
          {moments.map((item) => (
            <li
              key={item.label}
              className="overflow-hidden rounded-[24px] border border-brand-border bg-brand-surface"
            >
              <div className="flex h-72 items-end justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_18%,#ffffff_0%,#edf4ff_62%,#dce9fb_100%)] px-3 pt-4 sm:h-80 sm:px-4">
                <BrandAsset
                  src={item.pose}
                  alt=""
                  width={1024}
                  height={1024}
                  sizes="(max-width: 1023px) 320px, 380px"
                  className={item.imageClass}
                />
              </div>
              <div className="border-t border-brand-border bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">
                  {item.label}
                </p>
                <h3 className="mt-3 font-heading text-xl font-semibold tracking-[-0.02em] text-brand-navy">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-brand-muted">
                  {item.copy}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PillarsOverview() {
  const pillars = [
    {
      label: "Cari Teman",
      title: "Cari teman yang nyambung",
      copy: "Temukan mahasiswa lewat minat, tujuan, dan konteks kampus.",
    },
    {
      label: "Circle Belajar",
      title: "Gabung circle belajar",
      copy: "Belajar, berdiskusi, atau mengerjakan proyek bersama dalam kelompok kecil.",
    },
    {
      label: "Acara Kampus",
      title: "Temukan acara kampus",
      copy: "Lihat kegiatan yang sesuai minat, waktu, dan lingkunganmu.",
    },
  ];

  return (
    <section id="people" className="scroll-mt-20 border-y border-brand-border bg-brand-surface py-20 sm:py-24">
      <div className="page-shell">
        <div className="grid gap-6 md:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="section-label">Teman · Circle · Acara</p>
            <h2 className="section-title mt-4 max-w-lg">
              Mulai dari yang paling kamu butuhkan.
            </h2>
          </div>
          <p className="max-w-xl text-lg leading-8 text-brand-muted md:justify-self-end md:pt-8">
            Cari teman belajar, gabung circle, atau datang ke acara kampus. Bisa jadi
            teman diskusi, rekan proyek, atau seseorang yang lebih berarti.
          </p>
        </div>

        <div className="mt-14 grid gap-9 md:grid-cols-3 md:gap-8">
          {pillars.map((pillar, index) => (
            <article
              key={pillar.label}
              className={`border-t-2 pt-5 ${
                index === 1 ? "border-brand-blue" : index === 2 ? "border-brand-navy" : "border-brand-border"
              }`}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-blue">
                {pillar.label}
              </p>
              <h3 className="mt-5 font-heading text-xl font-semibold text-brand-navy">
                {pillar.title}
              </h3>
              <p className="mt-2.5 leading-7 text-brand-muted">{pillar.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function IntroductionFlow() {
  return (
    <section id="cara-kerja" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="page-shell">
        <div className="grid gap-6 md:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="section-label">Kenalan sebelum chat</p>
            <h2 className="section-title mt-4 max-w-lg">
              Kenalan dulu, chat setelah perkenalan diterima.
            </h2>
          </div>
          <p className="max-w-xl text-lg leading-8 text-brand-muted md:justify-self-end md:pt-8">
            Tulis alasan singkat kenapa kamu ingin terhubung. Jika penerima setuju,
            barulah kalian bisa mulai ngobrol tanpa langsung membuka identitas.
          </p>
        </div>

        <ol className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {peopleFlow.map(([number, title, description]) => (
            <li key={number} className="border-t-2 border-brand-border pt-5">
              <span className="font-heading text-3xl font-semibold tracking-tight text-brand-muted/55">
                {number}
              </span>
              <h3 className="mt-4 font-heading text-lg font-semibold text-brand-navy">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-brand-muted">{description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ProgressivePrivacy() {
  return (
    <section className="relative overflow-hidden bg-brand-navy py-24 text-white sm:pb-40 sm:pt-32 lg:pb-44">
      <div className="page-shell grid items-center gap-16 lg:grid-cols-[0.78fr_1.22fr]">
        <div>
          <p className="section-label text-[#8DB9F6]">Privasi bertahap</p>
          <h2 className="mt-5 max-w-lg font-heading text-3xl font-semibold leading-tight sm:text-4xl lg:text-[2.75rem]">
            Nama dan kontak tidak langsung ditampilkan.
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/65">
            Saat mulai kenalan, orang lain hanya melihat informasi yang kamu pilih.
            Nama, foto, dan kontak baru dibagikan setelah kalian sama-sama setuju.
          </p>
          <ul className="mt-9 space-y-4 text-sm text-white/75">
            {[
              "Setiap jenis kontak memerlukan persetujuan dua arah.",
              "Membuka satu kontak tidak otomatis membuka kontak lainnya.",
              "Blokir, laporkan, dan akhiri ruang selalu tersedia.",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#8DB9F6]" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div
            className="mx-auto w-full max-w-xl overflow-hidden rounded-[20px] border border-white/15 bg-[#14233E] lg:max-w-[640px]"
            aria-label="Pratinjau statis chat anonim StudyDate"
          >
            <div className="flex items-center justify-between border-b border-white/15 px-5 py-4">
              <div>
                <p className="font-semibold">Profil anonim</p>
                <p className="mt-1 text-xs text-white/45">Nama, foto, dan kontak belum dibagikan</p>
              </div>
              <LockKeyhole className="h-4 w-4 text-[#8DB9F6]" aria-hidden="true" />
            </div>
            <div className="space-y-5 p-5 sm:p-7">
              <div className="max-w-[82%] rounded-[12px] border border-white/15 bg-white px-4 py-3 text-sm leading-6 text-brand-navy">
                Aku juga tertarik ikut workshop desain hari Sabtu. Mau saling
                kenal dulu sebelum daftar?
              </div>
              <div className="ml-auto max-w-[82%] rounded-[12px] bg-brand-blue px-4 py-3 text-sm leading-6 text-white">
                Boleh. Kita bisa ngobrol di sini dulu dan lihat apakah minat kita cocok.
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-white/15 px-5 py-4 text-xs text-white/45">
              <span>Ruang privat anonim</span>
              <span className="flex gap-4">
                <span className="flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5" /> Lapor
                </span>
                <span>Akhiri ruang</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <BrandAsset
        src="/brand/mascot/chat-1024.png"
        alt=""
        width={1024}
        height={1024}
        sizes="(max-width: 1023px) 352px, 480px"
        className="pointer-events-none absolute hidden h-[22rem] w-[22rem] max-w-none object-contain md:-bottom-[4.25rem] md:-right-[4rem] md:block lg:-bottom-[6.375rem] lg:-right-[6.25rem] lg:h-[30rem] lg:w-[30rem]"
        inverted
      />
    </section>
  );
}

function Groups() {
  const groupTypes = [
    ["Circle belajar", "Belajar rutin bersama mahasiswa dengan target yang sejalan."],
    ["Circle terbuka", "Mahasiswa dapat meminta bergabung sesuai topik dan tujuan circle."],
    ["Circle satu kampus", "Admin dapat membatasi anggota dari kampus yang sama."],
  ];

  return (
    <section id="groups" className="scroll-mt-20 bg-brand-surface py-20 sm:py-28">
      <div className="page-shell">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_0.75fr]">
          <div>
            <p className="section-label">Circle Belajar</p>
            <h2 className="section-title mt-5 max-w-2xl">
              Belajar dan berdiskusi dalam circle kecil.
            </h2>
          </div>
          <p className="max-w-lg leading-7 text-brand-muted lg:justify-self-end">
            Pilih circle berdasarkan topik, tujuan, dan lingkungan kampus yang
            membuatmu nyaman.
          </p>
        </div>

        <div className="product-showcase mt-14">
          <aside className="border-b border-brand-border bg-brand-navy p-5 text-white lg:border-b-0 lg:border-r lg:p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/55">
              Study Circle
            </p>
            <p className="mt-5 font-heading text-[1.65rem] font-semibold leading-snug">
              Riset &amp; desain produk kampus
            </p>
            <p className="mt-2.5 text-base leading-7 text-white/70">
              Kelompok kecil untuk diskusi mingguan, portofolio, dan kolaborasi.
            </p>
            <div className="mt-7 border-t border-white/15 pt-5">
              <p className="flex items-center gap-3 text-base">
                <Users className="h-5 w-5 shrink-0 text-[#8DB9F6]" />
                3–30 anggota · terbuka atau satu kampus
              </p>
              <p className="mt-3 text-base text-white/60">Online · Kamis malam</p>
            </div>
          </aside>

          <div className="bg-white p-5 sm:p-7">
            <div className="divide-y divide-brand-border border-y border-brand-border">
              {groupTypes.map(([title, copy]) => (
                <article key={title} className="grid gap-2 py-5 sm:grid-cols-[150px_1fr] sm:gap-6">
                  <h3 className="font-heading text-lg font-semibold text-brand-navy">{title}</h3>
                  <p className="text-[0.9375rem] leading-7 text-brand-navy/75">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CampusEvents() {
  const eventTypes = [
    "Seminar",
    "Workshop",
    "Komunitas kampus",
    "Study gathering",
    "Kompetisi",
    "Acara karier & jejaring",
  ];

  return (
    <section id="events" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="page-shell grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <p className="section-label">Acara Kampus</p>
          <h2 className="section-title mt-4 max-w-md">
            Cari kegiatan kampus yang benar-benar ingin kamu ikuti.
          </h2>
          <p className="mt-5 max-w-md leading-7 text-brand-muted">
            Lihat waktu, tempat, dan cara mendaftar. Setelah masuk, tiket acaramu
            tersimpan di akun StudyDate.
          </p>
          <Link
            href="/events"
            className="focus-ring mt-7 inline-flex items-center gap-2 font-semibold text-brand-blue"
          >
            Lihat acara mendatang
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="divide-y divide-brand-border border-y border-brand-border">
          {eventTypes.map((item, index) => (
            <div key={item} className="grid grid-cols-[48px_1fr] items-center gap-4 py-4">
              <span className="font-heading text-sm font-semibold text-brand-muted/70">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="font-heading text-lg font-semibold text-brand-navy">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OnlineFirst() {
  return (
    <section className="border-y border-brand-border bg-brand-surface">
      <div className="page-shell grid gap-10 py-20 md:grid-cols-[160px_1fr] md:py-24 lg:gap-16">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-blue">
          Kenalan online lebih dulu
        </p>
        <div>
          <h2 className="max-w-4xl font-heading text-3xl font-medium leading-[1.35] tracking-[-0.025em] text-brand-navy sm:text-4xl lg:text-[2.75rem]">
            Ngobrol dulu secara online. Bertemu nanti kalau sama-sama nyaman.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-brand-muted">
            Koneksi bisa tumbuh menjadi teman belajar, rekan proyek, teman ngobrol,
            atau hubungan personal. Tidak perlu ditentukan dari awal.
          </p>
        </div>
      </div>
    </section>
  );
}

function EarlyAccessCTA() {
  return (
    <section id="mulai" className="bg-brand-surface py-14 sm:py-20">
      <div className="page-shell">
        <div className="grid overflow-hidden rounded-[30px] bg-brand-blue lg:grid-cols-[minmax(0,0.34fr)_minmax(0,0.66fr)]">
          <div className="flex items-end justify-center px-4 pb-3 pt-6 sm:px-6 sm:pb-4 lg:min-h-[340px] lg:px-8 lg:pb-6 lg:pt-8">
            <BrandAsset
              src="/brand/mascot/front.png"
              alt="Maskot StudyDate"
              width={1024}
              height={1024}
              sizes="(max-width: 1024px) 300px, 400px"
              className="mascot-cta-slot mascot-cta-shadow object-contain object-bottom"
              inverted
            />
          </div>
          <div className="flex items-center border-t border-white/15 p-7 sm:p-12 lg:border-l lg:border-t-0 lg:p-16">
            <div className="max-w-xl text-white">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/65">
                Akses awal
              </p>
              <h2 className="mt-5 font-heading text-3xl font-semibold leading-tight sm:text-4xl">
                Mulai temukan koneksi dari lingkungan kampusmu.
              </h2>
              <p className="mt-5 leading-7 text-white/70">
                Daftar akses awal untuk mencoba StudyDate ID dan bantu kami membangun
                jaringan mahasiswa dan alumni Indonesia.
              </p>
              <EarlyAccessTrigger
                source="final-cta"
                className="focus-ring mt-8 inline-flex items-center gap-2 rounded-[12px] bg-white px-6 py-4 font-semibold text-brand-blue transition-colors hover:bg-brand-surface"
              >
                Ikut Akses Awal
                <ArrowRight className="h-4 w-4" />
              </EarlyAccessTrigger>
            </div>
          </div>
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
        <MascotCompanion />
        <IntroductionFlow />
        <ProgressivePrivacy />
        <Groups />
        <CampusEvents />
        <OnlineFirst />
        <EarlyAccessCTA />
      </main>
      <PublicFooter />
    </EarlyAccessProvider>
  );
}
