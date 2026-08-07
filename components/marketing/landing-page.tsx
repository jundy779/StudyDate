import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Flag,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  EarlyAccessProvider,
  EarlyAccessTrigger,
} from "@/components/marketing/early-access-dialog";
import { MobileNav } from "@/components/marketing/mobile-nav";

const navigation = [
  { label: "People", href: "#people" },
  { label: "Groups", href: "#groups" },
  { label: "Events", href: "#events" },
  { label: "Cara Kerja", href: "#cara-kerja" },
  { label: "Keamanan", href: "#keamanan" },
];

const footerLinks = [
  { label: "Privasi", href: "/privacy" },
  { label: "Ketentuan", href: "/terms" },
  { label: "Pedoman Komunitas", href: "/community-guidelines" },
  { label: "Keamanan", href: "/safety" },
  { label: "Bantuan", href: "/help" },
];

const peopleFlow = [
  ["01", "Profil anonim", "Mulai dari minat, kampus, dan konteks yang ingin kamu bagikan."],
  ["02", "Kirim perkenalan", "Sampaikan alasan ingin terhubung sebelum ruang chat dibuka."],
  ["03", "Perkenalan dibalas", "Percakapan hanya dimulai ketika penerima memilih untuk membalas."],
  ["04", "Chat privat anonim", "Kenal perlahan tanpa membuka kontak atau identitas lengkap."],
  ["05", "Minat dua arah", "Keduanya menyatakan ingin melanjutkan koneksi."],
  ["06", "Identitas dibuka", "Nama depan dan foto jelas muncul setelah persetujuan bersama."],
  ["07", "Interaksi online", "Bangun rasa percaya melalui percakapan dan aktivitas online."],
  ["08", "Bertemu di ruang publik", "Jika siap, pilih tempat publik dan biarkan koneksi berkembang alami."],
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

function Navbar() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 border-b border-brand-border bg-white">
      <div className="page-shell flex h-[76px] items-center justify-between">
        <a
          href="#beranda"
          aria-label="StudyDate ID, kembali ke beranda"
          className="focus-ring rounded-[12px]"
        >
          <BrandLogo priority />
        </a>

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
    "Networking",
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
            priority
          />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">
            PEOPLE • PROFIL ANONIM
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
              priority
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl font-semibold tracking-[-0.025em] text-brand-navy sm:text-[1.4rem]">
                Mahasiswa #184
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-surface px-2.5 py-1 text-xs font-semibold text-brand-blue">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Terverifikasi
              </span>
            </div>
            <p className="mt-3 font-heading text-lg font-semibold leading-tight text-brand-navy">
              Teknik Informatika
            </p>
            <p className="mt-1 text-sm text-brand-muted">
              Semester 3 • satu kampus
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
          Nama asli &amp; foto jelas terbuka setelah mutual interest.
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
            Mulai dari belajar. Kenal perlahan. Biarkan koneksi menemukan arahnya.
          </p>
          <h1 className="text-balance font-heading max-w-none text-[1.9rem] font-semibold leading-[1.03] tracking-[-0.035em] text-brand-navy sm:text-[3.35rem] sm:leading-[1.08] sm:tracking-[-0.04em] lg:text-[3.65rem] xl:text-[3.9rem]">
            Temukan seseorang untuk belajar, ngobrol, dan membangun{" "}
            <span className="text-brand-blue">koneksi yang berarti.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-[1.6] text-brand-muted sm:mt-7 sm:leading-8">
            Kenalan secara privat, bergabung dalam kelompok, dan temukan kegiatan
            kampus—untuk teman belajar, relasi, networking, atau seseorang yang
            ingin kamu kenal lebih jauh.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row">
            <EarlyAccessTrigger
              source="hero"
              className="focus-ring inline-flex min-h-13 items-center justify-center gap-2 rounded-[12px] bg-brand-blue px-6 py-4 font-semibold text-white transition-colors hover:bg-[#013FC7]"
            >
              Mulai Berkenalan
              <ArrowRight className="h-4 w-4" />
            </EarlyAccessTrigger>
            <a
              href="#events"
              className="focus-ring inline-flex min-h-13 items-center justify-center gap-2 rounded-[12px] border border-brand-border bg-white px-6 py-4 font-semibold text-brand-navy transition-colors hover:border-brand-navy"
            >
              <CalendarDays className="h-4 w-4 text-brand-blue" />
              Jelajahi Campus Events
            </a>
          </div>
        </div>

        <div className="relative min-h-[380px] min-w-0 pb-6 lg:-mt-4 lg:pl-4 xl:-mt-6">
          <div className="absolute -right-5 -top-5 h-[72%] w-[68%] bg-brand-surface" />
          <ConnectionPreview />
          <p className="relative mt-4 text-right text-xs text-brand-muted">
            Kenali konteksnya lebih dulu. Identitas lengkap tetap privat.
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
      label: "Sambut",
      title: "Mulai dengan sapaan yang aman",
      copy: "Maskot StudyDate menemani onboarding dan empty state—supaya ruang digital terasa hangat sebelum kamu kenal siapa pun.",
      imageClass:
        "h-[17.5rem] w-[17.5rem] object-contain object-bottom drop-shadow-[0_14px_24px_rgba(15,27,51,0.14)] sm:h-[19rem] sm:w-[19rem]",
    },
    {
      pose: "/brand/mascot/study.png" as const,
      label: "Belajar",
      title: "Konteks belajar dulu, identitas belakangan",
      copy: "People menampilkan minat dan tujuan koneksi. Nama asli dan foto jelas baru muncul setelah minat dua arah.",
      imageClass:
        "h-[15.5rem] w-[15.5rem] object-contain object-bottom drop-shadow-[0_14px_24px_rgba(15,27,51,0.14)] sm:h-[16.5rem] sm:w-[16.5rem]",
    },
    {
      pose: "/brand/mascot/chat.png" as const,
      label: "Ngobrol",
      title: "Chat privat tanpa kontak terbuka",
      copy: "Ruang percakapan tetap anonim sampai keduanya siap. Kontak seperti LinkedIn dibuka bertahap, bukan sekaligus.",
      // Half-body crop — slight bump only so it doesn't dwarf the hello pose.
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
          <p className="section-label">Teman digital StudyDate</p>
          <h2 id="mascot-companion-title" className="section-title mt-4">
            Maskot yang menemani, bukan menggantikan orang nyata.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
            Dipakai di hero produk, empty state, dan halaman sistem—supaya
            pengalaman web terasa konsisten dari landing sampai ruang mahasiswa.
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
      label: "People",
      title: "Temukan seseorang",
      copy: "Kenalan lewat profil anonim dan perkenalan yang punya konteks—untuk belajar, berteman, networking, kolaborasi, atau hubungan yang tumbuh alami.",
    },
    {
      label: "Groups",
      title: "Masuk ke lingkaran yang tepat",
      copy: "Bergabung dalam kelompok kampus kecil berdasarkan topik, tujuan, komunitas, dan tingkat verifikasi yang kamu pilih.",
    },
    {
      label: "Campus Events",
      title: "Datang karena ada kegiatan",
      copy: "Temukan seminar, workshop, kompetisi, study gathering, komunitas, serta acara karier dan networking di sekitarmu.",
    },
  ];

  return (
    <section id="people" className="scroll-mt-20 border-y border-brand-border bg-brand-surface py-20 sm:py-24">
      <div className="page-shell">
        <div className="grid gap-6 md:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="section-label">People · Groups · Events</p>
            <h2 className="section-title mt-4 max-w-lg">
              Tiga jalan untuk menemukan koneksi di kampus.
            </h2>
          </div>
          <p className="max-w-xl text-lg leading-8 text-brand-muted md:justify-self-end md:pt-8">
            StudyDate membantu mahasiswa bertemu lewat orang, kelompok, dan
            kegiatan—tanpa menentukan sejak awal hubungan itu harus menjadi apa.
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
            <p className="section-label">Introduction before chat</p>
            <h2 className="section-title mt-4 max-w-lg">
              Percakapan dimulai dengan alasan untuk saling mengenal.
            </h2>
          </div>
          <p className="max-w-xl text-lg leading-8 text-brand-muted md:justify-self-end md:pt-8">
            Tidak ada chat tiba-tiba. Kamu mengirim perkenalan, penerima memilih
            untuk membalas, lalu ruang privat anonim baru dibuka.
          </p>
        </div>

        <ol className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
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
          <p className="section-label text-[#8DB9F6]">Progressive privacy</p>
          <h2 className="mt-5 max-w-lg font-heading text-3xl font-semibold leading-tight sm:text-4xl lg:text-[2.75rem]">
            Identitas dibuka perlahan, hanya dengan persetujuan bersama.
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/65">
            Nama lengkap, media sosial, nomor telepon, email, dan lokasi presisi
            tetap tersembunyi. Nama depan dan foto jelas baru muncul setelah ada
            minat dua arah.
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
                <p className="font-semibold">Mahasiswa #274</p>
                <p className="mt-1 text-xs text-white/45">Identitas &amp; kontak disembunyikan</p>
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
    ["Study Circle", "Kelompok kecil untuk belajar rutin, menyelesaikan target, dan menjaga ritme bersama."],
    ["Open Table", "Meja terbuka bertema tertentu yang bisa diikuti mahasiswa untuk belajar atau mengobrol."],
    ["Campus circles", "Kelompok kampus kecil, lingkaran networking, serta opsi women-only atau verified-only."],
  ];

  return (
    <section id="groups" className="scroll-mt-20 bg-brand-surface py-20 sm:py-28">
      <div className="page-shell">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_0.75fr]">
          <div>
            <p className="section-label">Groups</p>
            <h2 className="section-title mt-5 max-w-2xl">
              Bergabung lewat tujuan bersama, bukan sekadar daftar anggota.
            </h2>
          </div>
          <p className="max-w-lg leading-7 text-brand-muted lg:justify-self-end">
            Pilih kelompok berdasarkan aktivitas, skala, dan batas komunitas
            yang membuatmu nyaman.
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
                6–10 anggota · verified-only
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
    "Acara karier & networking",
  ];

  return (
    <section id="events" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="page-shell grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <p className="section-label">Campus Events</p>
          <h2 className="section-title mt-4 max-w-md">
            Temukan kegiatan yang memberimu alasan untuk hadir dan terhubung.
          </h2>
          <p className="mt-5 max-w-md leading-7 text-brand-muted">
            Jelajahi aktivitas kampus berdasarkan minat, tujuan, dan lingkungan
            yang ingin kamu kenal lebih jauh.
          </p>
          <a
            href="#mulai"
            className="focus-ring mt-7 inline-flex items-center gap-2 font-semibold text-brand-blue"
          >
            Jelajahi Campus Events
            <ArrowRight className="h-4 w-4" />
          </a>
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
          Online first
        </p>
        <div>
          <h2 className="max-w-4xl font-heading text-3xl font-medium leading-[1.35] tracking-[-0.025em] text-brand-navy sm:text-4xl lg:text-[2.75rem]">
            Kenal secara online lebih dulu. Bangun konteks, batas, dan rasa
            percaya sebelum mempertimbangkan pertemuan.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-brand-muted">
            Pertemuan offline bukan tujuan wajib. Koneksi dapat tetap online,
            berkembang menjadi kerja sama, pertemanan, networking, hubungan
            dekat, atau bergerak ke arah lain yang disepakati bersama.
          </p>
        </div>
      </div>
    </section>
  );
}

function OfflineSafety() {
  const allowed = [
    "Perpustakaan",
    "Area publik kampus",
    "Kafe atau coffee shop",
    "Coworking space",
    "Food court",
    "Lobi kantor atau venue publik",
  ];
  return (
    <section id="keamanan" className="scroll-mt-20 bg-white py-20 sm:py-32">
      <div className="page-shell">
        <div className="grid gap-6 md:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="section-label">Keamanan offline</p>
            <h2 className="section-title mt-4 max-w-lg">
              Jika bertemu, pilih ruang publik dan pertahankan kendali.
            </h2>
          </div>
          <p className="max-w-xl text-lg leading-8 text-brand-muted md:justify-self-end md:pt-8">
            Tidak ada pertemuan yang bebas risiko. Beri tahu orang tepercaya,
            atur transportasi sendiri, dan tinggalkan situasi kapan pun kamu
            merasa tidak nyaman.
          </p>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="border-t-2 border-brand-blue pt-5">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-brand-blue" aria-hidden="true" />
              <h3 className="font-heading text-xl font-semibold text-brand-navy">
                Pilih lokasi ini
              </h3>
            </div>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {allowed.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-brand-navy/75">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t-2 border-brand-navy pt-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-brand-navy" aria-hidden="true" />
              <h3 className="font-heading text-xl font-semibold text-brand-navy">
                Bertemu di tempat umum
              </h3>
            </div>
            <p className="mt-5 max-w-xl text-sm leading-6 text-brand-navy/75">
              Pilih lokasi yang ramai, terang, mudah diakses, dan masih
              beroperasi—seperti area publik kampus, perpustakaan, kafe, atau
              coworking space.
            </p>
            <p className="mt-4 text-sm font-semibold text-brand-navy">
              Pertemuan di lokasi pribadi tidak diperbolehkan.
            </p>
          </div>
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
                Temukan orang, kelompok, dan kegiatan yang membuat kehidupan
                kampus terasa lebih terhubung.
              </h2>
              <p className="mt-5 leading-7 text-white/70">
                Ikuti kabar StudyDate ID dan jadilah bagian dari akses awal
                platform social-discovery untuk mahasiswa.
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

function Footer() {
  return (
    <footer className="border-t border-brand-border bg-white">
      <div className="page-shell flex flex-col gap-8 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <BrandLogo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-brand-muted">
            Platform social-discovery mahasiswa untuk menemukan people, groups,
            dan campus events.
          </p>
        </div>
        <div className="text-sm text-brand-muted sm:text-right">
          <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Legal dan bantuan">
            {footerLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="focus-ring transition-colors hover:text-brand-navy"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <p className="mt-5">
            © 2026 StudyDate ID · Mulai dari belajar. Kenal perlahan.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <EarlyAccessProvider>
      <Navbar />
      <main>
        <Hero />
        <PillarsOverview />
        <MascotCompanion />
        <IntroductionFlow />
        <ProgressivePrivacy />
        <Groups />
        <CampusEvents />
        <OnlineFirst />
        <OfflineSafety />
        <EarlyAccessCTA />
      </main>
      <Footer />
    </EarlyAccessProvider>
  );
}
