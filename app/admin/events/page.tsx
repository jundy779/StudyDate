import { StaffShell } from "@/components/staff/staff-shell";
import { EmptyState, FilterChips, Panel, StaffPage, StatusChip, staffButton } from "@/components/staff/ui";
import { EVENT_CATEGORY_LABELS, formatEventDateTime } from "@/lib/events/presentation";
import { listStaffCampusEvents, type StaffCampusEvent } from "@/lib/events/staff-service";
import { requireActiveStaff } from "@/lib/staff/authorization";
import { BadgeCheck, CalendarDays, ExternalLink, MapPin, UsersRound } from "lucide-react";
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
const statusTone: Record<StaffCampusEvent["status"], "go" | "stop" | "muted"> = {
  scheduled: "go",
  cancelled: "stop",
  archived: "muted",
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
      <StaffPage
        kicker="Kegiatan"
        title="Pantau Acara Kampus"
        description="Lihat acara yang dibuat mahasiswa tanpa membuka identitas atau daftar peserta. Penandaan acara resmi tetap menjadi keputusan Owner."
        mascot="girang"
      >
        <Panel title="Daftar acara" description={`${events.length} acara pada pilihan ini.`} quiet>
          <FilterChips
            label="Filter status acara"
            items={eventStatuses.map((item) => ({
              href: `/admin/events?status=${item}`,
              label: statusLabels[item],
              active: status === item,
            }))}
          />
          {events.length ? (
            <ul className="divide-y divide-brand-border" aria-label="Daftar acara kampus">
              {events.map((event) => (
                <li key={event.public_slug} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusChip tone="info">{EVENT_CATEGORY_LABELS[event.category]}</StatusChip>
                      <StatusChip tone={statusTone[event.status]}>{statusLabels[event.status]}</StatusChip>
                      {event.is_official ? (
                        <StatusChip tone="go">
                          <BadgeCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                          Resmi
                        </StatusChip>
                      ) : null}
                    </div>
                    <h3 className="mt-2 break-words font-heading text-lg font-semibold text-brand-navy">{event.title}</h3>
                    <p className="mt-1 text-sm text-brand-muted">
                      Oleh {event.organizer_alias}
                      {event.organizer_is_verified ? " · penyelenggara terverifikasi" : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-brand-muted">
                      <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" aria-hidden="true" />{formatEventDateTime(event.starts_at, event.timezone_name)}</span>
                      <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />{event.venue_name}, {event.city}</span>
                      <span className="inline-flex items-center gap-2"><UsersRound className="h-4 w-4" aria-hidden="true" />{event.attendee_count}/{event.capacity} peserta</span>
                    </div>
                  </div>
                  {event.is_official && event.scope === "open" && event.status === "scheduled" ? (
                    <Link href={`/events/${event.public_slug}`} className={staffButton.quiet}>
                      Lihat halaman publik
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-brand-muted">Belum tampil di halaman publik</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Belum ada acara pada status ini" expression="ngantuk">
              Daftar akan muncul setelah mahasiswa membuat acara.
            </EmptyState>
          )}
        </Panel>
      </StaffPage>
    </StaffShell>
  );
}

export default function AdminEventsPage(props: Props) {
  return (
    <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-brand-muted">Menyiapkan daftar acara...</p></main>}>
      <AdminEventsContent {...props} />
    </Suspense>
  );
}
