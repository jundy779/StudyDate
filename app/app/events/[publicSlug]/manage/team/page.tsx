import {
  inviteCampusEventTeamMemberAction,
  removeCampusEventTeamMemberAction,
} from "@/app/app/events/actions";
import { AppShell } from "@/components/app/app-shell";
import { EventManagementShell } from "@/components/events/event-management-shell";
import { getCampusEventManagement } from "@/lib/events/management";
import { listCampusEventTeamMembers } from "@/lib/events/service";

type TeamPageProps = {
  params: Promise<{ publicSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TeamPage({
  params,
  searchParams,
}: TeamPageProps) {
  const { publicSlug } = await params;
  const { event, overview } = await getCampusEventManagement(publicSlug, "team");
  const teamMembers = await listCampusEventTeamMembers(event.public_slug);
  const query = await searchParams;
  const state = first(query.state);
  const notice = first(query.notice);

  return (
    <AppShell current="events">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <EventManagementShell active="team" event={event} overview={overview}>
          <section aria-labelledby="event-team-title">
            <p className="app-kicker">Tim acara</p>
            <h2
              id="event-team-title"
              className="mt-2 font-heading text-2xl font-semibold text-brand-navy"
            >
              Undang tim melalui alias
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-brand-muted">
              Gunakan alias StudyDate secara tepat. Undangan tidak membuka nama,
              email, kontak, atau data akun privat.
            </p>

            {state === "team-invited" ? (
              <p
                role="status"
                className="mt-5 border-l-2 border-brand-blue pl-4 text-sm font-medium text-brand-blue"
              >
                Undangan tim telah dikirim.
              </p>
            ) : null}
            {state === "team-removed" ? (
              <p
                role="status"
                className="mt-5 border-l-2 border-brand-blue pl-4 text-sm font-medium text-brand-blue"
              >
                Anggota telah dihapus dari tim acara.
              </p>
            ) : null}
            {notice ? (
              <p
                role="alert"
                className="mt-5 border-l-2 border-brand-error pl-4 text-sm font-medium text-brand-error"
              >
                {notice}
              </p>
            ) : null}

            <form
              action={inviteCampusEventTeamMemberAction}
              className="mt-7 max-w-2xl space-y-5 border-y border-brand-border py-6"
            >
              <input type="hidden" name="publicSlug" value={event.public_slug} />
              <div>
                <label
                  htmlFor="event-team-alias"
                  className="text-sm font-semibold text-brand-navy"
                >
                  Alias StudyDate
                </label>
                <input
                  id="event-team-alias"
                  name="publicAlias"
                  required
                  minLength={1}
                  maxLength={80}
                  autoComplete="off"
                  placeholder="Contoh: Partner #100001"
                  className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm"
                />
              </div>
              <fieldset>
                <legend className="text-sm font-semibold text-brand-navy">Peran</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex min-h-20 items-start gap-3 rounded-xl border border-brand-border bg-white p-4 focus-within:ring-2 focus-within:ring-brand-blue/40">
                    <input
                      type="radio"
                      name="role"
                      value="cohost"
                      required
                      defaultChecked
                      className="mt-1 h-4 w-4 accent-brand-blue"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-brand-navy">
                        Rekan penyelenggara
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-brand-muted">
                        Mengelola pendaftaran dan kehadiran peserta.
                      </span>
                    </span>
                  </label>
                  <label className="flex min-h-20 items-start gap-3 rounded-xl border border-brand-border bg-white p-4 focus-within:ring-2 focus-within:ring-brand-blue/40">
                    <input
                      type="radio"
                      name="role"
                      value="checkin_staff"
                      className="mt-1 h-4 w-4 accent-brand-blue"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-brand-navy">
                        Petugas kehadiran
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-brand-muted">
                        Hanya mengelola daftar hadir dan pemindai tiket.
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>
              <button className="focus-ring min-h-12 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white">
                Kirim undangan
              </button>
            </form>

            <aside className="mt-7 max-w-2xl text-sm leading-7 text-brand-muted">
              <h3 className="font-semibold text-brand-navy">Anggota tim saat ini</h3>
              {teamMembers.length ? (
                <div className="mt-4 divide-y divide-brand-border border-y border-brand-border">
                  {teamMembers.map((member) => (
                    <article
                      key={member.public_alias}
                      className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-brand-navy">
                          {member.public_alias}
                        </p>
                        <p className="text-xs text-brand-muted">
                          {member.team_role === "cohost"
                            ? "Rekan penyelenggara"
                            : "Petugas kehadiran"}{" "}
                          ·{" "}
                          {member.invitation_status === "active"
                            ? "Aktif"
                            : "Menunggu jawaban"}
                        </p>
                      </div>
                      {member.public_alias !== "Akun dihapus" ? (
                        <form action={removeCampusEventTeamMemberAction}>
                          <input
                            type="hidden"
                            name="publicSlug"
                            value={event.public_slug}
                          />
                          <input
                            type="hidden"
                            name="publicAlias"
                            value={member.public_alias}
                          />
                          <button className="focus-ring min-h-11 rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-navy">
                            Hapus dari tim
                          </button>
                        </form>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-2">Belum ada anggota tim aktif atau menunggu.</p>
              )}
            </aside>
          </section>
        </EventManagementShell>
      </main>
    </AppShell>
  );
}
