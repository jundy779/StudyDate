import { FollowedCalendarStrip } from "@/components/events/followed-calendar-strip";
import { listMyFollowedCalendarEvents } from "@/lib/circles/calendar";
import { PendingFeedbackStrip } from "@/components/events/pending-feedback-strip";
import { listMyPendingEventFeedback } from "@/lib/events/after";
import {
  EDUCATIONAL_EVENT_CATEGORIES,
  getMyStudentAccess,
  requireEventFeatureAccess,
} from "@/lib/account/student-access";
import { AppShell } from "@/components/app/app-shell";
import { AppPage, HelpTip, Notice, Panel, appButton } from "@/components/app/ui";
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
  await requireEventFeatureAccess();
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const rawSearchParams = await searchParams;
  const parsed = parseEventFilters(rawSearchParams);
  const filters = parsed.success ? parsed.data : {};
  const access = await getMyStudentAccess();
  const isSchool = access?.tier === "school";
  const [result, eligibility, invitations, followedEvents, pendingFeedback] = await Promise.all([
    parsed.success
      ? listCampusEvents(parsed.data)
      : Promise.resolve({ events: [], nextCursor: null }),
    getMyEventOrganizerEligibility(),
    listMyCampusEventTeamInvitations(),
    isSchool ? Promise.resolve([]) : listMyFollowedCalendarEvents(6),
    listMyPendingEventFeedback(),
  ]);
  const pendingInvitations = invitations.filter(
    (invitation) => invitation.invitation_status === "invited",
  );
  const activeAssignments = invitations.filter(
    (invitation) => invitation.invitation_status === "active",
  );

  return (
    <AppShell current="events">
      <AppPage
        kicker="Acara Kampus"
        title="Kegiatan kampus, bertemu di tempat publik"
        description="Temukan seminar, workshop, meetup, hackathon, dan kegiatan kampus lainnya. Kamu tetap memakai nama samaran saat mendaftar."
        mascot="girang"
        actions={
          !isSchool && eligibility?.eligible ? (
            <Link href="/app/events/create" className={appButton.primary}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Buat acara
            </Link>
          ) : undefined
        }
      >
          {isSchool ? (
            <Notice tone="info" title="Akun sekolah">
              Akun dengan email sekolah bisa mengikuti acara edukatif seperti belajar bareng, workshop, seminar,
              dan persiapan ujian. Cari Teman, Circle, dan Pesan terbuka setelah kamu masuk dengan email kampus dan
              lolos verifikasi.
            </Notice>
          ) : !eligibility?.eligible ? (
            <HelpTip label="Kenapa aku belum bisa membuat acara?">
              Kamu perlu menyelesaikan verifikasi mahasiswa atau mendapat izin dari tim StudyDate sebelum membuat
              acara. StudyDate Plus menambah kapasitas, bukan kepercayaan penyelenggara.
            </HelpTip>
          ) : null}

          <PendingFeedbackStrip events={pendingFeedback} />

          <FollowedCalendarStrip events={followedEvents} />

          {pendingInvitations.length ? (
            <Panel id="event-team-invitations" title="Undangan untuk membantu acara" description="Penyelenggara mengajakmu jadi bagian tim. Terima kalau kamu bisa membantu.">
              <div className="divide-y divide-brand-border">
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
                            className={response === "accept" ? appButton.primary : appButton.quiet}
                          >
                            {response === "accept" ? "Terima" : "Tolak"}
                          </button>
                        </form>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          ) : null}

          {activeAssignments.length ? (
            <Panel id="event-team-active" title="Acara yang kamu kelola" quiet>
              <div className="divide-y divide-brand-border">
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
                      className={appButton.secondary}
                    >
                      Buka pengelolaan acara
                    </Link>
                  </article>
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel
            id="event-filter"
            title="Cari acara mendatang"
            description="Cari berdasarkan nama atau jenis acara, lalu pilih siapa yang boleh melihatnya."
          >
            <EventFilterForm
              filters={filters}
              allowedCategories={isSchool ? EDUCATIONAL_EVENT_CATEGORIES : undefined}
            />
            {!parsed.success ? (
              <div className="mt-4">
                <Notice tone="danger">Pilihan pencarian tidak valid. Hapus pilihan lalu coba lagi.</Notice>
              </div>
            ) : null}
          </Panel>

          <section aria-labelledby="event-results-title">
            <div className="max-w-2xl">
              <p className="app-kicker">Acara mendatang</p>
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
                  className={appButton.secondary}
                >
                  Muat lebih banyak
                </Link>
              </div>
            ) : null}
          </section>
      </AppPage>
    </AppShell>
  );
}

export default function EventsPage(props: EventsPageProps) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-sm text-brand-muted">
            Menyiapkan acara kampus...
          </p>
        </main>
      }
    >
      <EventsContent {...props} />
    </Suspense>
  );
}
