import { setCampusEventOfficial } from "@/app/owner/events/actions";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { EmptyState, Panel, StatusChip, staffButton } from "@/components/staff/ui";
import { EVENT_CATEGORY_LABELS, formatEventDateTime } from "@/lib/events/presentation";
import type { StaffCampusEvent } from "@/lib/events/staff-service";
import { BadgeCheck, CalendarDays, ExternalLink, UsersRound } from "lucide-react";
import Link from "next/link";

const STATUS = {
  scheduled: { label: "Akan datang", tone: "go" },
  cancelled: { label: "Dibatalkan", tone: "stop" },
} as const;

export function OwnerEventDirectory({ events }: { events: StaffCampusEvent[] }) {
  return (
    <Panel
      id="owner-event-directory"
      title="Daftar acara terbaru"
      description="Periksa judul, penyelenggara, waktu, dan jumlah peserta sebelum menandai acara sebagai resmi."
      actions={<StatusChip tone="muted">{events.length} acara</StatusChip>}
      quiet
    >
      {events.length ? (
        <ul className="divide-y divide-brand-border">
          {events.map((event) => {
            const status = STATUS[event.status as keyof typeof STATUS] ?? { label: "Diarsipkan", tone: "muted" as const };
            return (
              <li key={event.public_slug} className="grid gap-4 py-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusChip tone="info">{EVENT_CATEGORY_LABELS[event.category]}</StatusChip>
                    <StatusChip tone={status.tone}>{status.label}</StatusChip>
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
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" aria-hidden="true" />
                      {formatEventDateTime(event.starts_at, event.timezone_name)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <UsersRound className="h-4 w-4" aria-hidden="true" />
                      {event.attendee_count}/{event.capacity} peserta
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {event.is_official && event.scope === "open" && event.status === "scheduled" ? (
                    <Link href={`/events/${event.public_slug}`} className={staffButton.quiet}>
                      Halaman publik <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                  <form action={setCampusEventOfficial}>
                    <input type="hidden" name="publicSlug" value={event.public_slug} />
                    {event.is_official ? (
                      <ConfirmSubmitButton
                        triggerLabel="Hapus tanda resmi"
                        title="Hapus tanda resmi?"
                        description="Acara ini tidak lagi ditampilkan sebagai acara resmi StudyDate."
                        confirmLabel="Ya, hapus tanda"
                        name="isOfficial"
                        value="false"
                        className={staffButton.dangerQuiet}
                      />
                    ) : (
                      <button name="isOfficial" value="true" className={staffButton.primary}>
                        Tandai resmi
                      </button>
                    )}
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="Belum ada acara yang dapat dikelola" expression="ngantuk">
          Acara muncul di sini setelah mahasiswa yang punya izin penyelenggara membuatnya.
        </EmptyState>
      )}
    </Panel>
  );
}
