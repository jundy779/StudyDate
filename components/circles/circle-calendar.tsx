import Link from "next/link";
import { CalendarCheck2, CalendarPlus, MapPin, UsersRound } from "lucide-react";
import { MascotHead } from "@/components/brand/mascot-head";
import { setCircleCalendarFollowAction } from "@/app/app/circles/actions";
import type { CircleCalendar, CircleCalendarEvent } from "@/lib/circles/calendar";
import { EVENT_CATEGORY_LABELS, eventTimezoneLabel } from "@/lib/events/presentation";
import { eventPlaceLine } from "@/lib/events/online";

function dayKey(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function dayLabel(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { weekday: get("weekday"), date: `${get("day")} ${get("month")}` };
}

function timeLabel(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const rsvpLabels: Record<string, string> = {
  going: "Kamu terdaftar",
  pending: "Menunggu persetujuan",
  waitlisted: "Di daftar tunggu",
};

export function CircleCalendarSection({
  circleSlug,
  circleName,
  calendar,
  events,
  isOwner,
}: {
  circleSlug: string;
  circleName: string;
  calendar: CircleCalendar;
  events: CircleCalendarEvent[];
  isOwner: boolean;
}) {
  const groups: { key: string; items: CircleCalendarEvent[] }[] = [];
  for (const event of events) {
    const key = dayKey(event.starts_at, event.timezone_name);
    const last = groups.at(-1);
    if (last && last.key === key) last.items.push(event);
    else groups.push({ key, items: [event] });
  }

  return (
    <section
      id="kalender"
      aria-labelledby="circle-calendar-title"
      className="scroll-mt-24 border-b border-brand-border py-10"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-hand text-xl text-brand-blue">Kalender acara</p>
          <h2
            id="circle-calendar-title"
            className="mt-1 font-heading text-2xl font-semibold text-brand-navy sm:text-3xl"
          >
            Acara dari {circleName}
          </h2>
          <p className="mt-2 text-sm text-brand-muted">
            {calendar.followerCount} orang mengikuti kalender ini. Daftar pengikut tidak
            ditampilkan.
          </p>
        </div>

        {calendar.canFollow ? (
          <form action={setCircleCalendarFollowAction} className="shrink-0">
            <input type="hidden" name="publicSlug" value={circleSlug} />
            <input type="hidden" name="follow" value={calendar.isFollowing ? "false" : "true"} />
            {calendar.isFollowing ? (
              <button
                type="submit"
                className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-brand-navy bg-white px-5 text-sm font-semibold text-brand-navy"
              >
                <CalendarCheck2 className="h-4 w-4 text-brand-blue" aria-hidden="true" />
                Mengikuti kalender
                <span className="sr-only">, tekan untuk berhenti mengikuti</span>
              </button>
            ) : (
              <button
                type="submit"
                className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-brand-navy bg-brand-blue px-5 text-sm font-semibold text-white shadow-[3px_3px_0_#0F1B33] transition-transform hover:-translate-y-0.5"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                Ikuti kalender
              </button>
            )}
          </form>
        ) : null}
      </div>

      {calendar.canFollow && !calendar.isFollowing ? (
        <p className="mt-3 text-xs leading-5 text-brand-muted">
          Kamu akan dapat notifikasi saat acara baru ditambahkan. Mengikuti kalender tidak
          sama dengan bergabung ke Circle dan tidak membuka identitasmu.
        </p>
      ) : null}

      {groups.length ? (
        <ol className="mt-8 space-y-8">
          {groups.map((group) => {
            const first = group.items[0];
            const label = dayLabel(first.starts_at, first.timezone_name);
            return (
              <li
                key={group.key}
                className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-8"
              >
                <p className="sm:pt-4">
                  <span className="block font-heading text-lg font-semibold text-brand-navy">
                    {label.date}
                  </span>
                  <span className="text-sm capitalize text-brand-muted">{label.weekday}</span>
                </p>
                <ul className="space-y-3 border-l-2 border-dashed border-brand-navy/15 pl-5">
                  {group.items.map((event) => (
                    <li key={event.public_slug}>
                      <Link
                        href={`/app/events/${event.public_slug}`}
                        className="focus-ring group block rounded-2xl border border-brand-border bg-white p-4 transition-colors hover:border-brand-navy sm:p-5"
                      >
                        <p className="text-sm font-semibold text-brand-blue">
                          {timeLabel(event.starts_at, event.timezone_name)}{" "}
                          {eventTimezoneLabel(event.timezone_name)}
                          <span className="text-brand-muted">
                            {" "}
                            · {EVENT_CATEGORY_LABELS[event.category] ?? event.category}
                          </span>
                        </p>
                        <h3 className="mt-1.5 break-words font-heading text-lg font-semibold text-brand-navy group-hover:text-brand-blue">
                          {event.title}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" aria-hidden="true" />
                            {eventPlaceLine(event)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <UsersRound className="h-4 w-4" aria-hidden="true" />
                            {event.attendee_count} dari {event.capacity}
                          </span>
                        </div>
                        {event.rsvp_status && rsvpLabels[event.rsvp_status] ? (
                          <span className="mt-3 inline-flex rounded-full bg-[#EAF1FF] px-3 py-1 text-xs font-semibold text-brand-blue">
                            {rsvpLabels[event.rsvp_status]}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-8 flex items-center gap-5 rounded-2xl border-2 border-dashed border-brand-navy/15 bg-white p-5">
          <span className="w-16 shrink-0" aria-hidden="true">
            <MascotHead expression="ngantuk" />
          </span>
          <p className="text-sm leading-6 text-brand-muted">
            {isOwner
              ? "Belum ada acara mendatang. Buka Kelola acara, lalu Pengaturan, dan pilih Circle ini di bagian Study Circle supaya acaranya muncul di sini."
              : "Belum ada acara mendatang. Ikuti kalender ini supaya kamu tahu saat ada acara baru."}
          </p>
        </div>
      )}
    </section>
  );
}
