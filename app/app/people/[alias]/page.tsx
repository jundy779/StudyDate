import { AppShell } from "@/components/app/app-shell";
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
import { peopleAliasSchema, fromPeopleAliasPathSegment } from "@/lib/people/validation";
import { BadgeCheck, Building2, GraduationCap, MapPin, Shield } from "lucide-react";
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
  const eligibility = await getIntroductionSendEligibility(profile.public_alias);
  const disabledReason = eligibilityCopy(eligibility.state_code);
  const notice =
    typeof query.notice === "string" && query.notice.trim()
      ? query.notice.trim().slice(0, 300)
      : null;

  return (
    <AppShell current="people">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
      <div className="page-shell py-8 sm:py-12 lg:py-16">
        <Link href="/app/people" className="focus-ring inline-flex min-h-11 items-center rounded-xl text-sm font-semibold text-brand-blue">← Kembali ke People</Link>
        {notice ? (
          <p role="alert" className="mt-4 rounded-xl border border-brand-border bg-white px-4 py-3 text-sm text-brand-navy">
            {notice}
          </p>
        ) : null}
        <article className="mt-5 overflow-hidden rounded-[26px] border border-brand-border bg-white shadow-[0_20px_50px_rgba(15,27,51,0.06)]">
          <div className="grid lg:grid-cols-[0.4fr_0.6fr]">
            <div className="relative flex min-h-[300px] items-end justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_25%,#ffffff_0%,#edf4ff_50%,#dfeaff_100%)] p-8 sm:min-h-[380px]">
              <div className="absolute left-7 top-7 rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">Profil anonim</div>
              <Image src={getMascotForAlias(profile.public_alias)} alt="" width={360} height={360} className="h-[250px] w-[250px] object-contain object-bottom sm:h-[320px] sm:w-[320px]" priority />
            </div>
            <div className="p-6 sm:p-9 lg:p-12">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl">{profile.public_alias}</h1>
                {profile.is_verified && <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-surface px-3 py-1.5 text-sm font-semibold text-brand-blue"><BadgeCheck className="h-4 w-4" aria-hidden="true" /> Terverifikasi</span>}
              </div>
              <p className="mt-5 text-lg leading-8 text-brand-muted">{profile.short_intro ?? "Profil ini memilih berbagi konteks akademik dan minatnya secara anonim."}</p>

              <dl className="mt-8 grid gap-5 border-y border-brand-border py-7 sm:grid-cols-2">
                <div className="flex gap-3"><GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" /><div><dt className="text-sm text-brand-muted">Program studi</dt><dd className="mt-1 font-semibold text-brand-navy">{profile.study_program}</dd></div></div>
                <div className="flex gap-3"><Building2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" /><div><dt className="text-sm text-brand-muted">Kampus</dt><dd className="mt-1 font-semibold text-brand-navy">{profile.campus}</dd></div></div>
                <div><dt className="text-sm text-brand-muted">Semester</dt><dd className="mt-1 font-semibold text-brand-navy">{profile.semester ?? "Belum dicantumkan"}</dd></div>
                {profile.city_region && <div className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" /><div><dt className="text-sm text-brand-muted">Kota/Kabupaten</dt><dd className="mt-1 font-semibold text-brand-navy">{profile.city_region}</dd></div></div>}
              </dl>

              <section className="mt-7" aria-labelledby="goals-title">
                <h2 id="goals-title" className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-muted">Ingin terhubung untuk</h2>
                <div className="mt-3 flex flex-wrap gap-2">{profile.connection_goals.map((goal) => <span key={goal} className="rounded-full bg-brand-surface px-3 py-2 text-sm font-semibold text-brand-navy">{connectionGoalLabels.get(goal) ?? goal}</span>)}</div>
              </section>
              <section className="mt-7" aria-labelledby="interests-title">
                <h2 id="interests-title" className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-muted">Minat</h2>
                <div className="mt-3 flex flex-wrap gap-2">{profile.interests.map((interest) => <span key={interest} className="rounded-full border border-brand-border px-3 py-2 text-sm text-brand-navy">{interestLabels.get(interest) ?? interest}</span>)}</div>
              </section>
            </div>
          </div>
          <footer className="flex flex-col gap-4 border-t border-brand-border bg-brand-navy p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex max-w-2xl gap-3">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">Kirim perkenalan privat</h2>
                <p className="mt-1 text-sm leading-6 text-white/65">
                  Ceritakan sedikit alasan kamu ingin berkenalan. Nama lengkap dan
                  kontak tetap tertutup.
                </p>
              </div>
            </div>
            <SendIntroductionDialog
              alias={profile.public_alias}
              canSend={eligibility.can_send}
              disabledReason={disabledReason}
            />
          </footer>
        </article>
      </div>
      </main>
    </AppShell>
  );
}
