import { StaffShell } from "@/components/staff/staff-shell";
import { EVENT_CATEGORY_LABELS, formatEventDateTime } from "@/lib/events/presentation";
import { listStaffCampusEvents, type StaffCampusEvent } from "@/lib/events/staff-service";
import { requireActiveStaff } from "@/lib/staff/authorization";
import { BadgeCheck, CalendarDays, MapPin, UsersRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

type Props = {
  searchParams: Promise<{ status?: string }>;
};

const eventStatuses = ["scheduled", "cancelled", "archived"] as const;
const statusLabels: Record<StaffCampusEvent["status"], string> = {
  scheduled: "Akan datang",
  cancelled: "Dibatalkan",
  archived: "Diarsipkan",
};

async function AdminEventsContent({ searchParams }: Props) {
  const access = await requireActiveStaff();
  if (access.role === "owner") redirect("/owner/events");
  const query = await searchParams;
  const status = eventStatuses.includes(query.status as StaffCampusEvent["status"])
    ? (query.status as StaffCampusEvent["status"])
    : "scheduled";
  const events = await listStaffCampusEvents(status).catch(() => []);

  return (
    <StaffShell role={access.role} current="events" access={access}>
      <main className="min-h-svh bg-brand-surface">
        <div className="page-shell py-10 sm:py-14">
          <h1 className="max-w-3xl font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            Pantau Acara Kampus
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-brand-muted">
            Lihat acara yang dibuat mahasiswa tanpa membuka identitas atau daftar
            peserta. Penandaan acara resmi tetap menjadi keputusan Owner.
          </p>

          <nav className="mt-8 flex gap-2 overflow-x-auto pb-2" aria-label="Filter status acara">
            {eventStatuses.map((item) => (
              <Link
                key={item}
                href={`/admin/events?status=${item}`}
                aria-current={status === item ? "page" : undefined}
                className={`focus-ring shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
                  status === item
                    ? "border-brand-blue bg-brand-blue text-white"
                    : "border-brand-border bg-white text-brand-navy"
                }`}
              >
                {statusLabels[item]}
              </Link>
            ))}
          </nav>

          <section className="mt-6 overflow-hidden rounded-[22px] border border-brand-border bg-white" aria-label="Daftar acara kampus">
            {events.length ? (
              <div className="divide-y divide-brand-border">
                {events.map((event) => (
                  <article key={event.public_slug} className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-brand-blue">
                        <span>{EVENT_CATEGORY_LABELS[event.category]}</span>
                        <span>{statusLabels[event.status]}</span>
                        {event.is_official ? (
                          <span className="inline-flex items-center gap-1 text-brand-navy">
                            <BadgeCheck className="h-4 w-4 text-brand-blue" aria-hidden="true" />
                            Resmi
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-2 break-words font-heading text-xl font-semibold text-brand-navy">{event.title}</h2>
                      <p className="mt-2 text-sm text-brand-muted">
                        Oleh {event.organizer_alias}{event.organizer_is_verified ? " · terverifikasi" : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-muted">
                        <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" aria-hidden="true" />{formatEventDateTime(event.starts_at, event.timezone_name)}</span>
                        <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />{event.venue_name}, {event.city}</span>
                        <span className="inline-flex items-center gap-2"><UsersRound className="h-4 w-4" aria-hidden="true" />{event.attendee_count}/{event.capacity} peserta</span>
                      </div>
                    </div>
                    <div className="text-sm lg:text-right">
                      <p className="font-mono text-xs text-brand-muted">{event.public_slug}</p>
                      {event.is_official && event.scope === "open" && event.status === "scheduled" ? (
                        <Link href={`/events/${event.public_slug}`} className="focus-ring mt-3 inline-flex font-semibold text-brand-blue">
                          Lihat halaman publik
                        </Link>
                      ) : (
                        <p className="mt-3 font-semibold text-brand-muted">Belum tampil di halaman publik</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center">
                <CalendarDays className="mx-auto h-9 w-9 text-brand-blue" aria-hidden="true" />
                <p className="mt-4 font-heading text-xl font-semibold text-brand-navy">Belum ada acara pada status ini</p>
                <p className="mt-2 text-sm text-brand-muted">Daftar akan muncul setelah mahasiswa membuat acara.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </StaffShell>
  );
}

export default function AdminEventsPage(props: Props) {
  return (
    <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-brand-muted">Menyiapkan daftar acara…</p></main>}>
      <AdminEventsContent {...props} />
    </Suspense>
  );
}
