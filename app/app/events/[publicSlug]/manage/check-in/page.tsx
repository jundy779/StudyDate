import { undoCampusEventCheckInAction } from "@/app/app/events/actions";
import { AppShell } from "@/components/app/app-shell";
import { EventManagementShell } from "@/components/events/event-management-shell";
import { EventManualCheckInButton } from "@/components/events/event-manual-checkin-button";
import { getCampusEventCheckInManagement } from "@/lib/events/management";
import Link from "next/link";

type CheckInPageProps = {
  params: Promise<{ publicSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CheckInPage({
  params,
  searchParams,
}: CheckInPageProps) {
  const { publicSlug } = await params;
  const { event, overview, attendees, canUndo } =
    await getCampusEventCheckInManagement(publicSlug);
  const filter = first((await searchParams).filter);
  const activeFilter =
    filter === "checked-in" || filter === "not-yet" ? filter : "all";
  const registrations = attendees.filter(
    (attendee) => attendee.registration_status === "going",
  );
  const visible = registrations.filter((registration) => {
    if (activeFilter === "checked-in") return Boolean(registration.checked_in_at);
    if (activeFilter === "not-yet") return !registration.checked_in_at;
    return true;
  });
  const progress =
    overview.going_count > 0
      ? Math.min(100, Math.round((overview.checked_in_count / overview.going_count) * 100))
      : 0;
  const base = `/app/events/${event.public_slug}/manage/check-in`;

  return (
    <AppShell current="events">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <EventManagementShell active="check-in" event={event} overview={overview}>
          <section aria-labelledby="checkin-title">
            <p className="section-label">Check-In</p>
            <h2
              id="checkin-title"
              className="mt-2 font-heading text-2xl font-semibold text-brand-navy"
            >
              {overview.checked_in_count} dari {overview.going_count} hadir
            </h2>
            <div
              className="mt-4 h-2 max-w-2xl overflow-hidden rounded-full bg-brand-border"
              role="progressbar"
              aria-label="Progres check-in"
              aria-valuemin={0}
              aria-valuemax={overview.going_count}
              aria-valuenow={overview.checked_in_count}
            >
              <div
                className="h-full rounded-full bg-brand-blue"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {[
                ["all", "All"],
                ["checked-in", "Checked in"],
                ["not-yet", "Not yet"],
              ].map(([value, label]) => (
                <Link
                  key={value}
                  href={value === "all" ? base : `${base}?filter=${value}`}
                  aria-current={activeFilter === value ? "page" : undefined}
                  className={`focus-ring inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold ${
                    activeFilter === value
                      ? "border-brand-blue bg-brand-blue text-white"
                      : "border-brand-border bg-white text-brand-muted"
                  }`}
                >
                  {label}
                </Link>
              ))}
              <Link
                href={`${base}/scan`}
                className="focus-ring ml-auto inline-flex min-h-11 items-center rounded-xl border border-brand-navy px-4 text-sm font-semibold text-brand-navy"
              >
                Buka scanner QR
              </Link>
            </div>

            <div className="mt-6 divide-y divide-brand-border border-y border-brand-border">
              {visible.map((registration) => (
                <article
                  key={registration.registration_public_id}
                  className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold text-brand-navy">
                      {registration.public_alias}
                    </h3>
                    <p className="mt-1 break-words text-sm leading-6 text-brand-muted">
                      {registration.campus} · {registration.study_program}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-brand-blue">
                      {registration.checked_in_at
                        ? `Checked in · ${registration.checkin_method === "manual" ? "Manual" : "QR"}`
                        : "Not yet"}
                    </p>
                  </div>
                  {registration.checked_in_at && canUndo ? (
                    <form action={undoCampusEventCheckInAction}>
                      <input
                        type="hidden"
                        name="publicSlug"
                        value={event.public_slug}
                      />
                      <input
                        type="hidden"
                        name="registrationPublicId"
                        value={registration.registration_public_id}
                      />
                      <button className="focus-ring min-h-11 rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy">
                        Undo check-in
                      </button>
                    </form>
                  ) : !registration.checked_in_at ? (
                    <EventManualCheckInButton
                      publicSlug={event.public_slug}
                      registrationPublicId={registration.registration_public_id}
                    />
                  ) : null}
                </article>
              ))}
              {!visible.length ? (
                <p className="py-10 text-sm text-brand-muted">
                  Tidak ada peserta pada filter ini.
                </p>
              ) : null}
            </div>
            {overview.going_count > registrations.length ? (
              <p className="mt-5 text-xs leading-5 text-brand-muted">
                Menampilkan 50 peserta pertama. Gunakan scanner QR untuk peserta
                berikutnya atau buka halaman registrasi berikutnya.
              </p>
            ) : null}
          </section>
        </EventManagementShell>
      </main>
    </AppShell>
  );
}
