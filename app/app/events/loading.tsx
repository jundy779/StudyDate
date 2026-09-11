import { ResponsiveNavigation } from "@/components/navigation/responsive-navigation";

export default function EventsLoading() {
  return (
    <ResponsiveNavigation variant="student" current="events">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div
          role="status"
          aria-label="Memuat acara kampus"
          aria-busy="true"
          className="page-shell py-8 sm:py-12 lg:py-16"
        >
          <div className="h-4 w-28 animate-pulse rounded bg-brand-border motion-reduce:animate-none" />
          <div className="mt-4 h-12 max-w-2xl animate-pulse rounded-xl bg-brand-border motion-reduce:animate-none" />
          <div className="mt-4 h-5 max-w-xl animate-pulse rounded bg-brand-border motion-reduce:animate-none" />
          <div className="mt-10 space-y-5 rounded-[22px] border border-brand-border bg-white p-6">
            {[0, 1, 2].map((item) => (
              <div key={item} className="border-b border-brand-border pb-5 last:border-0">
                <div className="h-6 w-2/5 animate-pulse rounded bg-brand-border motion-reduce:animate-none" />
                <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-brand-surface motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </ResponsiveNavigation>
  );
}
