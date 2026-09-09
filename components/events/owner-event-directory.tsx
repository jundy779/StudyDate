import { setCampusEventOfficial } from "@/app/owner/events/actions";
import { EVENT_CATEGORY_LABELS, formatEventDateTime } from "@/lib/events/presentation";
import type { StaffCampusEvent } from "@/lib/events/staff-service";
import { BadgeCheck, CalendarDays, ExternalLink, UsersRound } from "lucide-react";
import Link from "next/link";

export function OwnerEventDirectory({ events }: { events: StaffCampusEvent[] }) {
  return (
    <section className="mt-10 border-y border-brand-border py-8" aria-labelledby="owner-event-directory-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="owner-event-directory-title" className="font-heading text-2xl font-semibold text-brand-navy">
            Daftar acara terbaru
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
            Periksa judul, penyelenggara, waktu, dan jumlah peserta sebelum menandai acara sebagai resmi.
          </p>
        </div>
        <span className="text-sm font-semibold text-brand-muted">{events.length} acara</span>
      </div>

      {events.length ? (
        <div className="mt-6 divide-y divide-brand-border rounded-[22px] border border-brand-border bg-white px-5 sm:px-7">
          {events.map((event) => (
            <article key={event.public_slug} className="grid gap-5 py-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-brand-blue">
                  <span>{EVENT_CATEGORY_LABELS[event.category]}</span>
                  <span>{event.status === "scheduled" ? "Akan datang" : event.status === "cancelled" ? "Dibatalkan" : "Diarsipkan"}</span>
                  {event.is_official ? <span className="inline-flex items-center gap-1 text-brand-navy"><BadgeCheck className="h-4 w-4 text-brand-blue" aria-hidden="true" />Resmi</span> : null}
                </div>
                <h3 className="mt-2 break-words font-heading text-xl font-semibold text-brand-navy">{event.title}</h3>
                <p className="mt-2 text-sm text-brand-muted">Oleh {event.organizer_alias}{event.organizer_is_verified ? " · terverifikasi" : ""}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-muted">
                  <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" aria-hidden="true" />{formatEventDateTime(event.starts_at, event.timezone_name)}</span>
                  <span className="inline-flex items-center gap-2"><UsersRound className="h-4 w-4" aria-hidden="true" />{event.attendee_count}/{event.capacity} peserta</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                {event.is_official && event.scope === "open" && event.status === "scheduled" ? (
                  <Link href={`/events/${event.public_slug}`} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-navy">
                    Halaman publik <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : null}
                <form action={setCampusEventOfficial}>
                  <input type="hidden" name="publicSlug" value={event.public_slug} />
                  <button name="isOfficial" value={event.is_official ? "false" : "true"} className={`focus-ring min-h-11 rounded-xl px-4 text-sm font-semibold ${event.is_official ? "border border-brand-border bg-white text-brand-navy" : "bg-brand-blue text-white"}`}>
                    {event.is_official ? "Hapus tanda resmi" : "Tandai resmi"}
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-6 rounded-[22px] border border-brand-border bg-white p-7 text-brand-muted">Belum ada acara yang dapat dikelola.</p>
      )}
    </section>
  );
}
