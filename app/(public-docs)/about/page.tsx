import { JsonLd } from "@/components/marketing/json-ld";
import { breadcrumbJsonLd } from "@/lib/marketing/structured-data";
import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { MascotHead } from "@/components/brand/mascot-head";
import {
  HandNote,
  PageHero,
  stickerButtonPrimary,
  stickerButtonSecondary,
  WaveEdge,
} from "@/components/marketing/brand-ui";

const description =
  "Kenali alasan StudyDate ID dibangun, cara kerjanya saat ini, dan peluang kolaborasi untuk lingkungan kampus.";

export const metadata: Metadata = {
  title: "Tentang StudyDate ID",
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    title: "Tentang StudyDate ID",
    description,
    url: "/about",
    type: "website",
  },
  robots: { index: true, follow: true },
};

const doors = [
  {
    title: "Cari teman",
    copy: "Temukan mahasiswa lewat minat, kampus, dan alasan mereka ingin berteman.",
    href: "/#people",
  },
  {
    title: "Gabung circle",
    copy: "Belajar, berdiskusi, atau mengerjakan proyek bersama dalam kelompok kecil.",
    href: "/#groups",
  },
  {
    title: "Ikut acara",
    copy: "Cari kegiatan kampus yang sesuai minat, waktu, dan lingkunganmu.",
    href: "/events",
  },
];

const privacyPromises = [
  "Profil awal tanpa nama asli, foto jelas, atau kontak.",
  "Obrolan baru terbuka setelah perkenalan diterima.",
  "Nama dan foto dibuka kalau kalian berdua setuju.",
  "Telegram, Instagram, atau LinkedIn dibagikan satu per satu.",
];

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "StudyDate ID", path: "/" },
          { name: "Tentang", path: "/about" },
        ])}
      />

      <article>
        <PageHero
          note="Tentang StudyDate ID"
          title="Membantu mahasiswa memulai koneksi tanpa perlu terburu-buru."
          mascot="senang"
        >
          StudyDate mempertemukan mahasiswa lewat kesamaan di kampus. Kamu bisa mencari
          teman belajar, bergabung dalam circle kecil, atau menemukan acara kampus tanpa
          langsung membagikan nama asli dan kontak pribadi.
        </PageHero>

        <section className="page-shell py-16 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <h2 className="section-title">
              Banyak mahasiswa ingin terhubung, tetapi bingung memulainya.
            </h2>
            <div className="space-y-5 text-base leading-8 text-brand-muted sm:text-lg">
              <p>
                Lingkungan kampus penuh dengan calon teman belajar, rekan proyek,
                komunitas, dan kegiatan. Namun memulai obrolan dengan orang baru
                sering terasa canggung, apalagi jika harus langsung membuka
                identitas atau kontak pribadi.
              </p>
              <p>
                StudyDate memberi gambaran sebelum percakapan dimulai: apa yang
                sedang dipelajari, minat yang sama, dan alasan ingin berkenalan.
                Obrolan baru terbuka setelah perkenalan diterima.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-brand-surface">
          <WaveEdge fill="#FFFFFF" flip />
          <div className="page-shell py-14 sm:py-20">
            <h2 className="section-title max-w-2xl">
              Satu tempat untuk koneksi yang tumbuh dari kegiatan kampus.
            </h2>
            <ul className="mt-10 divide-y-2 divide-brand-navy/10 border-y-2 border-brand-navy/10">
              {doors.map((door) => (
                <li key={door.title}>
                  <Link
                    href={door.href}
                    className="focus-ring group grid gap-2 py-6 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:items-center sm:gap-8"
                  >
                    <span className="font-heading text-2xl font-semibold text-brand-navy">
                      {door.title}
                    </span>
                    <span className="max-w-xl leading-7 text-brand-muted">{door.copy}</span>
                    <ArrowRight
                      className="hidden h-5 w-5 text-brand-blue transition-transform group-hover:translate-x-1 sm:block"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="relative overflow-hidden bg-brand-navy text-white">
          <WaveEdge fill="#F7F9FC" flip />
          <div className="page-shell grid gap-12 pb-20 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <HandNote tone="light">Yang membedakan.</HandNote>
              <h2 className="mt-3 max-w-xl font-heading text-3xl font-semibold leading-tight sm:text-4xl">
                Privasi dibangun sejak awal, bukan hanya pilihan di pengaturan.
              </h2>
              <ul className="mt-8 space-y-4 text-base text-white/80">
                {privacyPromises.map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#8DB9F6]" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mx-auto w-48 sm:w-60">
              <MascotHead expression="kedip" />
            </div>
          </div>
        </section>

        <section className="page-shell py-16 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="section-title">Mulai dari kebutuhan utama, lalu tumbuh dengan terarah.</h2>
              <p className="mt-5 leading-8 text-brand-muted">
                Pada tahap awal, StudyDate berfokus pada mencari teman, mengirim
                perkenalan, mengobrol tanpa nama asli, lalu membagikan nama, foto,
                dan kontak secara bertahap. Circle belajar dan acara kampus memberi
                lebih banyak alasan untuk kembali dan membangun koneksi.
              </p>
            </div>
            <div className="self-start rounded-2xl bg-[#FFF6C7] p-7 shadow-[0_10px_24px_rgba(15,27,51,0.08)] [rotate:-1deg]">
              <h3 className="font-heading text-xl font-semibold text-brand-navy">
                Status pengembangan yang transparan
              </h3>
              <p className="mt-4 leading-7 text-brand-navy/75">
                Fitur yang sudah dibuat belum tentu langsung dibuka untuk semua
                pengguna. Setiap fitur baru diaktifkan setelah penyimpanan data,
                pengaturan, keamanan, dan alur penggunanya selesai diperiksa.
              </p>
              <p className="mt-4 font-hand text-lg text-brand-navy">
                Tidak memakai jumlah pengguna, testimoni, atau klaim pertumbuhan fiktif.
              </p>
            </div>
          </div>
        </section>

        <section className="notebook-paper border-t border-brand-border py-16 sm:py-20">
          <div className="page-shell grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="section-title max-w-2xl">
                Dibangun untuk mahasiswa, dengan peluang kolaborasi bersama ekosistem kampus.
              </h2>
              <p className="mt-5 max-w-2xl leading-8 text-brand-muted">
                Fitur inti keamanan dan privasi tetap tersedia untuk semua
                pengguna. Paket Plus dirancang untuk fitur tambahan, bukan untuk
                menjual rasa aman. Kami terbuka untuk masukan dari mahasiswa,
                komunitas, penyelenggara acara, kampus, dan mitra yang sejalan.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row lg:flex-col">
              <Link href="/#mulai" className={stickerButtonPrimary}>
                Daftar Akses Awal
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/help" className={stickerButtonSecondary}>
                Lihat bantuan dan kontak
              </Link>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
