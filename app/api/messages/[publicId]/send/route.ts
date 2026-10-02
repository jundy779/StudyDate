import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  listConversationMessages,
  sendAnonymousMessage,
  sendAnonymousSticker,
  type ChatMessage,
} from "@/lib/messages/service";
import { getChatStickerById } from "@/lib/messages/stickers";
import {
  conversationPublicIdSchema,
  sendChatMessageSchema,
  sendChatStickerSchema,
} from "@/lib/messages/validation";
import { NextResponse, type NextRequest } from "next/server";

type RouteContext = {
  params: Promise<{ publicId: string }>;
};

function safeMessage(message: ChatMessage) {
  return {
    message_id: message.message_id,
    body: message.body,
    message_type: message.message_type ?? "text",
    sticker_id: message.sticker_id ?? null,
    is_mine: true,
    created_at: message.created_at,
    read_at: message.read_at,
    moderation_status: message.moderation_status,
    reply_message_id: message.reply_message_id ?? null,
    reply_body: message.reply_body ?? null,
    reply_message_type: message.reply_message_type ?? null,
    reply_sticker_id: message.reply_sticker_id ?? null,
    reply_is_mine: message.reply_is_mine ?? false,
    reactions: message.reactions ?? [],
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }

  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) {
    return NextResponse.json(
      { error: "Selesaikan pengaturan awal akunmu terlebih dahulu." },
      { status: 403 },
    );
  }

  const { publicId: rawPublicId } = await context.params;
  const publicId = conversationPublicIdSchema.safeParse(rawPublicId);
  if (!publicId.success) {
    return NextResponse.json(
      { error: "Percakapan tidak ditemukan." },
      { status: 404 },
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  try {
    if (payload?.type === "text") {
      const parsed = sendChatMessageSchema.safeParse({
        publicId: publicId.data,
        body: payload.body,
        replyToMessageId: payload.replyToMessageId,
        idempotencyKey: payload.idempotencyKey,
      });
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Periksa pesanmu." },
          { status: 400 },
        );
      }

      const message = await sendAnonymousMessage(
        parsed.data.publicId,
        parsed.data.body,
        parsed.data.idempotencyKey,
        parsed.data.replyToMessageId,
      );
      const currentMessages = await listConversationMessages(
        parsed.data.publicId,
        { limit: 50 },
      );
      const enriched =
        currentMessages.find(
          (current) => current.message_id === message.message_id,
        ) ?? message;
      return NextResponse.json({
        message: safeMessage(enriched),
        conversationStatus: message.conversation_status,
      });
    }

    if (payload?.type === "sticker") {
      const parsed = sendChatStickerSchema.safeParse({
        publicId: publicId.data,
        stickerId: payload.stickerId,
        replyToMessageId: payload.replyToMessageId,
        idempotencyKey: payload.idempotencyKey,
      });
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Stiker tidak tersedia." },
          { status: 400 },
        );
      }

      const sticker = getChatStickerById(parsed.data.stickerId);
      const messageId = await sendAnonymousSticker(
        parsed.data.publicId,
        parsed.data.stickerId,
        parsed.data.idempotencyKey,
        parsed.data.replyToMessageId,
      );
      if (!sticker || !messageId) {
        throw new Error("Stiker belum dapat dikirim.");
      }

      const currentMessages = await listConversationMessages(
        parsed.data.publicId,
        { limit: 50 },
      );
      const enriched = currentMessages.find(
        (current) => current.message_id === messageId,
      );
      return NextResponse.json({
        message: enriched
          ? safeMessage(enriched)
          : {
              message_id: messageId,
              body: sticker.fallbackText,
              message_type: "sticker",
              sticker_id: sticker.id,
              is_mine: true,
              created_at: new Date().toISOString(),
              read_at: null,
              moderation_status: "visible",
              reply_message_id: null,
              reply_body: null,
              reply_message_type: null,
              reply_sticker_id: null,
              reply_is_mine: false,
              reactions: [],
            } satisfies ChatMessage,
      });
    }

    return NextResponse.json(
      { error: "Jenis pesan tidak dikenali." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Pesan belum dapat dikirim. Coba lagi.",
      },
      { status: 400 },
    );
  }
}
