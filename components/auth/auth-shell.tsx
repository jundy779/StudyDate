import Image from "next/image";
import Link from "next/link";
import { MascotHead } from "@/components/brand/mascot-head";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="notebook-paper relative min-h-svh overflow-x-clip px-5 py-8 sm:px-8 sm:py-10 lg:flex lg:items-center lg:justify-center lg:py-14">
      <span className="notebook-margin hidden sm:block" aria-hidden="true" />
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
        <div className="relative">
          <div className="absolute -top-[3.9rem] right-6 w-20 sm:-top-[4.6rem] sm:w-24" aria-hidden="true">
            <MascotHead expression="penasaran" />
          </div>
          <section className="relative rounded-[24px] border-2 border-brand-navy bg-white p-6 shadow-[6px_6px_0_#0F1B33] sm:p-9">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
