import { AppShell } from "@/components/app/app-shell";
import { MascotEmptyState } from "@/components/brand/mascot-empty-state";
import { CircleFilterForm } from "@/components/circles/circle-filter-form";
import { CircleListItem } from "@/components/circles/circle-list-item";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { listCircles } from "@/lib/circles/service";
import { parseCircleFilters } from "@/lib/circles/validation";
import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

type CirclesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function paginationHref(
  filters: Record<string, string | undefined>,
  cursor: { before: string; cursor: string },
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  params.set("before", cursor.before);
  params.set("cursor", cursor.cursor);
  return `/app/circles?${params.toString()}`;
}

async function CirclesContent({ searchParams }: CirclesPageProps) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const rawSearchParams = await searchParams;
  const parsed = parseCircleFilters(rawSearchParams);
  const filters = parsed.success ? parsed.data : {};
  const result = parsed.success
    ? await listCircles(parsed.data)
    : { circles: [], nextCursor: null };

  return (
    <AppShell current="circles">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell py-8 sm:py-12 lg:py-16">
          <header className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="section-label">Circle Belajar</p>
              <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.035em] text-brand-navy sm:text-5xl">
                Belajar bareng lewat topik yang kamu suka
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-muted">
                Temukan kelompok belajar kecil, ikut berdiskusi, dan kenalan lewat kegiatan\n                yang sama. Nama asli dan kontakmu tetap privat.
              </p>
            </div>
            <Link
              href="/app/circles/create"
              className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Buat Circle
            </Link>
          </header>

          <section
            aria-labelledby="circle-filter-title"
            className="mt-10 border-y border-brand-border py-7"
          >
            <h2 id="circle-filter-title" className="font-heading text-xl font-semibold text-brand-navy">
              Cari berdasarkan konteks
            </h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              Gunakan nama, topik, atau cakupan. Tidak ada peringkat popularitas.
            </p>
            <CircleFilterForm filters={filters} />
            {!parsed.success ? (
              <p role="alert" className="mt-4 text-sm font-medium text-brand-error">
                Filter tidak valid. Hapus filter lalu coba lagi.
              </p>
            ) : null}
          </section>

          <section className="mt-10" aria-labelledby="circle-results-title">
            <div className="max-w-2xl">
              <p className="section-label">Circle yang dapat ditemukan</p>
              <h2
                id="circle-results-title"
                className="mt-2 font-heading text-2xl font-semibold text-brand-navy"
              >
                Pilih ruang belajar yang sesuai
              </h2>
            </div>
            {result.circles.length ? (
              <div className="mt-7 rounded-[22px] border border-brand-border bg-white px-5 py-7 sm:px-8">
                {result.circles.map((circle) => (
                  <CircleListItem key={circle.public_slug} circle={circle} />
                ))}
              </div>
            ) : parsed.success ? (
              <div className="mt-7">
                <MascotEmptyState
                  pose="study"
                  title={
                    filters.search || filters.topic || filters.scope
                      ? "Belum ada Circle yang cocok"
                      : "Belum menemukan Circle yang pas?"
                  }
                  description="Coba ubah filter atau mulai Circle kecil untuk topik yang sedang kamu pelajari."
                  action={{ href: "/app/circles/create", label: "Buat Circle" }}
                />
              </div>
            ) : null}
            {result.nextCursor ? (
              <div className="mt-8 flex justify-center">
                <Link
                  href={paginationHref(filters, result.nextCursor)}
                  className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-border bg-white px-6 text-sm font-semibold text-brand-navy"
                >
                  Muat lebih banyak
                </Link>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

export default function CirclesPage(props: CirclesPageProps) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-sm text-brand-muted">
            Menyiapkan Circle Belajar…
          </p>
        </main>
      }
    >
      <CirclesContent {...props} />
    </Suspense>
  );
}
