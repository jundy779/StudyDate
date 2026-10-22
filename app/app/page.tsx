import { AppShell } from "@/components/app/app-shell";
import { AppPage, Panel, StatusChip, TodoItem, appButton } from "@/components/app/ui";
import { getMyStudentAccess, SCHOOL_HIDDEN_NAV_KEYS } from "@/lib/account/student-access";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { listMyPendingEventFeedback } from "@/lib/events/after";
import { countPendingReceivedIntroductions } from "@/lib/introductions/service";
import { countUnreadConversations } from "@/lib/messages/service";
import { countUnreadNotifications } from "@/lib/notifications/service";
import { VERIFICATION_STATUS_LABELS } from "@/lib/verification/constants";
import { getLatestVerificationStatus } from "@/lib/verification/status";
import {
  Bell,
  CalendarDays,
  Handshake,
  MessageSquare,
  Network,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

const productAreas = [
  {
    key: "people",
    title: "Cari Teman",
    description: "Temukan orang yang punya minat dan tujuan yang sama.",
    icon: Users,
    href: "/app/people",
  },
  {
    key: "circles",
    title: "Circle Belajar",
    description: "Belajar bareng kelompok kecil, satu kampus atau lintas kampus.",
    icon: Network,
    href: "/app/circles",
  },
  {
    key: "events",
    title: "Acara Kampus",
    description: "Seminar, workshop, dan kumpul belajar yang bisa kamu ikuti.",
    icon: CalendarDays,
    href: "/app/events",
  },
  {
    key: "introductions",
    title: "Perkenalan",
    description: "Ajakan kenalan yang masuk dan yang sudah kamu kirim.",
    icon: Handshake,
    href: "/app/introductions",
  },
  {
    key: "messages",
    title: "Pesan",
    description: "Ngobrol tanpa membuka nama asli sampai kalian sama-sama siap.",
    icon: MessageSquare,
    href: "/app/messages",
  },
] as const;

const verificationTone = {
  verified: "go",
  pending: "info",
  under_review: "info",
  needs_action: "warn",
  rejected: "stop",
  expired: "muted",
  cancelled: "muted",
} as const;

async function PrivateAppHome() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) {
    redirect("/onboarding");
  }

  const [verification, access, pendingIntroductions, unreadMessages, unreadNotifications, pendingFeedback] =
    await Promise.all([
      getLatestVerificationStatus(user.id),
      getMyStudentAccess(),
      countPendingReceivedIntroductions().catch(() => 0),
      countUnreadConversations().catch(() => 0),
      countUnreadNotifications().catch(() => 0),
      listMyPendingEventFeedback().catch(() => []),
    ]);
  const verificationLabel = verification
    ? VERIFICATION_STATUS_LABELS[verification.status]
    : "Belum terverifikasi";
  const verified = verification?.status === "verified";
  const hidden: readonly string[] = access?.tier === "school" ? SCHOOL_HIDDEN_NAV_KEYS : [];
  const areas = productAreas.filter((area) => !hidden.includes(area.key));

  const todo = [
    !hidden.includes("introductions") && pendingIntroductions > 0
      ? {
          href: "/app/introductions",
          icon: Handshake,
          title: "Ajakan kenalan menunggu jawabanmu",
          description: "Terima kalau kamu mau ngobrol, atau tolak dengan sopan. Nama aslimu tetap tertutup.",
          count: pendingIntroductions,
          urgent: true,
        }
      : null,
    !hidden.includes("messages") && unreadMessages > 0
      ? {
          href: "/app/messages",
          icon: MessageSquare,
          title: "Percakapan dengan pesan baru",
          description: "Ada yang membalas obrolanmu.",
          count: unreadMessages,
          urgent: false,
        }
      : null,
    pendingFeedback.length > 0
      ? {
          href: `/app/events/${pendingFeedback[0].public_slug}#ulasan`,
          icon: Star,
          title: "Beri ulasan acara yang kamu ikuti",
          description: `Mulai dari "${pendingFeedback[0].title}". Ulasanmu membantu penyelenggara.`,
          count: pendingFeedback.length,
          urgent: false,
        }
      : null,
    unreadNotifications > 0
      ? {
          href: "/app/notifications",
          icon: Bell,
          title: "Notifikasi belum dibaca",
          description: "Kabar dari Circle, acara, dan perkenalanmu.",
          count: unreadNotifications,
          urgent: false,
        }
      : null,
    !verified
      ? {
          href: "/app/verification",
          icon: ShieldCheck,
          title: "Verifikasi status mahasiswa",
          description: "Tanda terverifikasi membantu orang lain lebih percaya saat kamu kirim perkenalan.",
          count: null,
          urgent: false,
        }
      : null,
  ].filter((item) => item !== null);

  return (
    <AppShell
      current="home"
      pendingIntroductions={pendingIntroductions}
      unreadMessages={unreadMessages}
      unreadNotifications={unreadNotifications}
    >
      <AppPage
        kicker="Beranda kamu"
        title={`Halo, ${profile.first_name}`}
        description={
          <>
            Orang lain melihatmu sebagai{" "}
            <strong className="font-semibold text-brand-navy">{profile.public_alias}</strong>. Kenalan dimulai
            tanpa membuka nama asli, dan kamu yang memutuskan kapan lanjut.
          </>
        }
        mascot={todo.length > 1 ? "penasaran" : "girang"}
        actions={
          <Link href="/app/profile" className={appButton.secondary}>
            Atur profil
          </Link>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel
            title={todo.length ? "Yang menunggu kamu" : "Semua beres"}
            description={
              todo.length
                ? "Mulai dari yang paling atas."
                : "Belum ada yang perlu dijawab. Saatnya cari teman atau acara baru."
            }
          >
            {todo.length ? (
              <ul className="grid gap-3">
                {todo.map((item) => (
                  <TodoItem key={item.href} {...item} />
                ))}
              </ul>
            ) : (
              <div className="flex flex-wrap gap-2">
                {!hidden.includes("people") ? (
                  <Link href="/app/people" className={appButton.primary}>
                    Cari teman
                  </Link>
                ) : null}
                <Link href="/app/events" className={appButton.secondary}>
                  Lihat acara
                </Link>
              </div>
            )}
          </Panel>

          <Panel title="Profil kamu" quiet>
            <dl className="grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-surface px-4 py-3">
                <dt className="text-brand-muted">Nama samaran</dt>
                <dd className="font-semibold text-brand-navy">{profile.public_alias}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-surface px-4 py-3">
                <dt className="text-brand-muted">Kampus</dt>
                <dd className="text-right font-semibold text-brand-navy">{profile.campus}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-surface px-4 py-3">
                <dt className="text-brand-muted">Status verifikasi</dt>
                <dd>
                  <StatusChip
                    tone={
                      verification
                        ? verificationTone[verification.status as keyof typeof verificationTone] ?? "muted"
                        : "muted"
                    }
                  >
                    {verificationLabel}
                  </StatusChip>
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/app/profile" className={appButton.quiet}>
                Edit profil
              </Link>
              <Link href="/app/account/privacy" className={appButton.quiet}>
                Privasi dan keamanan
              </Link>
            </div>
          </Panel>
        </div>

        <Panel title="Semua ruang sosialmu" description="Pilih mau mulai dari mana." quiet>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {areas.map(({ title, description, icon: Icon, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="focus-ring group flex h-full items-start gap-3 rounded-2xl border border-brand-border bg-white p-4 transition-colors hover:border-brand-navy"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EAF1FF] text-brand-blue">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold text-brand-navy group-hover:text-brand-blue">{title}</span>
                    <span className="mt-0.5 block text-sm leading-5 text-brand-muted">{description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </AppPage>
    </AppShell>
  );
}

export default function AppHomePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface px-5 py-10">
          <p className="page-shell text-sm text-brand-muted">Menyiapkan ruang privatmu...</p>
        </main>
      }
    >
      <PrivateAppHome />
    </Suspense>
  );
}
