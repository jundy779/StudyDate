import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col bg-white">
      <div className="page-shell flex flex-1 flex-col justify-center py-16 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div>
            <p className="font-heading text-6xl font-semibold tracking-[-0.04em] text-brand-blue sm:text-7xl">
              404
            </p>
            <h1 className="mt-4 font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl">
              Halaman belum ditemukan
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
              Tenang—maskot StudyDate siap mengarahkanmu kembali ke tempat yang
              tepat.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/"
                className="focus-ring inline-flex min-h-12 items-center rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white transition-colors hover:bg-[#013FC7]"
              >
                Ke beranda
              </Link>
              <Link
                href="/app"
                className="focus-ring inline-flex min-h-12 items-center rounded-xl border border-brand-border px-5 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-blue hover:text-brand-blue"
              >
                Ruang mahasiswa
              </Link>
              <Link
                href="/help"
                className="focus-ring inline-flex min-h-12 items-center rounded-xl border border-brand-border px-5 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-blue hover:text-brand-blue"
              >
                Bantuan
              </Link>
            </div>
          </div>
          <div className="relative mx-auto flex min-h-[320px] w-full max-w-[380px] items-center justify-center overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_50%_18%,#ffffff_0%,#edf4ff_55%,#dce9fb_100%)] sm:min-h-[380px] sm:max-w-[440px] lg:min-h-[440px] lg:max-w-[500px]">
            <Image
              src="/brand/mascot/hello.png"
              alt="Maskot StudyDate melambaikan tangan"
              width={276}
              height={346}
              priority
              className="h-auto w-[225px] object-contain drop-shadow-[0_16px_28px_rgba(15,27,51,0.14)] sm:w-[270px] lg:w-[320px]"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
