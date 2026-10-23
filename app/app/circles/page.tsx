import { requireSocialFeatureAccess } from "@/lib/account/student-access";
import { AppShell } from "@/components/app/app-shell";
import { AppPage, Notice, Panel, appButton } from "@/components/app/ui";
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
  await requireSocialFeatureAccess();
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
      <AppPage
        kicker="Circle Belajar"
        title="Belajar bareng lewat topik yang kamu suka"
        description="Temukan kelompok belajar kecil, ikut berdiskusi, dan kenalan lewat kegiatan yang sama. Nama asli dan kontakmu tetap privat."
        mascot="girang"
        actions={
          <Link href="/app/circles/create" className={appButton.primary}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Buat Circle
          </Link>
        }
      >
          <Panel
            id="circle-filter"
            title="Cari berdasarkan konteks"
            description="Gunakan nama, topik, atau cakupan. Tidak ada peringkat popularitas."
          >
            <CircleFilterForm filters={filters} />
            {!parsed.success ? (
              <div className="mt-4">
                <Notice tone="danger">Filter tidak valid. Hapus filter lalu coba lagi.</Notice>
              </div>
            ) : null}
          </Panel>

          <section aria-labelledby="circle-results-title">
            <div className="max-w-2xl">
              <p className="app-kicker">Circle yang dapat ditemukan</p>
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
                  className={appButton.secondary}
                >
                  Muat lebih banyak
                </Link>
              </div>
            ) : null}
          </section>
      </AppPage>
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
