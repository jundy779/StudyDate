import { getAuthenticatedUser } from "@/lib/auth/session";
import { PUBLIC_DOC_ROUTES } from "@/lib/marketing/public-routes";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

function GuestHeaderActions() {
  return (
    <>
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <Link
          href="/"
          className="focus-ring inline-flex rounded-lg"
          aria-label="Kembali ke halaman utama StudyDate"
        >
          <Image
            src="/brand/logo-horizontal-color.png"
            alt="StudyDate ID"
            width={180}
            height={42}
            className="h-auto w-[148px] sm:w-[168px]"
            priority
          />
        </Link>
      </div>
      <Link
        href="/login"
        className="focus-ring rounded-full border border-brand-border px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:border-brand-blue hover:text-brand-blue"
      >
        Masuk
      </Link>
    </>
  );
}

async function AuthAwareHeaderActions() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return <GuestHeaderActions />;
  }

  return (
    <>
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <Link
          href="/app"
          className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-brand-border px-3.5 py-2 text-sm font-medium text-brand-navy transition-colors hover:border-brand-blue hover:text-brand-blue"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Kembali
        </Link>
        <Link
          href="/app"
          className="focus-ring inline-flex rounded-lg"
          aria-label="Kembali ke ruang mahasiswa StudyDate"
        >
          <Image
            src="/brand/logo-horizontal-color.png"
            alt="StudyDate ID"
            width={180}
            height={42}
            className="h-auto w-[148px] sm:w-[168px]"
            priority
          />
        </Link>
      </div>
      <Link
        href="/app"
        className="focus-ring rounded-full border border-brand-border px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:border-brand-blue hover:text-brand-blue"
      >
        Beranda
      </Link>
    </>
  );
}

export function PublicDocShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col overflow-x-clip bg-white">
      <header className="border-b border-brand-border bg-white">
        <div className="page-shell flex items-center justify-between gap-4 py-4 sm:py-5">
          <Suspense fallback={<GuestHeaderActions />}>
            <AuthAwareHeaderActions />
          </Suspense>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-auto border-t border-brand-border bg-white">
        <div className="page-shell flex flex-col gap-6 py-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-heading text-base font-semibold text-brand-navy">
              StudyDate ID
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-brand-muted">
              Mulai dari belajar. Kenal perlahan.
            </p>
          </div>
          <div className="text-sm text-brand-muted sm:text-right">
            <nav
              className="flex flex-wrap gap-x-5 gap-y-2 sm:justify-end"
              aria-label="Legal dan bantuan"
            >
              {PUBLIC_DOC_ROUTES.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className="focus-ring transition-colors hover:text-brand-navy"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <p className="mt-4">
              © 2026 StudyDate ID · Mulai dari belajar. Kenal perlahan.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
