import "server-only";

import {
  CHAT_CONTACT_MESSAGE,
  CHAT_RATE_LIMIT_MESSAGE,
  CONVERSATION_CLOSED_MESSAGE,
  GENERIC_CHAT_ERROR,
  type ConversationStatus,
  type ReportReasonCode,
} from "@/lib/messages/constants";
import type {
  ChatReactionSummary,
  ChatReactionValue,
} from "@/lib/messages/reactions";
import { createClient } from "@/lib/supabase/server";

export type ConversationListItem = {
  public_id: string;
  status: ConversationStatus;
  counterpart_alias: string;
  campus: string;
  study_program: string;
  semester: number | null;
  is_verified: boolean;
  preview_body: string | null;
  last_activity_at: string;
  unread_count: number;
  created_at: string;
};

export type ConversationDetail = {
  public_id: string;
  status: ConversationStatus;
  counterpart_alias: string;
  campus: string;
  study_program: string;
  semester: number | null;
  is_verified: boolean;
  created_at: string;
  activated_at: string | null;
  ended_at: string | null;
  unread_count: number;
  can_send: boolean;
};

export type ChatMessage = {
  message_id: string;
  body: string;
  message_type: "text" | "sticker";
  sticker_id: string | null;
  is_mine: boolean;
  created_at: string;
  read_at: string | null;
  moderation_status: "visible" | "removed";
  reply_message_id: string | null;
  reply_body: string | null;
  reply_message_type: "text" | "sticker" | null;
  reply_sticker_id: string | null;
  reply_is_mine: boolean;
  reactions: ChatReactionSummary[];
};

function isMissingRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    message.includes("schema cache") ||
    message.includes("could not find the function") ||
    message.includes("does not exist")
  );
}

function withoutMessageInteractions(
  message: Omit<
    ChatMessage,
    | "reply_message_id"
    | "reply_body"
    | "reply_message_type"
    | "reply_sticker_id"
    | "reply_is_mine"
    | "reactions"
  >,
): ChatMessage {
  return {
    ...message,
    reply_message_id: null,
    reply_body: null,
    reply_message_type: null,
    reply_sticker_id: null,
    reply_is_mine: false,
    reactions: [],
  };
}

function mapChatError(message: string | undefined): string {
  const text = (message ?? "").toLowerCase();

  if (text.includes("contact disclosure")) {
    return CHAT_CONTACT_MESSAGE;
  }

  if (text.includes("rate limited") || text.includes("duplicate message")) {
    return CHAT_RATE_LIMIT_MESSAGE;
  }

  if (text.includes("conversation closed")) {
    return CONVERSATION_CLOSED_MESSAGE;
  }

  if (text.includes("invalid message length")) {
    return "Periksa panjang pesanmu, lalu coba lagi.";
  }

  return GENERIC_CHAT_ERROR;
}

export async function listMyConversations() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_conversations", {
    p_limit: 40,
  });

  if (error) {
    throw new Error(GENERIC_CHAT_ERROR);
  }

  return (data ?? []) as ConversationListItem[];
}

export async function countUnreadConversations() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("count_unread_conversations");
  if (error) return 0;
  return typeof data === "number" ? data : 0;
}

export async function getConversationByPublicId(publicId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_conversation_by_public_id", {
    p_public_id: publicId,
  });

  if (error) {
    throw new Error(GENERIC_CHAT_ERROR);
  }

  const row = (data ?? [])[0] as ConversationDetail | undefined;
  return row ?? null;
}

export async function listConversationMessages(
  publicId: string,
  options?: {
    beforeCreatedAt?: string;
    beforeId?: string;
    limit?: number;
  },
) {
  const supabase = await createClient();
  const params = {
    p_public_id: publicId,
    p_before_created_at: options?.beforeCreatedAt ?? null,
    p_before_id: options?.beforeId ?? null,
    p_limit: options?.limit ?? 40,
  };
  const modern = await supabase.rpc(
    "list_conversation_messages_v3",
    params,
  );

  if (!modern.error) {
    return (modern.data ?? []) as ChatMessage[];
  }
  if (!isMissingRpc(modern.error)) {
    throw new Error(GENERIC_CHAT_ERROR);
  }

  // Rolling-deploy fallback: keep sticker/text chat available before the
  // reply-and-reaction migration is applied.
  const stickerCapable = await supabase.rpc(
    "list_conversation_messages_v2",
    params,
  );
  if (!stickerCapable.error) {
    const messages = (stickerCapable.data ?? []) as Array<
      Omit<
        ChatMessage,
        | "reply_message_id"
        | "reply_body"
        | "reply_message_type"
        | "reply_sticker_id"
        | "reply_is_mine"
        | "reactions"
      >
    >;
    return messages.map(withoutMessageInteractions);
  }
  if (!isMissingRpc(stickerCapable.error)) {
    throw new Error(GENERIC_CHAT_ERROR);
  }

  const legacy = await supabase.rpc("list_conversation_messages", params);
  if (legacy.error) {
    throw new Error(GENERIC_CHAT_ERROR);
  }

  const legacyMessages = (legacy.data ?? []) as Array<
    Omit<
      ChatMessage,
      | "message_type"
      | "sticker_id"
      | "reply_message_id"
      | "reply_body"
      | "reply_message_type"
      | "reply_sticker_id"
      | "reply_is_mine"
      | "reactions"
    >
  >;

  return legacyMessages.map((message) =>
    withoutMessageInteractions({
      ...message,
      message_type: "text" as const,
      sticker_id: null,
    }),
  );
}

export async function sendAnonymousMessage(
  publicId: string,
  body: string,
  idempotencyKey?: string,
  replyToMessageId?: string,
) {
  const supabase = await createClient();
  const modern = await supabase.rpc("send_anonymous_message_v2", {
    p_public_id: publicId,
    p_body: body,
    p_reply_to_message_id: replyToMessageId ?? null,
    p_idempotency_key: idempotencyKey ?? null,
  });

  if (!modern.error) {
    return (modern.data ?? [])[0] as ChatMessage & {
      conversation_status: string;
    };
  }
  if (!isMissingRpc(modern.error) || replyToMessageId) {
    throw new Error(
      replyToMessageId && isMissingRpc(modern.error)
        ? "Fitur balas pesan belum siap. Muat ulang setelah pembaruan selesai."
        : mapChatError(modern.error.message),
    );
  }

  const legacy = await supabase.rpc("send_anonymous_message", {
    p_public_id: publicId,
    p_body: body,
    p_idempotency_key: idempotencyKey ?? null,
  });
  if (legacy.error) {
    throw new Error(mapChatError(legacy.error.message));
  }
  return (legacy.data ?? [])[0] as ChatMessage & {
    conversation_status: string;
  };
}

export async function sendAnonymousSticker(
  publicId: string,
  stickerId: string,
  idempotencyKey?: string,
  replyToMessageId?: string,
) {
  const supabase = await createClient();
  const modern = await supabase.rpc("send_anonymous_sticker_v2", {
    p_public_id: publicId,
    p_sticker_id: stickerId,
    p_reply_to_message_id: replyToMessageId ?? null,
    p_idempotency_key: idempotencyKey ?? null,
  });

  if (!modern.error) {
    return modern.data as string | null;
  }
  if (!isMissingRpc(modern.error) || replyToMessageId) {
    throw new Error(
      replyToMessageId && isMissingRpc(modern.error)
        ? "Fitur balas pesan belum siap. Muat ulang setelah pembaruan selesai."
        : mapChatError(modern.error.message),
    );
  }

  const legacy = await supabase.rpc("send_anonymous_sticker", {
    p_public_id: publicId,
    p_sticker_id: stickerId,
    p_idempotency_key: idempotencyKey ?? null,
  });
  if (legacy.error) {
    throw new Error(mapChatError(legacy.error.message));
  }
  return legacy.data as string | null;
}

export async function markConversationMessagesRead(publicId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_conversation_messages_read", {
    p_public_id: publicId,
  });

  if (error) {
    throw new Error(GENERIC_CHAT_ERROR);
  }
}

export async function endConversation(publicId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_conversation", {
    p_public_id: publicId,
  });

  if (error) {
    throw new Error(mapChatError(error.message));
  }
}

export async function reportConversation(input: {
  publicId: string;
  reasonCode: ReportReasonCode;
  details?: string;
  messageId?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_conversation", {
    p_public_id: input.publicId,
    p_reason_code: input.reasonCode,
    p_details: input.details ?? null,
    p_message_id: input.messageId ?? null,
  });

  if (error) {
    throw new Error(mapChatError(error.message));
  }
}

export async function getConversationPublicIdForIntroduction(requestId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_conversation_public_id_for_introduction",
    { p_request_id: requestId },
  );

  if (error || typeof data !== "string") {
    return null;
  }

  return data;
}


export async function getMessageInteractionCapability() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "anonymous_chat_interactions_available",
  );
  if (error && isMissingRpc(error)) return false;
  if (error) return false;
  return data === true;
}

export async function toggleAnonymousMessageReaction(input: {
  publicId: string;
  messageId: string;
  reaction: ChatReactionValue | null;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "toggle_anonymous_message_reaction",
    {
      p_public_id: input.publicId,
      p_message_id: input.messageId,
      p_reaction: input.reaction,
    },
  );
  if (error) {
    throw new Error(mapChatError(error.message));
  }
  return (data ?? null) as ChatReactionValue | null;
}
