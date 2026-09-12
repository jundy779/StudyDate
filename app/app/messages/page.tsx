import { AppShell } from "@/components/app/app-shell";
import { MascotEmptyState } from "@/components/brand/mascot-empty-state";
import { ConversationListItem } from "@/components/messages/conversation-list-item";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  countUnreadConversations,
  listMyConversations,
} from "@/lib/messages/service";
import { redirect } from "next/navigation";
import { Suspense } from "react";

type MessagesPageProps = {
  searchParams: Promise<{ state?: string }>;
};

const stateMessages: Record<string, string> = {
  error: "Pesan belum dapat dimuat. Coba lagi sebentar.",
};

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

  const stateMessage = params.state ? stateMessages[params.state] : null;

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

          <section className="mt-8 space-y-4" aria-label="Daftar percakapan">
            {conversations.length === 0 ? (
              <MascotEmptyState
                pose="chat"
                title="Belum ada percakapan"
                description="Percakapan anonim akan muncul setelah sebuah perkenalan diterima."
                action={{ href: "/app/people", label: "Cari teman" }}
              />
            ) : (
              conversations.map((item) => (
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
