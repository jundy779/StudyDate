export default function IntroductionsLoading() {
  return (
    <main
      className="min-h-svh overflow-x-clip bg-brand-surface"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="page-shell py-8 sm:py-12">
        <p className="sr-only">Memuat perkenalan…</p>
        <div className="h-4 w-32 animate-pulse rounded bg-brand-border/70 motion-reduce:animate-none" />
        <div className="mt-4 h-10 w-56 animate-pulse rounded bg-brand-border/70 motion-reduce:animate-none" />
        <div className="mt-8 space-y-4">
          <div className="h-40 animate-pulse rounded-[22px] bg-white motion-reduce:animate-none" />
          <div className="h-40 animate-pulse rounded-[22px] bg-white motion-reduce:animate-none" />
        </div>
      </div>
    </main>
  );
}
