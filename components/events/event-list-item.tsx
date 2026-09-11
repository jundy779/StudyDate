import { EVENT_CATEGORIES } from "@/lib/events/constants";
import type { CampusEventSummary } from "@/lib/events/service";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  LockKeyhole,
  MapPin,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

const categoryLabels: Record<(typeof EVENT_CATEGORIES)[number], string> = {
  study_together: "Belajar Bareng",
  coding_tech: "Coding / Tech",
  design: "Desain",
  languages: "Bahasa",
  thesis: "Skripsi / Tesis",
  exam_prep: "Persiapan Ujian",
  workshop: "Workshop",
  discussion: "Diskusi",
  networking: "Networking",
  community: "Komunitas",
  other: "Lainnya",
};

function formatEventDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function EventListItem({ event }: { event: CampusEventSummary }) {
  const canManage =
    event.can_manage_registrations || event.can_check_in || event.can_manage_team;
  const manageHref =
    event.can_check_in && !event.can_manage_registrations
      ? `/app/events/${event.public_slug}/manage/check-in`
      : `/app/events/${event.public_slug}/manage`;
  const full = event.attendee_count >= event.capacity;
  return (
    <article className="grid gap-5 border-b border-brand-border py-7 first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-[0.11em] text-brand-blue">
          <span>{categoryLabels[event.category]}</span>
          <span aria-hidden="true">•</span>
          <span>{event.scope === "open" ? "Terbuka" : "Kampus yang sama"}</span>
          {event.is_official ? (
            <span className="inline-flex items-center gap-1 text-brand-navy">
              <BadgeCheck className="h-4 w-4 text-brand-blue" aria-hidden="true" />
              Resmi
            </span>
          ) : null}
          {event.rsvp_status === "going" ? (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 normal-case tracking-normal">
              Kamu ikut
            </span>
          ) : null}
          {full ? (
            <span className="rounded-full bg-brand-surface px-2.5 py-1 normal-case tracking-normal text-brand-navy">
              Kuota penuh
            </span>
          ) : null}
          <span className="normal-case tracking-normal text-brand-muted">
            {event.registration_mode === "approval"
              ? "Perlu persetujuan"
              : "Konfirmasi langsung"}
          </span>
          {event.rsvp_status === "pending" ? (
            <span className="normal-case tracking-normal text-brand-navy">
              Registrasi pending
            </span>
          ) : null}
          {event.rsvp_status === "waitlisted" ? (
            <span className="normal-case tracking-normal text-brand-navy">
              Kamu di daftar tunggu
            </span>
          ) : null}
        </div>
        <h2 className="mt-3 break-words font-heading text-2xl font-semibold tracking-[-0.025em] text-brand-navy">
          {event.title}
        </h2>
        <p className="mt-3 max-w-2xl whitespace-pre-wrap break-words text-sm leading-7 text-brand-muted">
          {event.description}
        </p>
        <div className="mt-4 grid gap-2 text-sm text-brand-muted sm:grid-cols-2">
          <span className="inline-flex min-w-0 items-start gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <time dateTime={event.starts_at}>
              {formatEventDate(event.starts_at, event.timezone_name)}
            </time>
          </span>
          <span className="inline-flex min-w-0 items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="break-words">
              {event.venue_name}, {event.city}
            </span>
          </span>
          <span className="inline-flex items-center gap-2">
            <UsersRound className="h-4 w-4" aria-hidden="true" />
            {event.attendee_count} dari {event.capacity} peserta
          </span>
          {event.scope === "campus" && event.campus_scope ? (
            <span className="inline-flex min-w-0 items-start gap-2">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="break-words">{event.campus_scope}</span>
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Link
          href={`/app/events/${event.public_slug}`}
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-blue px-4 text-sm font-semibold text-brand-blue transition hover:bg-brand-blue hover:text-white"
        >
          Lihat acara
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        {canManage ? (
          <Link
            href={manageHref}
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-navy"
          >
            Kelola acara
          </Link>
        ) : null}
      </div>
    </article>
  );
}
