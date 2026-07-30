import Image from "next/image";
import Link from "next/link";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-svh overflow-x-clip bg-brand-surface px-5 py-8 sm:px-8 sm:py-10 lg:flex lg:items-center lg:justify-center lg:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full border-[48px] border-brand-blue/[0.06]"
      />
      <div className="relative mx-auto w-full max-w-[520px]">
        <Link
          href="/"
          className="focus-ring mb-8 inline-flex rounded-lg sm:mb-10"
          aria-label="Kembali ke halaman utama StudyDate"
        >
          <Image
            src="/brand/logo-horizontal-color.png"
            alt="StudyDate ID"
            width={180}
            height={42}
            className="h-auto w-[160px] sm:w-[180px]"
            priority
          />
        </Link>
        <section className="rounded-[24px] border border-brand-border bg-white p-6 shadow-[0_24px_70px_rgba(15,27,51,0.10)] sm:p-9">
          {children}
        </section>
      </div>
    </main>
  );
}
