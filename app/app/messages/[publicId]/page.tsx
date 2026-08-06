import { AppShell } from "@/components/app/app-shell";
import { ConversationRoom } from "@/components/messages/conversation-room";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  countUnreadConversations,
  getConversationByPublicId,
  listConversationMessages,
} from "@/lib/messages/service";
import { conversationPublicIdSchema } from "@/lib/messages/validation";
import { notFound, redirect } from "next/navigation";

type ConversationPageProps = {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ notice?: string; state?: string }>;
};

export default async function ConversationPage({
  params,
  searchParams,
}: ConversationPageProps) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const { publicId: rawId } = await params;
  const parsed = conversationPublicIdSchema.safeParse(rawId);
  if (!parsed.success) notFound();

  const [conversation, messages, unreadConversations] = await Promise.all([
    getConversationByPublicId(parsed.data),
    listConversationMessages(parsed.data, { limit: 50 }),
    countUnreadConversations(),
  ]);

  if (!conversation) notFound();

  const query = await searchParams;
  const notice =
    typeof query.notice === "string" && query.notice.trim()
      ? query.notice.trim().slice(0, 300)
      : null;

  return (
    <AppShell current="messages" unreadMessages={unreadConversations}>
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <ConversationRoom
          conversation={conversation}
          initialMessages={messages}
          notice={notice}
          state={query.state ?? null}
        />
      </main>
    </AppShell>
  );
}
