import type { Metadata } from "next";
import Link from "next/link";
import {
  stickerButtonPrimary,
  stickerButtonSecondary,
} from "@/components/marketing/brand-ui";
import { MascotBuddy } from "@/components/marketing/mascot-buddy";

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="notebook-paper relative flex min-h-svh flex-col overflow-x-clip">
      <span className="notebook-margin hidden sm:block" aria-hidden="true" />
      <div className="page-shell relative flex flex-1 flex-col justify-center py-16 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:gap-16">
          <div className="sm:pl-10 lg:pl-14">
            <p className="font-hand text-2xl text-brand-blue">Halaman 404</p>
            <h1 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.035em] text-brand-navy sm:text-5xl">
              Halaman ini belum ada.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
              Mungkin tautannya salah ketik atau halamannya sudah dipindah. Pilih salah satu
              tujuan di bawah untuk kembali.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/" className={stickerButtonPrimary}>
                Ke beranda
              </Link>
              <Link href="/app" className={stickerButtonSecondary}>
                Ruang mahasiswa
              </Link>
              <Link href="/help" className={stickerButtonSecondary}>
                Bantuan
              </Link>
            </div>
          </div>
          <MascotBuddy
            className="mx-auto w-[min(100%,300px)]"
            greeting="Eh, aku juga nyasar."
            reactions={[
              { expression: "kaget", line: "Halamannya beneran nggak ada." },
              { expression: "mikir", line: "Coba lewat beranda, biasanya ketemu." },
              { expression: "malu", line: "Maaf ya, bukan salahmu kok." },
            ]}
          />
        </div>
      </div>
    </main>
  );
}
