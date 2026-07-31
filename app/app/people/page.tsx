import { updatePeopleVisibility } from "@/app/app/people/actions";
import { AppHeader } from "@/components/app/app-header";
import { PeopleFilterForm } from "@/components/people/people-filter-form";
import { PeopleProfileCard } from "@/components/people/people-profile-card";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  getOwnDiscoveryVisibility,
  listDiscoveryProfiles,
} from "@/lib/people/service";
import {
  firstSearchValue,
  parsePeopleFilters,
} from "@/lib/people/validation";
import { Eye, EyeOff, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

type PeoplePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function paginationHref(
  filters: Record<string, string | number | undefined>,
  cursor: string,
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  params.set("after", cursor);
  return `/app/people?${params.toString()}`;
}

async function PeopleContent({ searchParams }: PeoplePageProps) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const ownProfile = await getPrivateProfile(user.id);
  if (!ownProfile?.onboarding_completed_at) redirect("/onboarding");

  const rawSearchParams = await searchParams;
  const parsed = parsePeopleFilters(rawSearchParams);
  const isDiscoverable = await getOwnDiscoveryVisibility(user.id);
  const visibilityNotice = firstSearchValue(rawSearchParams.visibility);

  const filters = parsed.success ? parsed.data : {};
  const result = parsed.success
    ? await listDiscoveryProfiles(parsed.data)
    : { profiles: [], nextCursor: null };

  return (
    <main className="min-h-svh overflow-x-clip bg-brand-surface">
      <AppHeader current="people" />
      <div className="page-shell py-8 sm:py-12 lg:py-16">
        <section className="grid gap-7 lg:grid-cols-[1fr_360px] lg:items-end">
          <div className="max-w-3xl">
            <p className="section-label">People Discovery</p>
            <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.035em] text-brand-navy sm:text-5xl">
              Temukan orang dari konteks yang sama
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-muted">
              Jelajahi profil anonim mahasiswa berdasarkan kampus, minat, dan tujuan koneksi—tanpa membuka identitas privat.
            </p>
          </div>
          <form action={updatePeopleVisibility} className="rounded-[20px] border border-brand-border bg-white p-5 shadow-[0_12px_32px_rgba(15,27,51,0.05)]">
            <div className="flex items-start gap-3">
              {isDiscoverable ? <Eye className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" /> : <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-brand-muted" aria-hidden="true" />}
              <div>
                <label htmlFor="people-visibility" className="font-semibold text-brand-navy">Tampilkan profil saya di People</label>
                <p className="mt-1 text-sm leading-6 text-brand-muted">Hanya profil anonim yang disetujui untuk discovery yang ditampilkan.</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-brand-border pt-4">
              <input id="people-visibility" name="isDiscoverable" type="checkbox" defaultChecked={isDiscoverable} className="focus-ring h-5 w-5 rounded border-brand-border accent-brand-blue" />
              <button type="submit" className="focus-ring min-h-11 rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white">Simpan</button>
            </div>
            {(visibilityNotice === "on" || visibilityNotice === "off") && (
              <p role="status" className="mt-3 text-sm font-medium text-brand-success">Pengaturan visibilitas tersimpan.</p>
            )}
          </form>
        </section>

        <section className="mt-10 rounded-[22px] border border-brand-border bg-white p-5 sm:p-7" aria-labelledby="people-filter-title">
          <div>
            <h2 id="people-filter-title" className="font-heading text-xl font-semibold text-brand-navy">Saring dengan konteks</h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">Semua filter bersifat opsional dan dijalankan di server.</p>
          </div>
          <PeopleFilterForm filters={filters} />
          {!parsed.success && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-brand-error">Filter tidak valid. Hapus filter lalu coba lagi.</p>
          )}
        </section>

        <section className="mt-10" aria-labelledby="people-results-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="section-label">Profil yang dapat ditemukan</p>
              <h2 id="people-results-title" className="mt-2 font-heading text-2xl font-semibold tracking-[-0.02em] text-brand-navy">People</h2>
            </div>
          </div>

          {result.profiles.length ? (
            <>
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {result.profiles.map((profile) => <PeopleProfileCard key={profile.public_alias} profile={profile} />)}
              </div>
              {result.nextCursor && (
                <div className="mt-8 flex justify-center">
                  <Link href={paginationHref(filters, result.nextCursor)} className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-border bg-white px-6 text-sm font-semibold text-brand-navy hover:border-brand-blue">Muat lebih banyak</Link>
                </div>
              )}
            </>
          ) : parsed.success ? (
            <div className="mt-6 grid overflow-hidden rounded-[22px] border border-brand-border bg-white sm:grid-cols-[180px_1fr]">
              <div className="flex min-h-44 items-end justify-center bg-[linear-gradient(145deg,#edf4ff,#f8faff)] p-5">
                <Image src="/brand/mascot/study.png" alt="" width={140} height={140} className="h-32 w-32 object-contain" />
              </div>
              <div className="self-center p-6 sm:p-8">
                <Users className="h-6 w-6 text-brand-blue" aria-hidden="true" />
                <h3 className="mt-4 font-heading text-xl font-semibold text-brand-navy">Belum ada profil yang cocok</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-brand-muted">Coba longgarkan filter. Hanya profil yang memilih tampil di People dan telah menyelesaikan onboarding yang dapat ditemukan.</p>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default function PeoplePage(props: PeoplePageProps) {
  return (
    <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-sm text-brand-muted">Menyiapkan People…</p></main>}>
      <PeopleContent {...props} />
    </Suspense>
  );
}
