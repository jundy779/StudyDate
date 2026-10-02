import {
  updatePeopleVisibility,
  updateStudyStatus,
} from "@/app/app/people/actions";
import { AppShell } from "@/components/app/app-shell";
import { MascotEmptyState } from "@/components/brand/mascot-empty-state";
import { PeopleFilterForm } from "@/components/people/people-filter-form";
import { PeopleProfileCard } from "@/components/people/people-profile-card";
import { buildSharedStudentContext } from "@/lib/people/shared-context";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  getOwnDiscoveryVisibility,
  getOwnStudyStatus,
  listDiscoveryProfiles,
} from "@/lib/people/service";
import { getMyMembership } from "@/lib/membership/resolver";
import { getMembershipLimits } from "@/lib/membership/limits";
import { STUDY_STATUS_OPTIONS } from "@/lib/people/study-status";
import {
  firstSearchValue,
  parsePeopleFilters,
} from "@/lib/people/validation";
import { Clock3, Eye, EyeOff } from "lucide-react";
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
  const ownStudyStatus = await getOwnStudyStatus();
  const membership = await getMyMembership();
  const limits = getMembershipLimits(membership.plan);
  const visibilityNotice = firstSearchValue(rawSearchParams.visibility);
  const studyStatusNotice = firstSearchValue(rawSearchParams.studyStatus);

  const filters = parsed.success ? parsed.data : {};
  let result = { profiles: [] as Awaited<ReturnType<typeof listDiscoveryProfiles>>["profiles"], nextCursor: null as string | null };
  let quotaReached = false;
  if (parsed.success) {
    try {
      result = await listDiscoveryProfiles(parsed.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("quota")) {
        quotaReached = true;
      } else {
        throw error;
      }
    }
  }

  return (
    <AppShell current="people">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
      <div className="page-shell py-8 sm:py-12 lg:py-16">
        <section className="grid gap-7 lg:grid-cols-[1fr_360px] lg:items-end">
          <div className="max-w-3xl">
            <p className="section-label">Cari yang nyambung</p>
            <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.035em] text-brand-navy sm:text-5xl">
              Temukan orang yang punya kesamaan denganmu
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-muted">
              Jelajahi profil mahasiswa berdasarkan kampus, minat, dan tujuan koneksi tanpa menampilkan nama asli.
            </p>
          </div>
          <div className="space-y-4">
            <form action={updatePeopleVisibility} className="rounded-[20px] border border-brand-border bg-white p-5 shadow-[0_12px_32px_rgba(15,27,51,0.05)]">
              <div className="flex items-start gap-3">
                {isDiscoverable ? <Eye className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" /> : <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-brand-muted" aria-hidden="true" />}
                <div>
                  <label htmlFor="people-visibility" className="font-semibold text-brand-navy">Tampilkan profil saya di pencarian</label>
                  <p className="mt-1 text-sm leading-6 text-brand-muted">Hanya profil tanpa nama asli yang memilih untuk ditemukan yang akan ditampilkan.</p>
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

            {ownStudyStatus.supported ? (
              <form action={updateStudyStatus} className="rounded-[20px] border border-brand-border bg-white p-5 shadow-[0_12px_32px_rgba(15,27,51,0.05)]">
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" />
                  <div>
                    <label htmlFor="study-status" className="font-semibold text-brand-navy">Lagi ingin cari teman apa?</label>
                    <p className="mt-1 text-sm leading-6 text-brand-muted">Status ini tampil selama 24 jam, lalu hilang sendiri.</p>
                  </div>
                </div>
                <select
                  id="study-status"
                  name="studyStatus"
                  defaultValue={ownStudyStatus.study_status ?? ""}
                  className="focus-ring mt-4 min-h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-navy"
                >
                  <option value="">Tidak pasang status</option>
                  {STUDY_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <button type="submit" className="focus-ring mt-3 min-h-11 w-full rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white">Simpan status</button>
                {(studyStatusNotice === "saved" || studyStatusNotice === "cleared") ? (
                  <p role="status" className="mt-3 text-sm font-medium text-brand-success">Status belajarmu sudah diperbarui.</p>
                ) : (studyStatusNotice === "error" || studyStatusNotice === "invalid") ? (
                  <p role="alert" className="mt-3 text-sm font-medium text-brand-error">Status belum dapat disimpan. Coba lagi.</p>
                ) : null}
              </form>
            ) : null}
          </div>
        </section>

        <section className="mt-10 rounded-[22px] border border-brand-border bg-white p-5 sm:p-7" aria-labelledby="people-filter-title">
          <div>
            <h2 id="people-filter-title" className="font-heading text-xl font-semibold text-brand-navy">Pilih yang kamu cari</h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">Semua pilihan bersifat opsional. Pilih yang paling penting buatmu.</p>
          </div>
          <PeopleFilterForm
            filters={filters}
            advancedEnabled={limits.advancedDiscoveryFilters}
          />
          {!parsed.success && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-brand-error">Pilihan pencarian tidak valid. Hapus pilihan lalu coba lagi.</p>
          )}
        </section>

        <section className="mt-10" aria-labelledby="people-results-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="section-label">Profil yang dapat ditemukan</p>
              <h2 id="people-results-title" className="mt-2 font-heading text-2xl font-semibold tracking-[-0.02em] text-brand-navy">Orang yang bisa kamu kenal</h2>
            </div>
          </div>

          {quotaReached ? (
            <p role="status" className="mt-6 rounded-xl border border-brand-border bg-white px-4 py-3 text-sm leading-6 text-brand-muted">
              Batas pencarian harian paketmu sudah terpakai.{" "}
              <Link href="/app/membership" className="focus-ring font-semibold text-brand-blue underline-offset-2 hover:underline">
                Lihat StudyDate Plus
              </Link>
              .
            </p>
          ) : result.profiles.length ? (
            <>
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {result.profiles.map((profile) => (
                  <PeopleProfileCard
                    key={profile.public_alias}
                    profile={profile}
                    sharedContext={buildSharedStudentContext(ownProfile, profile)}
                  />
                ))}
              </div>
              {result.nextCursor && (
                <div className="mt-8 flex justify-center">
                  <Link href={paginationHref(filters, result.nextCursor)} className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-border bg-white px-6 text-sm font-semibold text-brand-navy hover:border-brand-blue">Muat lebih banyak</Link>
                </div>
              )}
            </>
          ) : parsed.success ? (
            <div className="mt-6">
              <MascotEmptyState
                pose="study"
                title="Belum ada yang cocok"
                description="Coba kurangi beberapa pilihan. Hanya profil yang memilih untuk ditemukan dan sudah menyelesaikan pengaturan awal yang akan muncul."
              />
            </div>
          ) : null}
        </section>
      </div>
      </main>
    </AppShell>
  );
}

export default function PeoplePage(props: PeoplePageProps) {
  return (
    <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-sm text-brand-muted">Menyiapkan pencarian…</p></main>}>
      <PeopleContent {...props} />
    </Suspense>
  );
}
