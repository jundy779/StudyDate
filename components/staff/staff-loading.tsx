/**
 * Kerangka sementara saat pindah menu di Ruang Operasional. Muncul seketika setelah klik,
 * supaya tidak terasa macet sambil menunggu data dari server.
 */
export function StaffLoading() {
  const bar = "animate-pulse rounded bg-brand-border motion-reduce:animate-none";
  return (
    <div className="min-h-svh bg-brand-surface lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="hidden h-svh flex-col gap-4 border-r-2 border-brand-navy/10 bg-white px-5 py-6 lg:flex" aria-hidden="true">
        <div className={`h-8 w-36 ${bar}`} />
        {[0, 1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className={`h-9 w-full ${bar} opacity-60`} />
        ))}
      </aside>
      <main className="min-w-0">
        <div className="h-16 border-b border-brand-border bg-white lg:hidden" aria-hidden="true" />
        <div role="status" aria-label="Memuat halaman" aria-busy="true" className="page-shell py-8 sm:py-12">
          <div className={`h-5 w-32 ${bar}`} />
          <div className={`mt-3 h-10 max-w-md ${bar}`} />
          <div className={`mt-4 h-5 max-w-2xl ${bar} opacity-60`} />
          <div className="mt-8 grid gap-6">
            {[0, 1].map((item) => (
              <div key={item} className="rounded-[22px] border border-brand-border bg-white p-6">
                <div className={`h-6 w-48 ${bar}`} />
                <div className={`mt-4 h-4 w-4/5 ${bar} opacity-60`} />
                <div className={`mt-3 h-4 w-3/5 ${bar} opacity-60`} />
              </div>
            ))}
          </div>
          <span className="sr-only">Memuat halaman...</span>
        </div>
      </main>
    </div>
  );
}
