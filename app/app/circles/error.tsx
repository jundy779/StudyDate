"use client";

import { ResponsiveNavigation } from "@/components/navigation/responsive-navigation";
import { UsersRound } from "lucide-react";

export default function CirclesError({ reset }: { reset: () => void }) {
  return (
    <ResponsiveNavigation variant="student" current="circles">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell max-w-3xl py-8 sm:py-12 lg:py-16">
          <section
            role="alert"
            aria-live="assertive"
            className="rounded-[22px] border border-brand-border bg-white px-6 py-14 text-center"
          >
            <UsersRound className="mx-auto h-9 w-9 text-brand-blue" aria-hidden="true" />
            <h1 className="mt-5 font-heading text-2xl font-semibold text-brand-navy">
              Study Circle belum dapat dimuat
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-brand-muted">
              Coba lagi sebentar. Data privat dan keanggotaanmu tidak berubah.
            </p>
            <button
              type="button"
              onClick={reset}
              className="focus-ring mt-5 min-h-11 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
            >
              Coba lagi
            </button>
          </section>
        </div>
      </main>
    </ResponsiveNavigation>
  );
}
