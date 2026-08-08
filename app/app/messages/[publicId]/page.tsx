import { AppShell } from "@/components/app/app-shell";
import { ConversationRoom } from "@/components/messages/conversation-room";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  countUnreadConversations,
  getConversationByPublicId,
  listConversationMessages,
} from "@/lib/messages/service";
import { conversationPublicIdSchema } from "@/lib/messages/validation";
import { getMutualInterestState } from "@/lib/mutual-interest/service";
import {
  getCompletedIdentityReveal,
  getIdentityRevealProfilePreview,
  getIdentityRevealState,
} from "@/lib/identity-reveal/service";
import {
  CONTACT_REVEAL_CHANNELS,
  type ContactRevealChannel,
  type ContactRevealCompletedChannel,
  type ContactRevealPreview,
} from "@/lib/contact-reveal/constants";
import {
  getAllCompletedContactReveals,
  getContactRevealPreview,
  getContactRevealState,
} from "@/lib/contact-reveal/service";
import { getMyStudentSocialContacts } from "@/lib/profile/social-service";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

type ConversationPageProps = {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ notice?: string; state?: string }>;
};

async function ConversationContent({
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

  const [
    conversation,
    messages,
    unreadConversations,
    mutualInterest,
    identityReveal,
    identityRevealPreview,
    contactReveal,
  ] = await Promise.all([
    getConversationByPublicId(parsed.data),
    listConversationMessages(parsed.data, { limit: 50 }),
    countUnreadConversations(),
    getMutualInterestState(parsed.data),
    getIdentityRevealState(parsed.data),
    getIdentityRevealProfilePreview(parsed.data),
    getContactRevealState(parsed.data),
  ]);

  if (!conversation) notFound();

  const identityRevealCompleted = identityReveal.completed
    ? await getCompletedIdentityReveal(parsed.data)
    : null;

  const contactPreviews: Partial<
    Record<ContactRevealChannel, ContactRevealPreview | null>
  > = {};
  const contactCompleted: Partial<
    Record<ContactRevealChannel, ContactRevealCompletedChannel | null>
  > = {};

  if (identityReveal.completed) {
    await Promise.all(
      CONTACT_REVEAL_CHANNELS.map(async (channel) => {
        const channelState = contactReveal.channels.find(
          (item) => item.channel === channel,
        );
        if (channelState?.hasContact && !channelState.completed) {
          contactPreviews[channel] = await getContactRevealPreview(
            parsed.data,
            channel,
          );
        }
      }),
    );
    const completedList = await getAllCompletedContactReveals(
      parsed.data,
      contactReveal,
    );
    for (const item of completedList) {
      if (item.completed) {
        contactCompleted[item.channel] = item;
      }
    }
  }

  const query = await searchParams;
  const notice =
    typeof query.notice === "string" && query.notice.trim()
      ? query.notice.trim().slice(0, 300)
      : null;

  const social = await getMyStudentSocialContacts(user.id);
  const profileContactDefaults = {
    linkedin: social.linkedinUrl ?? undefined,
    instagram: social.instagramUsername
      ? `@${social.instagramUsername}`
      : undefined,
  };

  return (
    <AppShell current="messages" unreadMessages={unreadConversations}>
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <ConversationRoom
          conversation={conversation}
          initialMessages={messages}
          initialMutualInterest={mutualInterest}
          initialIdentityReveal={identityReveal}
          initialIdentityRevealPreview={identityRevealPreview}
          initialIdentityRevealCompleted={identityRevealCompleted}
          initialContactReveal={contactReveal}
          initialContactPreviews={contactPreviews}
          initialContactCompleted={contactCompleted}
          profileContactDefaults={profileContactDefaults}
          notice={notice}
          state={query.state ?? null}
        />
      </main>
    </AppShell>
  );
}

export default function ConversationPage(props: ConversationPageProps) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-sm text-brand-muted">
            Menyiapkan percakapan…
          </p>
        </main>
      }
    >
      <ConversationContent {...props} />
    </Suspense>
  );
}
