import { EarlyAccessProvider } from "@/components/marketing/early-access-dialog";
import { PublicNavbar } from "@/components/marketing/landing-page";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { PUBLIC_DOC_ROUTES } from "@/lib/marketing/public-routes";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

async function PublicHeader() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return (
      <EarlyAccessProvider>
        <PublicNavbar static />
      </EarlyAccessProvider>
    );
  }

  return (
    <header className="border-b border-brand-border bg-white">
      <div className="page-shell flex items-center justify-between gap-4 py-4 sm:py-5">
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
      </div>
    </header>
  );
}

export function PublicDocShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col overflow-x-clip bg-white">
      <Suspense
        fallback={
          <EarlyAccessProvider>
            <PublicNavbar static />
          </EarlyAccessProvider>
        }
      >
        <PublicHeader />
      </Suspense>

      <main className="flex-1">{children}</main>

      <footer className="mt-auto border-t border-brand-border bg-white">
        <div className="page-shell flex flex-col gap-6 py-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-heading text-base font-semibold text-brand-navy">
              StudyDate ID
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-brand-muted">
              Kenalan tanpa perlu terburu-buru.
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
              © 2026 StudyDate ID · Kenalan tanpa perlu terburu-buru.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
