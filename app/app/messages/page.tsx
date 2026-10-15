import { AppShell } from "@/components/app/app-shell";
import { MascotEmptyState } from "@/components/brand/mascot-empty-state";
import { ConversationListItem } from "@/components/messages/conversation-list-item";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  CONVERSATION_VIEWS,
  filterConversations,
  normalizeConversationQuery,
  parseConversationView,
  searchConversations,
  type ConversationView,
} from "@/lib/messages/filters";
import {
  countUnreadConversations,
  listMyConversations,
} from "@/lib/messages/service";
import { Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

type MessagesPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    state?: string | string[];
    view?: string | string[];
  }>;
};

const stateMessages: Record<string, string> = {
  error: "Pesan belum dapat dimuat. Coba lagi sebentar.",
};

const emptyStates: Record<
  ConversationView,
  {
    title: string;
    description: string;
    action?: { href: string; label: string };
  }
> = {
  all: {
    title: "Belum ada percakapan",
    description:
      "Percakapan anonim akan muncul setelah sebuah perkenalan diterima.",
    action: { href: "/app/people", label: "Cari teman" },
  },
  unread: {
    title: "Semua pesan sudah dibaca",
    description:
      "Belum ada pesan baru. Percakapan lain tetap bisa dibuka dari pilihan Semua.",
  },
  active: {
    title: "Belum ada percakapan aktif",
    description:
      "Mulai dari Cari Teman, lalu kirim perkenalan ke orang yang ingin kamu kenal.",
    action: { href: "/app/people", label: "Cari teman" },
  },
  ended: {
    title: "Belum ada percakapan selesai",
    description:
      "Percakapan yang sudah diakhiri atau tidak tersedia akan muncul di sini.",
  },
};

function messagesHref(view: ConversationView, query: string) {
  const params = new URLSearchParams();
  if (view !== "all") params.set("view", view);
  if (query) params.set("q", query);
  const suffix = params.toString();
  return suffix ? `/app/messages?${suffix}` : "/app/messages";
}

async function MessagesContent({ searchParams }: MessagesPageProps) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const params = await searchParams;
  const [conversations, unreadConversations] = await Promise.all([
    listMyConversations(),
    countUnreadConversations(),
  ]);

  const state = Array.isArray(params.state) ? params.state[0] : params.state;
  const selectedView = parseConversationView(params.view);
  const searchQuery = normalizeConversationQuery(params.q);
  const filteredConversations = filterConversations(
    conversations,
    selectedView,
  );
  const visibleConversations = searchConversations(
    filteredConversations,
    searchQuery,
  );
  const stateMessage = state ? stateMessages[state] : null;
  const emptyState = searchQuery
    ? {
        title: "Belum ketemu",
        description:
          "Coba cari dengan nama samaran, kampus, atau program studi yang berbeda.",
        action: {
          href: messagesHref(selectedView, ""),
          label: "Hapus pencarian",
        },
      }
    : emptyStates[selectedView];

  return (
    <AppShell current="messages" unreadMessages={unreadConversations}>
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell py-8 sm:py-12 lg:py-16">
          <p className="section-label">Percakapan anonim</p>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-5xl">
            Pesan
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-brand-muted">
            Lanjutkan perkenalan yang sudah diterima. Identitas dan kontak tetap
            tertutup.
          </p>

          {stateMessage ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-6 rounded-xl border border-brand-border bg-white px-4 py-3 text-sm leading-6 text-brand-navy"
            >
              {stateMessage}
            </p>
          ) : null}

          <form
            action="/app/messages"
            method="get"
            role="search"
            className="mt-8 flex max-w-3xl flex-col gap-2 sm:flex-row"
          >
            {selectedView !== "all" ? (
              <input type="hidden" name="view" value={selectedView} />
            ) : null}
            <label htmlFor="conversation-search" className="sr-only">
              Cari percakapan
            </label>
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-muted"
              />
              <input
                id="conversation-search"
                name="q"
                type="search"
                maxLength={80}
                defaultValue={searchQuery}
                autoComplete="off"
                placeholder="Cari nama samaran, kampus, atau program studi"
                className="focus-ring min-h-12 w-full rounded-xl border border-brand-border bg-white py-3 pl-12 pr-4 text-sm text-brand-navy placeholder:text-brand-muted"
              />
            </div>
            <button
              type="submit"
              className="focus-ring inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-navy px-5 text-sm font-semibold text-white hover:bg-brand-blue"
            >
              Cari
            </button>
            {searchQuery ? (
              <Link
                href={messagesHref(selectedView, "")}
                className="focus-ring inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold text-brand-muted hover:text-brand-navy"
              >
                Hapus
              </Link>
            ) : null}
          </form>

          <div className="mt-5 max-w-3xl">
            <nav
              aria-label="Filter daftar pesan"
              className="grid grid-cols-2 gap-1 rounded-xl border border-brand-border bg-white p-1 sm:flex sm:flex-wrap"
            >
              {CONVERSATION_VIEWS.map((view) => {
                const active = selectedView === view.value;
                return (
                  <Link
                    key={view.value}
                    href={messagesHref(view.value, searchQuery)}
                    aria-current={active ? "page" : undefined}
                    className={`focus-ring inline-flex min-h-11 min-w-0 items-center justify-center rounded-lg px-3 text-center text-sm font-semibold sm:px-3.5 ${
                      active
                        ? "bg-brand-navy text-white"
                        : "text-brand-muted hover:text-brand-navy"
                    }`}
                  >
                    {view.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {searchQuery ? (
            <p
              role="status"
              className="mt-4 text-sm font-medium text-brand-muted"
            >
              {visibleConversations.length === 0
                ? "Belum ada percakapan yang cocok."
                : `${visibleConversations.length} percakapan ditemukan.`}
            </p>
          ) : null}

          <section className="mt-5 space-y-4" aria-label="Daftar percakapan">
            {visibleConversations.length === 0 ? (
              <MascotEmptyState
                pose="chat"
                title={emptyState.title}
                description={emptyState.description}
                action={emptyState.action}
              />
            ) : (
              visibleConversations.map((item) => (
                <ConversationListItem key={item.public_id} item={item} />
              ))
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

export default function MessagesPage(props: MessagesPageProps) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-sm text-brand-muted">
            Menyiapkan Pesan…
          </p>
        </main>
      }
    >
      <MessagesContent {...props} />
    </Suspense>
  );
}
