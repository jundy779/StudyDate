"use client";

import Link from "next/link";

export default function MessagesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-svh overflow-x-clip bg-brand-surface">
      <div className="page-shell py-16 text-center">
        <h1 className="font-heading text-3xl font-semibold text-brand-navy">
          Pesan belum dapat dimuat
        </h1>
        <p className="mx-auto mt-3 max-w-md text-brand-muted">
          Terjadi gangguan sementara. Coba muat ulang atau kembali ke People.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
          >
            Muat ulang
          </button>
          <Link
            href="/app/people"
            className="focus-ring inline-flex min-h-11 items-center rounded-xl border border-brand-border bg-white px-5 text-sm font-semibold text-brand-navy"
          >
            Ke People
          </Link>
        </div>
      </div>
    </main>
  );
}
