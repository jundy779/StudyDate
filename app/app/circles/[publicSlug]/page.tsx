import {
  archiveCircleAction,
  joinCircleAction,
  leaveCircleAction,
  removeCircleMemberAction,
  reportCircleAction,
  updateCircleAction,
} from "@/app/app/circles/actions";
import { AppShell } from "@/components/app/app-shell";
import { CircleForm } from "@/components/circles/circle-form";
import { CircleMessageForm } from "@/components/circles/circle-message-form";
import { SendIntroductionDialog } from "@/components/introductions/send-introduction-dialog";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  circleScopeLabels,
  circleTopicLabels,
} from "@/lib/circles/constants";
import {
  getCircle,
  listCircleMembers,
  listCircleMessages,
} from "@/lib/circles/service";
import { circleSlugSchema } from "@/lib/circles/validation";
import { getIntroductionSendEligibility } from "@/lib/introductions/service";
import { getMascotForAlias } from "@/lib/people/constants";
import {
  Archive,
  BadgeCheck,
  BookOpenText,
  LockKeyhole,
  ShieldAlert,
  UserMinus,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type CircleDetailPageProps = {
  params: Promise<{ publicSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const reportReasons = [
  { value: "harassment", label: "Pelecehan" },
  { value: "spam", label: "Spam" },
  { value: "contact_pressure", label: "Tekanan berbagi kontak" },
  { value: "fake_or_misleading", label: "Menyesatkan" },
  { value: "other", label: "Lainnya" },
] as const;

function ReportFields() {
  return (
    <>
      <label className="block text-xs font-semibold text-brand-navy">
        Alasan
        <select
          name="reasonCode"
          required
          defaultValue="other"
          className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm"
        >
          {reportReasons.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-xs font-semibold text-brand-navy">
        Detail opsional
        <textarea
          name="details"
          rows={3}
          maxLength={300}
          className="focus-ring mt-2 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm leading-6"
        />
      </label>
    </>
  );
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function CircleDetailPage({
  params,
  searchParams,
}: CircleDetailPageProps) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const ownProfile = await getPrivateProfile(user.id);
  if (!ownProfile?.onboarding_completed_at) redirect("/onboarding");

  const { publicSlug: rawSlug } = await params;
  const parsedSlug = circleSlugSchema.safeParse(rawSlug);
  if (!parsedSlug.success) notFound();
  const circle = await getCircle(parsedSlug.data);
  if (!circle) notFound();

  const query = await searchParams;
  const state = Array.isArray(query.state) ? query.state[0] : query.state;
  const notice = Array.isArray(query.notice) ? query.notice[0] : query.notice;
  const isActiveMember = circle.membership_state === "active";
  const [memberRows, messagePage] = isActiveMember
    ? await Promise.all([
        listCircleMembers(circle.public_slug),
        listCircleMessages(circle.public_slug),
      ])
    : [[], { messages: [], hasMore: false }];
  const eligibilityEntries = isActiveMember
    ? await Promise.all(
        memberRows
          .filter((member) => member.public_alias !== "Akun dihapus")
          .map(async (member) => [
          member.public_alias,
          await getIntroductionSendEligibility(member.public_alias),
          ] as const),
      )
    : [];
  const eligibilityByAlias = new Map(eligibilityEntries);

  const successCopy: Record<string, string> = {
    created: "Study Circle berhasil dibuat.",
    updated: "Detail Circle berhasil diperbarui.",
    joined: "Kamu sudah bergabung ke Circle.",
    left: "Kamu sudah meninggalkan Circle.",
    "member-removed": "Anggota telah dikeluarkan dari Circle.",
    archived: "Circle diarsipkan. Anggota aktif masih dapat membaca riwayat.",
    reported: "Laporan telah dikirim secara privat untuk ditinjau.",
    "message-sent": "Pesan terkirim ke Circle.",
  };

  return (
    <AppShell current="circles">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell py-8 sm:py-12 lg:py-16">
          <Link
            href="/app/circles"
            className="focus-ring inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-brand-muted hover:text-brand-blue"
          >
            ← Kembali ke Study Circle
          </Link>

          {state && successCopy[state] ? (
            <p
              role="status"
              className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-brand-blue"
            >
              {successCopy[state]}
            </p>
          ) : null}
          {notice ? (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-brand-error"
            >
              {notice}
            </p>
          ) : state === "error" || state === "invalid" ? (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-brand-error"
            >
              Tindakan belum dapat diproses. Coba lagi sebentar.
            </p>
          ) : null}

          <header className="mt-7 grid gap-8 border-b border-brand-border pb-9 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-blue">
                <span>{circleTopicLabels.get(circle.topic) ?? circle.topic}</span>
                <span aria-hidden="true">•</span>
                <span>{circleScopeLabels.get(circle.scope) ?? circle.scope}</span>
                {circle.status === "archived" ? <span>Diarsipkan</span> : null}
              </div>
              <h1 className="mt-4 break-words font-heading text-4xl font-semibold tracking-[-0.035em] text-brand-navy sm:text-5xl">
                {circle.name}
              </h1>
              <p className="mt-5 max-w-3xl whitespace-pre-wrap break-words text-lg leading-8 text-brand-muted">
                {circle.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-muted">
                <span className="inline-flex items-center gap-2">
                  <UsersRound className="h-4 w-4" aria-hidden="true" />
                  {circle.member_count} dari {circle.member_limit} anggota
                </span>
                {circle.scope === "campus" ? (
                  <span className="inline-flex items-center gap-2">
                    <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                    {circle.campus_scope}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="space-y-3">
              {circle.can_join ? (
                <form action={joinCircleAction}>
                  <input type="hidden" name="publicSlug" value={circle.public_slug} />
                  <button
                    type="submit"
                    className="focus-ring min-h-12 w-full rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
                  >
                    Bergabung ke Circle
                  </button>
                </form>
              ) : null}
              {circle.can_leave ? (
                <form action={leaveCircleAction}>
                  <input type="hidden" name="publicSlug" value={circle.public_slug} />
                  <button
                    type="submit"
                    className="focus-ring min-h-12 w-full rounded-xl border border-brand-border bg-white px-5 text-sm font-semibold text-brand-navy"
                  >
                    Tinggalkan Circle
                  </button>
                </form>
              ) : null}
              {!circle.is_owner ? (
                <details className="rounded-xl border border-brand-border bg-white p-4">
                  <summary className="focus-ring cursor-pointer rounded-lg text-sm font-semibold text-brand-muted">
                    Laporkan Circle
                  </summary>
                  <form action={reportCircleAction} className="mt-4">
                    <input type="hidden" name="publicSlug" value={circle.public_slug} />
                    <ReportFields />
                    <button
                      type="submit"
                      className="focus-ring mt-4 min-h-11 w-full rounded-xl border border-brand-error px-4 text-sm font-semibold text-brand-error"
                    >
                      Kirim laporan
                    </button>
                  </form>
                </details>
              ) : null}
            </div>
          </header>

          {!isActiveMember ? (
            <section className="py-12" aria-labelledby="circle-member-gate">
              <div className="max-w-2xl">
                <BookOpenText className="h-8 w-8 text-brand-blue" aria-hidden="true" />
                <h2
                  id="circle-member-gate"
                  className="mt-4 font-heading text-2xl font-semibold text-brand-navy"
                >
                  Diskusi dan anggota tersedia setelah bergabung
                </h2>
                <p className="mt-3 text-sm leading-7 text-brand-muted">
                  Bergabung tidak membuat percakapan privat, Mutual Interest,
                  Identity Reveal, atau Contact Reveal. Semua tahap koneksi tetap
                  memakai persetujuan StudyDate yang terpisah.
                </p>
              </div>
            </section>
          ) : (
            <div className="grid gap-10 py-10 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
              <section id="diskusi" aria-labelledby="circle-discussion-title">
                <p className="section-label">Diskusi anggota</p>
                <h2
                  id="circle-discussion-title"
                  className="mt-2 font-heading text-2xl font-semibold text-brand-navy"
                >
                  Obrolan tentang topik belajar
                </h2>
                <p className="mt-2 text-sm leading-6 text-brand-muted">
                  Ini ruang grup anggota, bukan Anonymous Chat privat.
                </p>
                <div className="mt-6 overflow-hidden rounded-[22px] border border-brand-border bg-white">
                  <div className="max-h-[620px] space-y-0 overflow-y-auto" aria-live="polite">
                    {messagePage.messages.length ? (
                      messagePage.messages.map((message) => (
                        <article
                          key={message.message_public_id}
                          className="border-b border-brand-border px-5 py-5 last:border-0 sm:px-6"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-end justify-center overflow-hidden rounded-xl bg-brand-surface">
                              <Image
                                src={getMascotForAlias(message.author_alias)}
                                alt=""
                                width={40}
                                height={40}
                                className="h-10 w-10 object-contain object-bottom"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-brand-navy">
                                  {message.author_alias}
                                </h3>
                                {message.author_is_verified ? (
                                  <BadgeCheck className="h-4 w-4 text-brand-blue" aria-label="Terverifikasi" />
                                ) : null}
                                {message.is_mine ? (
                                  <span className="text-xs text-brand-muted">Pesanmu</span>
                                ) : null}
                              </div>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-brand-navy">
                                {message.body}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                <time
                                  dateTime={message.created_at}
                                  className="text-xs text-brand-muted"
                                >
                                  {formatTimestamp(message.created_at)}
                                </time>
                                {!message.is_mine &&
                                message.author_alias !== "Akun dihapus" ? (
                                  <details>
                                    <summary className="focus-ring cursor-pointer rounded text-xs font-semibold text-brand-muted">
                                      Laporkan pesan
                                    </summary>
                                    <form
                                      action={reportCircleAction}
                                      className="mt-3 w-[min(70vw,260px)] rounded-xl bg-brand-surface p-3"
                                    >
                                      <input type="hidden" name="publicSlug" value={circle.public_slug} />
                                      <input type="hidden" name="memberAlias" value={message.author_alias} />
                                      <input type="hidden" name="messagePublicId" value={message.message_public_id} />
                                      <ReportFields />
                                      <button
                                        type="submit"
                                        className="focus-ring mt-3 min-h-10 w-full rounded-lg border border-brand-error text-xs font-semibold text-brand-error"
                                      >
                                        Kirim laporan
                                      </button>
                                    </form>
                                  </details>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="px-6 py-12 text-center">
                        <p className="font-heading text-xl font-semibold text-brand-navy">
                          Belum ada obrolan
                        </p>
                        <p className="mt-2 text-sm leading-6 text-brand-muted">
                          Mulai dari topik yang sedang kalian pelajari.
                        </p>
                      </div>
                    )}
                  </div>
                  {messagePage.hasMore ? (
                    <p className="border-t border-brand-border px-5 py-3 text-xs text-brand-muted">
                      Menampilkan 50 pesan terbaru. Pagination riwayat lengkap
                      akan ditambahkan setelah penggunaan v1 tervalidasi.
                    </p>
                  ) : null}
                  {circle.status === "active" ? (
                    <div className="p-5 sm:p-6">
                      <CircleMessageForm publicSlug={circle.public_slug} />
                    </div>
                  ) : (
                    <p className="border-t border-brand-border px-5 py-5 text-sm text-brand-muted">
                      Circle sudah diarsipkan. Riwayat tetap dapat dibaca anggota aktif.
                    </p>
                  )}
                </div>
              </section>

              <aside aria-labelledby="circle-members-title">
                <p className="section-label">Anggota</p>
                <h2
                  id="circle-members-title"
                  className="mt-2 font-heading text-2xl font-semibold text-brand-navy"
                >
                  Profil anonim yang aman
                </h2>
                <p className="mt-2 text-sm leading-6 text-brand-muted">
                  Keanggotaan tidak membuka nama, foto privat, atau kontak.
                </p>
                <div className="mt-6 divide-y divide-brand-border rounded-[22px] border border-brand-border bg-white">
                  {memberRows.map((member) => {
                    const eligibility = eligibilityByAlias.get(member.public_alias);
                    return (
                      <article key={member.public_alias} className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-end justify-center overflow-hidden rounded-xl bg-brand-surface">
                            <Image
                              src={getMascotForAlias(member.public_alias)}
                              alt=""
                              width={44}
                              height={44}
                              className="h-11 w-11 object-contain object-bottom"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="break-words font-semibold text-brand-navy">
                                {member.public_alias}
                              </h3>
                              {member.circle_role === "owner" ? (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-brand-blue">
                                  Owner
                                </span>
                              ) : null}
                            </div>
                            {member.public_alias !== "Akun dihapus" ? (
                              <p className="mt-1 break-words text-xs leading-5 text-brand-muted">
                                {member.study_program} · {member.campus}
                                {member.semester ? ` · Semester ${member.semester}` : ""}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        {eligibility?.can_send ? (
                          <div className="mt-4 rounded-xl bg-brand-navy p-4">
                            <SendIntroductionDialog
                              alias={member.public_alias}
                              canSend
                            />
                          </div>
                        ) : null}
                        {member.public_alias !== ownProfile.public_alias &&
                        member.public_alias !== "Akun dihapus" ? (
                          <details className="mt-3">
                            <summary className="focus-ring cursor-pointer rounded text-xs font-semibold text-brand-muted">
                              Tindakan anggota
                            </summary>
                            <div className="mt-3 space-y-3 rounded-xl bg-brand-surface p-3">
                              <form action={reportCircleAction}>
                                <input type="hidden" name="publicSlug" value={circle.public_slug} />
                                <input type="hidden" name="memberAlias" value={member.public_alias} />
                                <ReportFields />
                                <button
                                  type="submit"
                                  className="focus-ring mt-3 min-h-10 w-full rounded-lg border border-brand-border text-xs font-semibold text-brand-muted"
                                >
                                  Laporkan anggota
                                </button>
                              </form>
                              {circle.is_owner && member.circle_role === "member" && circle.status === "active" ? (
                                <form action={removeCircleMemberAction}>
                                  <input type="hidden" name="publicSlug" value={circle.public_slug} />
                                  <input type="hidden" name="memberAlias" value={member.public_alias} />
                                  <button
                                    type="submit"
                                    className="focus-ring inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-brand-error text-xs font-semibold text-brand-error"
                                  >
                                    <UserMinus className="h-4 w-4" aria-hidden="true" />
                                    Keluarkan anggota
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          </details>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </aside>
            </div>
          )}

          {circle.is_owner ? (
            <section className="border-t border-brand-border py-10" aria-labelledby="circle-owner-title">
              <div className="max-w-3xl">
                <p className="section-label">Kontrol Circle</p>
                <h2
                  id="circle-owner-title"
                  className="mt-2 font-heading text-2xl font-semibold text-brand-navy"
                >
                  Kelola sebagai owner
                </h2>
                <p className="mt-2 text-sm leading-6 text-brand-muted">
                  Owner hanya dapat mengelola Circle ini. Akses staff, Anonymous
                  Chat, Identity Reveal, dan Contact Reveal tetap tertutup.
                </p>
              </div>
              {circle.status === "active" ? (
                <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="rounded-[22px] border border-brand-border bg-white p-5 sm:p-7">
                    <CircleForm
                      action={updateCircleAction}
                      circle={circle}
                      submitLabel="Simpan perubahan"
                    />
                  </div>
                  <div className="rounded-[22px] border border-brand-border bg-white p-5">
                    <Archive className="h-6 w-6 text-brand-blue" aria-hidden="true" />
                    <h3 className="mt-4 font-heading text-lg font-semibold text-brand-navy">
                      Arsipkan Circle
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-brand-muted">
                      Mencegah join dan pesan baru. Riwayat tetap tersedia bagi
                      anggota aktif dan bukti laporan tidak dihapus.
                    </p>
                    <form action={archiveCircleAction} className="mt-5">
                      <input type="hidden" name="publicSlug" value={circle.public_slug} />
                      <button
                        type="submit"
                        className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-navy px-4 text-sm font-semibold text-brand-navy"
                      >
                        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                        Arsipkan Circle
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <p className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-brand-muted">
                  <Archive className="h-4 w-4" aria-hidden="true" />
                  Circle ini sudah diarsipkan.
                </p>
              )}
            </section>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}
