import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  getConversationByPublicId,
  listConversationMessages,
} from "@/lib/messages/service";
import { conversationPublicIdSchema } from "@/lib/messages/validation";
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

    const messages = await listConversationMessages(parsed.data, { limit: 50 });

    return NextResponse.json({
      conversation: {
        public_id: conversation.public_id,
        status: conversation.status,
        counterpart_alias: conversation.counterpart_alias,
        can_send: conversation.can_send,
        unread_count: conversation.unread_count,
      },
      messages: messages.map((message) => ({
        message_id: message.message_id,
        body: message.body,
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
