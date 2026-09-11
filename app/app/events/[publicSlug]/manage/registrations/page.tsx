import { manageCampusEventRegistrationAction } from "@/app/app/events/actions";
import { AppShell } from "@/components/app/app-shell";
import { EventManagementShell } from "@/components/events/event-management-shell";
import {
  EVENT_REGISTRATION_STATUSES,
  type EventRegistrationStatus,
} from "@/lib/events/constants";
import { getCampusEventManagement } from "@/lib/events/management";
import {
  listCampusEventRegistrationQuestions,
  listCampusEventRegistrations,
} from "@/lib/events/service";
import { eventRegistrationListSchema } from "@/lib/events/validation";
import Link from "next/link";

type RegistrationsPageProps = {
  params: Promise<{ publicSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const statusLabels: Record<EventRegistrationStatus, string> = {
  pending: "Menunggu",
  going: "Diterima",
  waitlisted: "Daftar tunggu",
  declined: "Ditolak",
  cancelled: "Dibatalkan",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatAnswer(value: string | string[] | boolean) {
  if (Array.isArray(value)) return value.join(", ") || "Tidak dijawab";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  return value || "Tidak dijawab";
}

export default async function RegistrationsPage({
  params,
  searchParams,
}: RegistrationsPageProps) {
  const { publicSlug } = await params;
  const { event, overview } = await getCampusEventManagement(
    publicSlug,
    "registrations",
  );
  const query = await searchParams;
  const rawStatus = first(query.status);
  const state = first(query.state);
  const notice = first(query.notice);
  const parsed = eventRegistrationListSchema.safeParse({
    publicSlug: event.public_slug,
    status: rawStatus === "all" ? undefined : rawStatus,
    beforeRsvpedAt: first(query.before),
    beforePublicId: first(query.cursor),
  });
  const input = parsed.success
    ? parsed.data
    : { publicSlug: event.public_slug };
  const [{ registrations, nextCursor }, questions] = await Promise.all([
    listCampusEventRegistrations(input),
    listCampusEventRegistrationQuestions(event.public_slug),
  ]);
  const prompts = new Map(
    questions.map((question) => [question.question_public_id, question.prompt]),
  );
  const activeStatus =
    rawStatus && EVENT_REGISTRATION_STATUSES.includes(rawStatus as EventRegistrationStatus)
      ? (rawStatus as EventRegistrationStatus)
      : "all";
  const base = `/app/events/${event.public_slug}/manage/registrations`;

  return (
    <AppShell current="events">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <EventManagementShell
          active="registrations"
          event={event}
          overview={overview}
        >
          {state?.startsWith("registration-") ? (
            <p
              role="status"
              className="mb-7 border-l-2 border-brand-blue pl-4 text-sm font-medium text-brand-blue"
            >
              Keputusan registrasi berhasil disimpan.
            </p>
          ) : null}
          {notice ? (
            <p
              role="alert"
              className="mb-7 border-l-2 border-brand-error pl-4 text-sm font-medium text-brand-error"
            >
              {notice}
            </p>
          ) : null}
          <section aria-labelledby="registration-list-title">
            <p className="section-label">Pendaftaran</p>
            <h2
              id="registration-list-title"
              className="mt-2 font-heading text-2xl font-semibold text-brand-navy"
            >
              Kelola keputusan peserta
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-brand-muted">
              Daftar dibatasi 50 registrasi per halaman. Pencarian bebas tidak
              disediakan agar data tidak diperluas di browser.
            </p>

            <nav
              aria-label="Filter status registrasi"
              className="mt-6 flex gap-2 overflow-x-auto pb-2"
            >
              {(["all", ...EVENT_REGISTRATION_STATUSES] as const).map((status) => (
                <Link
                  key={status}
                  href={status === "all" ? base : `${base}?status=${status}`}
                  aria-current={activeStatus === status ? "page" : undefined}
                  className={`focus-ring inline-flex min-h-11 shrink-0 items-center rounded-xl border px-4 text-sm font-semibold ${
                    activeStatus === status
                      ? "border-brand-blue bg-brand-blue text-white"
                      : "border-brand-border bg-white text-brand-muted"
                  }`}
                >
                  {status === "all" ? "Semua" : statusLabels[status]}
                </Link>
              ))}
            </nav>

            <div className="mt-6 divide-y divide-brand-border border-y border-brand-border">
              {registrations.map((registration) => (
                <article
                  key={registration.registration_public_id}
                  className="py-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words font-heading text-lg font-semibold text-brand-navy">
                          {registration.public_alias}
                        </h3>
                        <span className="text-xs font-semibold uppercase tracking-[0.09em] text-brand-blue">
                          {statusLabels[registration.registration_status]}
                        </span>
                        {registration.checked_in_at ? (
                          <span className="text-xs font-semibold text-emerald-700">
                            Sudah hadir
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 break-words text-sm leading-6 text-brand-muted">
                        {registration.campus} · {registration.study_program}
                        {registration.semester
                          ? ` · Semester ${registration.semester}`
                          : ""}
                      </p>
                    </div>
                    {registration.registration_status === "pending" ? (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <form action={manageCampusEventRegistrationAction}>
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
                          <button
                            name="action"
                            value="approve"
                            className="focus-ring min-h-11 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white"
                          >
                            Setujui
                          </button>
                        </form>
                        <form action={manageCampusEventRegistrationAction}>
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
                          <button
                            name="action"
                            value="decline"
                            className="focus-ring min-h-11 rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy"
                          >
                            Tolak dengan sopan
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>

                  {Object.keys(registration.registration_answers).length ? (
                    <details className="mt-4">
                      <summary className="focus-ring cursor-pointer rounded-lg text-sm font-semibold text-brand-blue">
                        Lihat jawaban registrasi
                      </summary>
                      <dl className="mt-4 grid gap-4 border-l-2 border-brand-border pl-4 sm:grid-cols-2">
                        {Object.entries(registration.registration_answers).map(
                          ([questionId, answer]) => (
                            <div key={questionId} className="min-w-0">
                              <dt className="break-words text-xs font-semibold text-brand-navy">
                                {prompts.get(questionId) ?? "Pertanyaan dihapus"}
                              </dt>
                              <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-brand-muted">
                                {formatAnswer(answer)}
                              </dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </details>
                  ) : null}
                </article>
              ))}
              {!registrations.length ? (
                <p className="py-10 text-sm leading-7 text-brand-muted">
                  Tidak ada registrasi pada status ini.
                </p>
              ) : null}
            </div>

            {nextCursor ? (
              <Link
                href={`${base}?${new URLSearchParams({
                  ...(activeStatus === "all" ? {} : { status: activeStatus }),
                  before: nextCursor.beforeRsvpedAt,
                  cursor: nextCursor.beforePublicId,
                })}`}
                className="focus-ring mt-7 inline-flex min-h-11 items-center rounded-xl border border-brand-border bg-white px-5 text-sm font-semibold text-brand-navy"
              >
                Halaman berikutnya
              </Link>
            ) : null}
          </section>
        </EventManagementShell>
      </main>
    </AppShell>
  );
}
