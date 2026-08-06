export default function MessagesLoading() {
  return (
    <main
      className="min-h-svh overflow-x-clip bg-brand-surface"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="page-shell py-8 sm:py-12">
        <p className="sr-only">Memuat pesan…</p>
        <div className="h-4 w-36 animate-pulse rounded bg-brand-border/70 motion-reduce:animate-none" />
        <div className="mt-4 h-10 w-40 animate-pulse rounded bg-brand-border/70 motion-reduce:animate-none" />
        <div className="mt-8 space-y-4">
          <div className="h-28 animate-pulse rounded-[22px] bg-white motion-reduce:animate-none" />
          <div className="h-28 animate-pulse rounded-[22px] bg-white motion-reduce:animate-none" />
        </div>
      </div>
    </main>
  );
}
