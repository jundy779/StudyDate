import { AppShell } from "@/components/app/app-shell";
import { MascotEmptyState } from "@/components/brand/mascot-empty-state";
import { EventFilterForm } from "@/components/events/event-filter-form";
import { EventListItem } from "@/components/events/event-list-item";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  getMyEventOrganizerEligibility,
  listCampusEvents,
  listMyCampusEventTeamInvitations,
} from "@/lib/events/service";
import { parseEventFilters } from "@/lib/events/validation";
import { Plus } from "lucide-react";
import Link from "next/link";
import { respondCampusEventTeamInvitationAction } from "./actions";
import { redirect } from "next/navigation";
import { Suspense } from "react";

type EventsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function paginationHref(
  filters: Record<string, string | undefined>,
  cursor: { before: string; cursor: string },
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  params.set("before", cursor.before);
  params.set("cursor", cursor.cursor);
  return `/app/events?${params.toString()}`;
}

async function EventsContent({ searchParams }: EventsPageProps) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const rawSearchParams = await searchParams;
  const parsed = parseEventFilters(rawSearchParams);
  const filters = parsed.success ? parsed.data : {};
  const [result, eligibility, invitations] = await Promise.all([
    parsed.success
      ? listCampusEvents(parsed.data)
      : Promise.resolve({ events: [], nextCursor: null }),
    getMyEventOrganizerEligibility(),
    listMyCampusEventTeamInvitations(),
  ]);
  const pendingInvitations = invitations.filter(
    (invitation) => invitation.invitation_status === "invited",
  );
  const activeAssignments = invitations.filter(
    (invitation) => invitation.invitation_status === "active",
  );

  return (
    <AppShell current="events">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell py-8 sm:py-12 lg:py-16">
          <header className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="section-label">Acara Kampus</p>
              <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.035em] text-brand-navy sm:text-5xl">
                Kegiatan kampus, bertemu di tempat publik
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-muted">
                Temukan seminar, workshop, meetup, hackathon, dan kegiatan kampus lainnya.\n                Kamu tetap memakai nama samaran saat mendaftar.
              </p>
            </div>
            {eligibility?.eligible ? (
              <Link
                href="/app/events/create"
                className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Buat acara
              </Link>
            ) : (
              <aside className="max-w-sm border-l-2 border-brand-blue pl-4 text-sm leading-6 text-brand-muted">
                <p className="font-semibold text-brand-navy">Pembuatan acara terbatas</p>
                <p className="mt-1">
                  Kamu perlu menyelesaikan verifikasi mahasiswa atau mendapat izin dari\n                  tim StudyDate sebelum membuat acara.
                </p>
              </aside>
            )}
          </header>

          {pendingInvitations.length ? (
            <section
              className="mt-9 border-y border-brand-border py-6"
              aria-labelledby="event-team-invitations-title"
            >
              <p className="section-label">Undangan tim</p>
              <h2
                id="event-team-invitations-title"
                className="mt-2 font-heading text-xl font-semibold text-brand-navy"
              >
                Undangan untuk membantu acara
              </h2>
              <div className="mt-4 divide-y divide-brand-border">
                {pendingInvitations.map((invitation) => (
                  <article
                    key={`${invitation.event_public_slug}-${invitation.team_role}`}
                    className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-brand-navy">
                        {invitation.event_title}
                      </h3>
                      <p className="mt-1 text-sm text-brand-muted">
                        {invitation.team_role === "cohost"
                          ? "Rekan penyelenggara · pendaftaran dan kehadiran"
                          : "Petugas kehadiran · daftar hadir dan pemindai QR"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {(["accept", "decline"] as const).map((response) => (
                        <form
                          key={response}
                          action={respondCampusEventTeamInvitationAction}
                        >
                          <input
                            type="hidden"
                            name="publicSlug"
                            value={invitation.event_public_slug}
                          />
                          <button
                            name="response"
                            value={response}
                            className={`focus-ring min-h-11 rounded-xl px-4 text-sm font-semibold ${
                              response === "accept"
                                ? "bg-brand-blue text-white"
                                : "border border-brand-border bg-white text-brand-navy"
                            }`}
                          >
                            {response === "accept" ? "Terima" : "Tolak"}
                          </button>
                        </form>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeAssignments.length ? (
            <section
              className="mt-9 border-y border-brand-border py-6"
              aria-labelledby="event-team-active-title"
            >
              <p className="section-label">Acara yang kamu bantu</p>
              <h2
                id="event-team-active-title"
                className="mt-2 font-heading text-xl font-semibold text-brand-navy"
              >
                Acara yang kamu kelola
              </h2>
              <div className="mt-4 divide-y divide-brand-border">
                {activeAssignments.map((assignment) => (
                  <article
                    key={`${assignment.event_public_slug}-${assignment.team_role}`}
                    className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-brand-navy">
                        {assignment.event_title}
                      </h3>
                      <p className="mt-1 text-sm text-brand-muted">
                        {assignment.team_role === "cohost"
                          ? "Rekan penyelenggara · pendaftaran dan kehadiran"
                          : "Petugas kehadiran · daftar hadir dan pemindai QR"}
                      </p>
                    </div>
                    <Link
                      href={
                        assignment.team_role === "checkin_staff"
                          ? `/app/events/${assignment.event_public_slug}/manage/check-in`
                          : `/app/events/${assignment.event_public_slug}/manage`
                      }
                      className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-blue px-4 text-sm font-semibold text-brand-blue"
                    >
                      Buka pengelolaan acara
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section
            aria-labelledby="event-filter-title"
            className="mt-10 border-y border-brand-border py-7"
          >
            <h2 id="event-filter-title" className="font-heading text-xl font-semibold text-brand-navy">
              Cari acara mendatang
            </h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              Cari berdasarkan nama atau jenis acara, lalu pilih siapa yang boleh melihatnya.
            </p>
            <EventFilterForm filters={filters} />
            {!parsed.success ? (
              <p role="alert" className="mt-4 text-sm font-medium text-brand-error">
                Pilihan pencarian tidak valid. Hapus pilihan lalu coba lagi.
              </p>
            ) : null}
          </section>

          <section className="mt-10" aria-labelledby="event-results-title">
            <div className="max-w-2xl">
              <p className="section-label">Acara mendatang</p>
              <h2
                id="event-results-title"
                className="mt-2 font-heading text-2xl font-semibold text-brand-navy"
              >
                Temukan kegiatan yang ingin kamu ikuti
              </h2>
            </div>
            {result.events.length ? (
              <div className="mt-7 rounded-[22px] border border-brand-border bg-white px-5 py-7 sm:px-8">
                {result.events.map((event) => (
                  <EventListItem key={event.public_slug} event={event} />
                ))}
              </div>
            ) : parsed.success ? (
              <div className="mt-7">
                <MascotEmptyState
                  pose="study"
                  title={
                    filters.search || filters.category || filters.scope
                      ? "Belum ada acara yang cocok"
                      : "Belum ada acara mendatang"
                  }
                  description="Coba kurangi pilihan pencarian atau buat acara baru di tempat umum."
                  action={
                    eligibility?.eligible
                      ? { href: "/app/events/create", label: "Buat acara" }
                      : undefined
                  }
                />
              </div>
            ) : null}
            {result.nextCursor ? (
              <div className="mt-8 flex justify-center">
                <Link
                  href={paginationHref(filters, result.nextCursor)}
                  className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-border bg-white px-6 text-sm font-semibold text-brand-navy"
                >
                  Muat lebih banyak
                </Link>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

export default function EventsPage(props: EventsPageProps) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-sm text-brand-muted">
            Menyiapkan acara kampus…
          </p>
        </main>
      }
    >
      <EventsContent {...props} />
    </Suspense>
  );
}
