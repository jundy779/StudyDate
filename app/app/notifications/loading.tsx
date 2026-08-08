export default function NotificationsLoading() {
  return (
    <main className="min-h-svh overflow-x-clip bg-brand-surface">
      <div className="page-shell max-w-3xl py-8 sm:py-12 lg:py-16">
        <p className="section-label">Aktivitas penting</p>
        <div className="mt-4 h-10 w-48 animate-pulse rounded-xl bg-brand-border motion-reduce:animate-none" />
        <div className="mt-3 h-5 w-full max-w-md animate-pulse rounded-lg bg-brand-border motion-reduce:animate-none" />
        <section
          role="status"
          aria-label="Memuat notifikasi"
          aria-busy="true"
          aria-live="polite"
          className="mt-8 overflow-hidden rounded-2xl border border-brand-border bg-white"
        >
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="flex gap-3 border-b border-brand-border px-5 py-5 last:border-0"
            >
              <div className="h-10 w-10 animate-pulse rounded-xl bg-brand-surface motion-reduce:animate-none" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/5 animate-pulse rounded bg-brand-border motion-reduce:animate-none" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-brand-surface motion-reduce:animate-none" />
                <div className="h-3 w-1/4 animate-pulse rounded bg-brand-surface motion-reduce:animate-none" />
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
