import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  getConversationByPublicId,
  listConversationMessages,
} from "@/lib/messages/service";
import { conversationPublicIdSchema } from "@/lib/messages/validation";
import { getMutualInterestState } from "@/lib/mutual-interest/service";
import {
  getCompletedIdentityReveal,
  getIdentityRevealState,
} from "@/lib/identity-reveal/service";
import {
  getAllCompletedContactReveals,
  getContactRevealState,
} from "@/lib/contact-reveal/service";
import { getMyMeetingPlanState } from "@/lib/meeting-plans/service";
import { NextResponse, type NextRequest } from "next/server";

type RouteContext = {
  params: Promise<{ publicId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) {
    return NextResponse.json({ error: "onboarding" }, { status: 403 });
  }

  const { publicId: raw } = await context.params;
  const parsed = conversationPublicIdSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const conversation = await getConversationByPublicId(parsed.data);
    if (!conversation) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const mode = _request.nextUrl.searchParams.get("mode");
    const [messages, mutualInterest, identityReveal, contactReveal, meetingPlan] =
      await Promise.all([
        mode === "reveal"
          ? Promise.resolve([])
          : listConversationMessages(parsed.data, { limit: 50 }),
        mode === "messages" ? null : getMutualInterestState(parsed.data),
        mode === "messages" ? null : getIdentityRevealState(parsed.data),
        mode === "messages" ? null : getContactRevealState(parsed.data),
        mode === "messages" ? null : getMyMeetingPlanState(parsed.data),
      ]);

    const identityRevealCompleted = identityReveal?.completed
      ? await getCompletedIdentityReveal(parsed.data)
      : null;

    const contactRevealCompleted = identityReveal?.completed && contactReveal
      ? await getAllCompletedContactReveals(parsed.data, contactReveal)
      : [];

    return NextResponse.json({
      conversation: {
        public_id: conversation.public_id,
        status: conversation.status,
        counterpart_alias: conversation.counterpart_alias,
        can_send: conversation.can_send,
        unread_count: conversation.unread_count,
      },
      // Safe MutualInterestState only — never one-sided counterpart interest.
      mutualInterest: mutualInterest
        ? {
            eligible: mutualInterest.eligible,
            selectedByMe: mutualInterest.selectedByMe,
            mutual: mutualInterest.mutual,
            mutualAt: mutualInterest.mutualAt,
            canWithdraw: mutualInterest.canWithdraw,
          }
        : undefined,
      // Safe IdentityRevealState only — never one-sided prepare/consent.
      identityReveal: identityReveal
        ? {
            eligible: identityReveal.eligible,
            hasProfile: identityReveal.hasProfile,
            selectedByMe: identityReveal.selectedByMe,
            completed: identityReveal.completed,
            completedAt: identityReveal.completedAt,
            canWithdraw: identityReveal.canWithdraw,
          }
        : undefined,
      // Names only after completion — never photo paths or UUIDs.
      identityRevealCompleted: identityRevealCompleted?.completed
        ? {
            completed: true,
            completedAt: identityRevealCompleted.completedAt,
            mineFirstName: identityRevealCompleted.mineFirstName,
            counterpartFirstName: identityRevealCompleted.counterpartFirstName,
          }
        : null,
      // Safe ContactRevealState only — never one-sided prepare/consent or encrypted payloads.
      contactReveal: contactReveal
        ? {
            channels: contactReveal.channels.map((channel) => ({
              channel: channel.channel,
              eligible: channel.eligible,
              hasContact: channel.hasContact,
              selectedByMe: channel.selectedByMe,
              completed: channel.completed,
              completedAt: channel.completedAt,
              canWithdraw: channel.canWithdraw,
            })),
          }
        : undefined,
      contactRevealCompleted: contactRevealCompleted
        .filter((item) => item.completed)
        .map((item) => ({
          channel: item.channel,
          completed: true,
          completedAt: item.completedAt,
          mineDisplay: item.mineDisplay,
          counterpartDisplay: item.counterpartDisplay,
          mineHref: item.mineHref,
          counterpartHref: item.counterpartHref,
        })),
      meetingPlan: meetingPlan ?? undefined,
      messages: messages.map((message) => ({
        message_id: message.message_id,
        body: message.body,
        message_type: message.message_type,
        sticker_id: message.sticker_id,
        is_mine: message.is_mine,
        created_at: message.created_at,
        read_at: message.read_at,
        moderation_status: message.moderation_status,
      })),
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) {
    return NextResponse.json({ error: "onboarding" }, { status: 403 });
  }
  const { publicId: raw } = await context.params;
  const publicId = conversationPublicIdSchema.safeParse(raw);
  if (!publicId.success) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as
    | { beforeCreatedAt?: unknown; beforeId?: unknown }
    | null;
  if (
    typeof body?.beforeCreatedAt !== "string" ||
    Number.isNaN(Date.parse(body.beforeCreatedAt)) ||
    typeof body.beforeId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.beforeId)
  ) {
    return NextResponse.json({ error: "invalid_cursor" }, { status: 400 });
  }
  try {
    const messages = await listConversationMessages(publicId.data, {
      beforeCreatedAt: body.beforeCreatedAt,
      beforeId: body.beforeId,
      limit: 50,
    });
    return NextResponse.json({
      messages,
      hasMore: messages.length === 50,
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
