import { AppShell } from "@/components/app/app-shell";
import {
  PrivacyFieldGrid,
  type PrivacyField,
} from "@/components/people/privacy-field-grid";
import { SendIntroductionDialog } from "@/components/introductions/send-introduction-dialog";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { RATE_LIMIT_MESSAGE } from "@/lib/introductions/constants";
import { getIntroductionSendEligibility } from "@/lib/introductions/service";
import {
  connectionGoalLabels,
  getMascotForAlias,
  interestLabels,
} from "@/lib/people/constants";
import { getDiscoveryProfile } from "@/lib/people/service";
import {
  fromPeopleAliasPathSegment,
  peopleAliasSchema,
} from "@/lib/people/validation";
import {
  BadgeCheck,
  Building2,
  GraduationCap,
  Lock as LockIcon,
  MapPin,
  Shield,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type PeopleDetailPageProps = {
  params: Promise<{ alias: string }>;
  searchParams: Promise<{ intro?: string; notice?: string }>;
};

function eligibilityCopy(stateCode: string) {
  switch (stateCode) {
    case "self":
      return "Ini profilmu sendiri.";
    case "pending":
      return "Sudah ada perkenalan yang menunggu jawaban.";
    case "cooldown":
    case "rate_limited":
      return RATE_LIMIT_MESSAGE;
    case "quota_reached":
      return "Kuota perkenalan paket kamu sudah terpakai. Cek StudyDate Plus untuk kapasitas tambahan.";
    case "blocked":
      return "Interaksi dengan profil ini belum tersedia.";
    case "ok":
      return null;
    case "unavailable":
      return "Perkenalan belum dapat dikirim untuk profil ini saat ini.";
    default:
      return "Perkenalan belum dapat dikirim untuk profil ini saat ini.";
  }
}

export default async function PeopleDetailPage({
  params,
  searchParams,
}: PeopleDetailPageProps) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const ownProfile = await getPrivateProfile(user.id);
  if (!ownProfile?.onboarding_completed_at) redirect("/onboarding");

  const rawAlias = (await params).alias;
  const parsedAlias = peopleAliasSchema.safeParse(
    fromPeopleAliasPathSegment(rawAlias),
  );
  if (!parsedAlias.success) notFound();
  const profile = await getDiscoveryProfile(parsedAlias.data);
  if (!profile) notFound();

  const query = await searchParams;
  const eligibility = await getIntroductionSendEligibility(
    profile.public_alias,
  );
  const disabledReason = eligibilityCopy(eligibility.state_code);
  const notice =
    typeof query.notice === "string" && query.notice.trim()
      ? query.notice.trim().slice(0, 300)
      : null;

  // Locked placeholders only — never real name / social / NIM values.
  const privateFields: PrivacyField[] = [
    {
      id: "full-name",
      label: "Nama",
      state: "locked",
      lockedHint: "Terbuka jika kalian sama-sama setuju berbagi nama",
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      state: "locked",
      lockedHint: "Terbuka jika kalian sama-sama setuju berbagi LinkedIn",
    },
    {
      id: "instagram",
      label: "Instagram",
      state: "locked",
      lockedHint: "Terbuka jika kalian sama-sama setuju berbagi Instagram",
    },
    {
      id: "nim",
      label: "NIM",
      state: "never",
    },
  ];

  return (
    <AppShell current="people">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell py-8 sm:py-12 lg:py-16">
          <Link
            href="/app/people"
            className="focus-ring inline-flex min-h-11 items-center rounded-xl text-sm font-semibold text-brand-blue"
          >
            ← Kembali ke Cari Teman
          </Link>
          {notice ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-brand-border bg-white px-4 py-3 text-sm text-brand-navy"
            >
              {notice}
            </p>
          ) : null}

          <article className="mt-5 overflow-hidden rounded-[22px] border border-brand-border bg-white shadow-[0_14px_36px_rgba(15,27,51,0.055)] md:rounded-[26px]">
            <div className="grid md:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)]">
              <div className="relative flex min-h-[240px] items-end justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_25%,#ffffff_0%,#edf4ff_50%,#dfeaff_100%)] px-6 pb-6 pt-14 sm:min-h-[300px] sm:px-8 sm:pb-8 md:min-h-full md:pt-16">
                <p className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue sm:left-7 sm:top-7">
                  Maskot profil
                </p>
                <Image
                  src={getMascotForAlias(profile.public_alias)}
                  alt=""
                  width={360}
                  height={360}
                  className="h-[200px] w-[200px] object-contain object-bottom sm:h-[260px] sm:w-[260px] lg:h-[300px] lg:w-[300px]"
                  priority
                />
              </div>

              <div className="flex min-w-0 flex-col p-5 sm:p-8 lg:p-10">
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                  <h1 className="break-words font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl">
                    {profile.public_alias}
                  </h1>
                  {profile.is_verified ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-surface px-3 py-1.5 text-sm font-semibold text-brand-blue">
                      <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                      Terverifikasi
                    </span>
                  ) : null}
                </div>

                <p className="mt-4 text-base leading-7 text-brand-muted sm:mt-5 sm:text-lg sm:leading-8">
                  {profile.short_intro ??
                    "Profil ini menampilkan informasi kampus dan minat tanpa nama asli."}
                </p>

                <dl className="mt-6 grid gap-4 border-y border-brand-border py-6 sm:mt-8 sm:grid-cols-2 sm:gap-5 sm:py-7">
                  <div className="flex gap-3">
                    <GraduationCap
                      className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <dt className="text-sm text-brand-muted">
                        Program studi
                      </dt>
                      <dd className="mt-1 break-words font-semibold text-brand-navy">
                        {profile.study_program}
                      </dd>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Building2
                      className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <dt className="text-sm text-brand-muted">Kampus</dt>
                      <dd className="mt-1 break-words font-semibold text-brand-navy">
                        {profile.campus}
                      </dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-sm text-brand-muted">Semester</dt>
                    <dd className="mt-1 font-semibold text-brand-navy">
                      {profile.semester ?? "Belum dicantumkan"}
                    </dd>
                  </div>
                  {profile.city_region ? (
                    <div className="flex gap-3">
                      <MapPin
                        className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <dt className="text-sm text-brand-muted">
                          Kota / wilayah
                        </dt>
                        <dd className="mt-1 break-words font-semibold text-brand-navy">
                          {profile.city_region}
                        </dd>
                      </div>
                    </div>
                  ) : null}
                </dl>

                <section className="mt-6 sm:mt-7" aria-labelledby="privacy-title">
                  <div className="flex items-start gap-2">
                    <LockIcon
                      className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue"
                      aria-hidden
                    />
                    <div>
                      <h2
                        id="privacy-title"
                        className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-muted"
                      >
                        Identitas & kontak
                      </h2>
                      <p className="mt-1.5 text-sm leading-6 text-brand-muted">
                        Nama dan kontak masih terkunci. Informasi tersebut hanya
                        terbuka jika kalian sama-sama setuju. NIM tidak pernah
                        dibagikan ke pengguna lain.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <PrivacyFieldGrid fields={privateFields} />
                  </div>
                </section>

                <section className="mt-6 sm:mt-7" aria-labelledby="goals-title">
                  <h2
                    id="goals-title"
                    className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-muted"
                  >
                    Ingin terhubung untuk
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.connection_goals.map((goal) => (
                      <span
                        key={goal}
                        className="rounded-full bg-brand-surface px-3 py-2 text-sm font-semibold text-brand-navy"
                      >
                        {connectionGoalLabels.get(goal) ?? goal}
                      </span>
                    ))}
                  </div>
                </section>

                <section
                  className="mt-6 sm:mt-7"
                  aria-labelledby="interests-title"
                >
                  <h2
                    id="interests-title"
                    className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-muted"
                  >
                    Minat
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.interests.map((interest) => (
                      <span
                        key={interest}
                        className="rounded-full border border-brand-border px-3 py-2 text-sm text-brand-navy"
                      >
                        {interestLabels.get(interest) ?? interest}
                      </span>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            <footer className="flex flex-col gap-4 border-t border-brand-border bg-brand-navy p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-8">
              <div className="flex max-w-2xl gap-3">
                <Shield
                  className="mt-0.5 h-5 w-5 shrink-0 text-blue-300"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="font-semibold">Kirim perkenalan privat</h2>
                  <p className="mt-1 text-sm leading-6 text-white/65">
                    Nama lengkap dan kontak tetap tertutup sampai tahap reveal
                    yang relevan.
                  </p>
                </div>
              </div>
              <div className="w-full shrink-0 sm:w-auto">
                <SendIntroductionDialog
                  alias={profile.public_alias}
                  disabledReason={disabledReason}
                  canSend={eligibility.state_code === "ok"}
                />
              </div>
            </footer>
          </article>
        </div>
      </main>
    </AppShell>
  );
}
