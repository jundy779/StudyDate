import {
  circleScopeLabels,
  circleTopicLabels,
} from "@/lib/circles/constants";
import type { CircleSummary } from "@/lib/circles/service";
import { ArrowUpRight, LockKeyhole, UsersRound } from "lucide-react";
import Link from "next/link";

export function CircleListItem({ circle }: { circle: CircleSummary }) {
  return (
    <article className="grid gap-5 border-b border-brand-border py-7 first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-[0.11em] text-brand-blue">
          <span>{circleTopicLabels.get(circle.topic) ?? circle.topic}</span>
          <span aria-hidden="true">•</span>
          <span>{circleScopeLabels.get(circle.scope) ?? circle.scope}</span>
          {circle.membership_state === "active" ? (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 normal-case tracking-normal">
              Sudah bergabung
            </span>
          ) : null}
        </div>
        <h2 className="mt-3 break-words font-heading text-2xl font-semibold tracking-[-0.025em] text-brand-navy">
          {circle.name}
        </h2>
        <p className="mt-3 max-w-2xl whitespace-pre-wrap break-words text-sm leading-7 text-brand-muted">
          {circle.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-muted">
          <span className="inline-flex items-center gap-2">
            <UsersRound className="h-4 w-4" aria-hidden="true" />
            {circle.member_count} dari {circle.member_limit} anggota
          </span>
          {circle.scope === "campus" && circle.campus_scope ? (
            <span className="inline-flex items-center gap-2">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              {circle.campus_scope}
            </span>
          ) : null}
        </div>
      </div>
      <Link
        href={`/app/circles/${circle.public_slug}`}
        className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-blue px-4 text-sm font-semibold text-brand-blue transition hover:bg-brand-blue hover:text-white"
      >
        Lihat Circle
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </article>
  );
}
