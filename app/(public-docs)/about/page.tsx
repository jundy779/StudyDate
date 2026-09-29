import { JsonLd } from "@/components/marketing/json-ld";
import { breadcrumbJsonLd } from "@/lib/marketing/structured-data";
import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarDays,
  LockKeyhole,
  MessageCircle,
  Users,
} from "lucide-react";
import Link from "next/link";

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

const entryPoints = [
  {
    icon: Users,
    title: "Cari teman",
    copy: "Temukan mahasiswa lewat minat, kampus, dan alasan mereka ingin berteman.",
  },
  {
    icon: MessageCircle,
    title: "Gabung circle",
    copy: "Belajar, berdiskusi, atau mengerjakan proyek bersama dalam kelompok kecil.",
  },
  {
    icon: CalendarDays,
    title: "Ikut acara",
    copy: "Cari kegiatan kampus yang sesuai minat, waktu, dan lingkunganmu.",
  },
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
        <section className="border-b border-brand-border bg-brand-surface py-14 sm:py-20">
          <div className="page-shell grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="section-label">Tentang StudyDate ID</p>
              <h1 className="mt-4 max-w-3xl font-heading text-4xl font-semibold leading-tight tracking-[-0.035em] text-brand-navy sm:text-5xl">
                Membantu mahasiswa memulai koneksi tanpa perlu terburu-buru.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-brand-muted">
                StudyDate mempertemukan mahasiswa lewat kesamaan di kampus.
                Kamu bisa mencari teman belajar, bergabung dalam circle kecil,
                atau menemukan acara kampus tanpa langsung membagikan nama asli
                dan kontak pribadi.
              </p>
            </div>
            <div className="border-l-2 border-brand-blue pl-6">
              <p className="font-heading text-xl font-semibold leading-8 text-brand-navy">
                Mulai dari kesamaan di kampus. Kenalan tanpa perlu terburu-buru.
              </p>
            </div>
          </div>
        </section>

        <section className="page-shell py-16 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="section-label">Masalah yang ingin diselesaikan</p>
              <h2 className="section-title mt-4">
                Banyak mahasiswa ingin terhubung, tetapi bingung memulainya.
              </h2>
            </div>
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

        <section className="border-y border-brand-border bg-white py-16 sm:py-20">
          <div className="page-shell">
            <p className="section-label">Tiga cara untuk memulai</p>
            <h2 className="section-title mt-4 max-w-2xl">
              Satu produk untuk koneksi yang tumbuh dari kegiatan kampus.
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {entryPoints.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[20px] border border-brand-border bg-brand-surface p-6"
                >
                  <item.icon className="h-6 w-6 text-brand-blue" aria-hidden />
                  <h3 className="mt-5 font-heading text-xl font-semibold text-brand-navy">
                    {item.title}
                  </h3>
                  <p className="mt-3 leading-7 text-brand-muted">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-brand-navy py-16 text-white sm:py-20">
          <div className="page-shell grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <LockKeyhole className="h-8 w-8 text-[#8DB9F6]" aria-hidden />
              <p className="section-label mt-6 text-[#8DB9F6]">Yang membedakan</p>
              <h2 className="mt-4 font-heading text-3xl font-semibold leading-tight sm:text-4xl">
                Privasi dibangun sejak awal, bukan hanya pilihan di pengaturan.
              </h2>
            </div>
            <div className="space-y-5 text-lg leading-8 text-white/70">
              <p>
                Profil awal tidak menampilkan nama asli, foto jelas, atau kontak.
                Pengguna mengirim perkenalan, mengobrol setelah diterima, lalu
                memilih bersama apakah ingin membagikan nama dan foto.
              </p>
              <p>
                Setelah itu pun, setiap kontak seperti Telegram, Instagram, atau
                LinkedIn tetap dibagikan satu per satu dengan persetujuan kedua pihak.
              </p>
            </div>
          </div>
        </section>

        <section className="page-shell py-16 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="section-label">Fokus awal</p>
              <h2 className="section-title mt-4">Mulai dari kebutuhan utama, lalu tumbuh dengan terarah.</h2>
              <p className="mt-5 leading-8 text-brand-muted">
                Pada tahap awal, StudyDate berfokus pada mencari teman, mengirim
                perkenalan, mengobrol tanpa nama asli, lalu membagikan nama, foto,
                dan kontak secara bertahap. Circle belajar dan acara kampus memberi
                lebih banyak alasan untuk kembali dan membangun koneksi.
              </p>
            </div>
            <div className="rounded-[24px] border border-brand-border bg-brand-surface p-7">
              <h3 className="font-heading text-xl font-semibold text-brand-navy">
                Status pengembangan yang transparan
              </h3>
              <p className="mt-4 leading-7 text-brand-muted">
                Fitur yang sudah dibuat belum tentu langsung dibuka untuk semua
                pengguna. Setiap fitur baru diaktifkan setelah penyimpanan data,
                pengaturan, keamanan, dan alur penggunanya selesai diperiksa.
              </p>
              <p className="mt-4 text-sm font-semibold text-brand-blue">
                Tidak memakai jumlah pengguna, testimoni, atau klaim pertumbuhan fiktif.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-brand-border bg-brand-surface py-16 sm:py-20">
          <div className="page-shell grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <p className="section-label">Model dan kolaborasi</p>
              <h2 className="section-title mt-4 max-w-2xl">
                Dibangun untuk mahasiswa, dengan peluang kolaborasi bersama ekosistem kampus.
              </h2>
              <p className="mt-5 max-w-2xl leading-8 text-brand-muted">
                Fitur inti keamanan dan privasi tetap tersedia untuk semua
                pengguna. Paket Plus dirancang untuk fitur tambahan, bukan untuk
                menjual rasa aman. Kami terbuka untuk masukan dari mahasiswa,
                komunitas, penyelenggara acara, kampus, dan mitra yang sejalan.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/#beranda"
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-[12px] bg-brand-blue px-6 py-4 font-semibold text-white transition-colors hover:bg-[#013FC7]"
              >
                Daftar Akses Awal
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/help"
                className="focus-ring inline-flex items-center justify-center rounded-[12px] border border-brand-border bg-white px-6 py-4 font-semibold text-brand-navy transition-colors hover:border-brand-navy"
              >
                Lihat bantuan dan kontak
              </Link>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
