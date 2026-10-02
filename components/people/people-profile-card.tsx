import {
  connectionGoalLabels,
  getMascotForAlias,
  interestLabels,
} from "@/lib/people/constants";
import type { DiscoveryProfile } from "@/lib/people/service";
import type { SharedStudentContext } from "@/lib/people/shared-context";
import { SharedContextSummary } from "@/components/people/shared-context-summary";
import { getStudyStatusLabel } from "@/lib/people/study-status";
import { toPeopleAliasPathSegment } from "@/lib/people/validation";
import { BadgeCheck, Clock3, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function PeopleProfileCard({
  profile,
  mascotSrc,
  hideCta = false,
  sharedContext,
}: {
  profile: DiscoveryProfile;
  /** Override hashed alias mascot (e.g. profile self-preview). */
  mascotSrc?: string;
  hideCta?: boolean;
  sharedContext?: SharedStudentContext;
}) {
  const firstGoals = profile.connection_goals.slice(0, 2);
  const firstInterests = profile.interests.slice(0, 3);
  const imageSrc = mascotSrc ?? getMascotForAlias(profile.public_alias);
  const studyStatusLabel = getStudyStatusLabel(profile.study_status);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[22px] border border-brand-border bg-white shadow-[0_14px_36px_rgba(15,27,51,0.055)]">
      <div className="grid grid-cols-[112px_1fr] gap-5 bg-[linear-gradient(135deg,#eef4ff_0%,#f8faff_100%)] p-5 sm:grid-cols-[124px_1fr]">
        <div className="relative flex aspect-square items-end justify-center overflow-hidden rounded-[18px] border border-white/90 bg-white/70">
          <Image src={imageSrc} alt="" width={124} height={124} className="h-[88%] w-[88%] object-contain object-bottom" />
        </div>
        <div className="min-w-0 self-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">Profil tanpa nama asli</p>
          <h2 className="mt-2 break-words font-heading text-xl font-semibold tracking-[-0.02em] text-brand-navy">{profile.public_alias}</h2>
          {profile.is_verified && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-blue">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Terverifikasi
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-heading text-lg font-semibold text-brand-navy">{profile.study_program}</h3>
        <p className="mt-1 text-sm leading-6 text-brand-muted">
          {profile.semester ? `Semester ${profile.semester}` : "Semester belum dicantumkan"} • {profile.campus}
        </p>
        {profile.city_region && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-brand-muted">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /> {profile.city_region}
          </p>
        )}
        {studyStatusLabel ? (
          <p className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {studyStatusLabel}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Tujuan koneksi">
          {firstGoals.map((goal) => (
            <span key={goal} className="rounded-full bg-brand-surface px-3 py-1.5 text-xs font-semibold text-brand-navy">{connectionGoalLabels.get(goal) ?? goal}</span>
          ))}
        </div>
        {sharedContext ? (
          <SharedContextSummary context={sharedContext} compact />
        ) : null}
        <p className="mt-5 line-clamp-3 text-sm leading-6 text-brand-muted">
          {profile.short_intro ?? `Tertarik pada ${firstInterests.map((interest) => interestLabels.get(interest) ?? interest).join(", ")}.`}
        </p>
        {hideCta ? null : (
          <Link href={`/app/people/${toPeopleAliasPathSegment(profile.public_alias)}`} className="focus-ring mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-blue px-4 text-sm font-semibold text-brand-blue hover:bg-brand-blue hover:text-white">
            Lihat profil tanpa nama asli
          </Link>
        )}
      </div>
    </article>
  );
}
