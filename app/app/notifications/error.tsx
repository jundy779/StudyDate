"use client";

import { BellOff } from "lucide-react";

export default function NotificationsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-svh overflow-x-clip bg-brand-surface">
      <div className="page-shell max-w-3xl py-8 sm:py-12 lg:py-16">
        <section
          role="alert"
          aria-live="assertive"
          className="rounded-2xl border border-brand-border bg-white px-6 py-14 text-center sm:px-10"
        >
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-surface text-brand-blue">
            <BellOff aria-hidden="true" className="h-6 w-6" />
          </span>
          <h1 className="mt-5 font-heading text-xl font-semibold text-brand-navy">
            Notifikasi belum dapat dimuat
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-brand-muted">
            Coba lagi sebentar. Aktivitas koneksi kamu tetap aman.
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
  );
}
