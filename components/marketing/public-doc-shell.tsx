import { EarlyAccessProvider } from "@/components/marketing/early-access-dialog";
import { PublicNavbar } from "@/components/marketing/landing-page";
import { PublicFooter } from "@/components/marketing/public-footer";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

async function PublicHeader() {
  // Public documents must remain available when auth is not configured or is temporarily unavailable.
  const user = await getAuthenticatedUser().catch(() => null);
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

      <PublicFooter />
    </div>
  );
}
