import { requireSocialFeatureAccess } from "@/lib/account/student-access";
import {
  updatePeopleVisibility,
  updateStudyStatus,
} from "@/app/app/people/actions";
import { AppShell } from "@/components/app/app-shell";
import { AppPage, Notice, Panel, StatusChip, appButton, appField } from "@/components/app/ui";
import { MascotEmptyState } from "@/components/brand/mascot-empty-state";
import { PeopleFilterForm } from "@/components/people/people-filter-form";
import { PeopleProfileCard } from "@/components/people/people-profile-card";
import { buildSharedStudentContext } from "@/lib/people/shared-context";
import { sortDiscoveryProfilesBySharedContext } from "@/lib/people/recommendations";
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

function peopleOrderHref(
  filters: Record<string, string | number | undefined>,
  order: "shared" | "default",
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (
      key !== "after" &&
      key !== "order" &&
      value !== undefined &&
      value !== ""
    ) {
      params.set(key, String(value));
    }
  });
  params.set("order", order);
  return `/app/people?${params.toString()}`;
}

async function PeopleContent({ searchParams }: PeoplePageProps) {
  await requireSocialFeatureAccess();
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const ownProfile = await getPrivateProfile(user.id);
  if (!ownProfile?.onboarding_completed_at) redirect("/onboarding");

  const rawSearchParams = await searchParams;
  const parsed = parsePeopleFilters(rawSearchParams);
  // Tiga data ini tidak saling bergantung, jadi diambil bersamaan.
  const [isDiscoverable, ownStudyStatus, membership] = await Promise.all([
    getOwnDiscoveryVisibility(user.id),
    getOwnStudyStatus(),
    getMyMembership(),
  ]);
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

  const selectedOrder = filters.order ?? "shared";
  const visibleProfiles =
    selectedOrder === "shared"
      ? sortDiscoveryProfilesBySharedContext(ownProfile, result.profiles)
      : result.profiles;

  return (
    <AppShell current="people">
      <AppPage
        kicker="Cari yang nyambung"
        title="Temukan orang yang punya kesamaan denganmu"
        description="Jelajahi profil mahasiswa berdasarkan kampus, minat, dan tujuan koneksi tanpa menampilkan nama asli."
        mascot="penasaran"
      >
        <div className="grid gap-4 lg:grid-cols-2">
            <Panel quiet>
            <form action={updatePeopleVisibility}>
              <div className="flex items-start gap-3">
                {isDiscoverable ? <Eye className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" /> : <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-brand-muted" aria-hidden="true" />}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="people-visibility" className="font-semibold text-brand-navy">Tampilkan profil saya di pencarian</label>
                    <StatusChip tone={isDiscoverable ? "go" : "muted"}>{isDiscoverable ? "Tampil" : "Tersembunyi"}</StatusChip>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-brand-muted">Hanya profil tanpa nama asli yang memilih untuk ditemukan yang akan ditampilkan.</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-4 border-t border-brand-border pt-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
                  <input id="people-visibility" name="isDiscoverable" type="checkbox" defaultChecked={isDiscoverable} className="focus-ring h-5 w-5 rounded border-brand-border accent-brand-blue" />
                  Tampilkan
                </label>
                <button type="submit" className={appButton.secondary}>Simpan</button>
              </div>
              {(visibilityNotice === "on" || visibilityNotice === "off") && (
                <div className="mt-3"><Notice tone="success">Pengaturan visibilitas tersimpan.</Notice></div>
              )}
            </form>
            </Panel>

            {ownStudyStatus.supported ? (
              <Panel quiet>
              <form action={updateStudyStatus}>
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" />
                  <div>
                    <label htmlFor="study-status" className="font-semibold text-brand-navy">Lagi ingin cari teman apa?</label>
                    <p className="mt-1 text-sm leading-6 text-brand-muted">Status ini tampil selama 24 jam, lalu hilang sendiri.</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <select
                    id="study-status"
                    name="studyStatus"
                    defaultValue={ownStudyStatus.study_status ?? ""}
                    className={`${appField} mt-0 flex-1`}
                  >
                    <option value="">Tidak pasang status</option>
                    {STUDY_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <button type="submit" className={appButton.primary}>Simpan status</button>
                </div>
                {(studyStatusNotice === "saved" || studyStatusNotice === "cleared") ? (
                  <div className="mt-3"><Notice tone="success">Status belajarmu sudah diperbarui.</Notice></div>
                ) : (studyStatusNotice === "error" || studyStatusNotice === "invalid") ? (
                  <div className="mt-3"><Notice tone="danger">Status belum dapat disimpan. Coba lagi.</Notice></div>
                ) : null}
              </form>
              </Panel>
            ) : null}
        </div>

        <Panel id="people-filter" title="Pilih yang kamu cari" description="Semua pilihan bersifat opsional. Pilih yang paling penting buatmu.">
          <PeopleFilterForm
            filters={filters}
            advancedEnabled={limits.advancedDiscoveryFilters}
          />
          {!parsed.success && (
            <div className="mt-4"><Notice tone="danger">Pilihan pencarian tidak valid. Hapus pilihan lalu coba lagi.</Notice></div>
          )}
        </Panel>

        <section aria-labelledby="people-results-title">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="app-kicker">Profil yang dapat ditemukan</p>
              <h2 id="people-results-title" className="mt-2 font-heading text-2xl font-semibold tracking-[-0.02em] text-brand-navy">Orang yang bisa kamu kenal</h2>
            </div>
            <nav
              aria-label="Urutan hasil Cari Teman"
              className="flex w-full items-center gap-1 rounded-xl border border-brand-border bg-white p-1 sm:w-auto"
            >
              <Link
                href={peopleOrderHref(filters, "shared")}
                aria-current={selectedOrder === "shared" ? "page" : undefined}
                className={`focus-ring inline-flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold sm:flex-none ${
                  selectedOrder === "shared"
                    ? "bg-brand-navy text-white"
                    : "text-brand-muted hover:text-brand-navy"
                }`}
              >
                Paling nyambung
              </Link>
              <Link
                href={peopleOrderHref(filters, "default")}
                aria-current={selectedOrder === "default" ? "page" : undefined}
                className={`focus-ring inline-flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold sm:flex-none ${
                  selectedOrder === "default"
                    ? "bg-brand-navy text-white"
                    : "text-brand-muted hover:text-brand-navy"
                }`}
              >
                Urutan profil
              </Link>
            </nav>
          </div>
          {selectedOrder === "shared" && visibleProfiles.length > 0 ? (
            <p className="mt-4 max-w-3xl text-sm leading-6 text-brand-muted">
              Kami mendahulukan profil yang sedang mencari teman dan punya tujuan
              atau minat yang sama. Tidak ada nilai kecocokan dan kamu tetap
              bebas memilih siapa yang ingin dikenal.
            </p>
          ) : null}

          {quotaReached ? (
            <div className="mt-6">
              <Notice tone="warn" title="Batas pencarian hari ini sudah terpakai">
                Coba lagi besok, atau{" "}
                <Link href="/app/membership" className="focus-ring font-semibold underline underline-offset-2">
                  lihat StudyDate Plus
                </Link>{" "}
                untuk batas yang lebih besar.
              </Notice>
            </div>
          ) : visibleProfiles.length ? (
            <>
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {visibleProfiles.map((profile) => (
                  <PeopleProfileCard
                    key={profile.public_alias}
                    profile={profile}
                    sharedContext={buildSharedStudentContext(ownProfile, profile)}
                  />
                ))}
              </div>
              {result.nextCursor && (
                <div className="mt-8 flex justify-center">
                  <Link href={paginationHref(filters, result.nextCursor)} className={appButton.secondary}>Muat lebih banyak</Link>
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
      </AppPage>
    </AppShell>
  );
}

export default function PeoplePage(props: PeoplePageProps) {
  return (
    <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-sm text-brand-muted">Menyiapkan pencarian...</p></main>}>
      <PeopleContent {...props} />
    </Suspense>
  );
}
