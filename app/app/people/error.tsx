"use client";

export default function PeopleError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-svh bg-brand-surface px-5 py-16">
      <div className="mx-auto max-w-xl rounded-[22px] border border-brand-border bg-white p-7">
        <h1 className="font-heading text-2xl font-semibold text-brand-navy">People belum dapat dimuat</h1>
        <p className="mt-3 leading-7 text-brand-muted">Coba lagi sebentar. Tidak ada data profil privat yang ditampilkan pada keadaan ini.</p>
        <button type="button" onClick={reset} className="focus-ring mt-6 min-h-11 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white">Coba lagi</button>
      </div>
    </main>
  );
}
