import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { ConversationListItem } from "@/components/messages/conversation-list-item";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  countUnreadConversations,
  listMyConversations,
} from "@/lib/messages/service";
import Image from "next/image";
import { redirect } from "next/navigation";

type MessagesPageProps = {
  searchParams: Promise<{ state?: string }>;
};

const stateMessages: Record<string, string> = {
  error: "Pesan belum dapat dimuat. Coba lagi sebentar.",
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
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
              <div className="rounded-[22px] border border-dashed border-brand-border bg-white px-6 py-12 text-center">
                <Image
                  src="/brand/mascot/chat.png"
                  alt=""
                  width={120}
                  height={120}
                  className="mx-auto h-24 w-24 object-contain"
                />
                <h2 className="mt-5 font-heading text-2xl font-semibold text-brand-navy">
                  Belum ada percakapan
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-brand-muted">
                  Percakapan anonim akan muncul setelah sebuah perkenalan
                  diterima.
                </p>
                <Link
                  href="/app/people"
                  className="focus-ring mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
                >
                  Jelajahi People
                </Link>
              </div>
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
