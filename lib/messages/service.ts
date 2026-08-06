import "server-only";

import {
  CHAT_CONTACT_MESSAGE,
  CHAT_RATE_LIMIT_MESSAGE,
  CONVERSATION_CLOSED_MESSAGE,
  GENERIC_CHAT_ERROR,
  type ConversationStatus,
  type ReportReasonCode,
} from "@/lib/messages/constants";
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
  is_mine: boolean;
  created_at: string;
  read_at: string | null;
  moderation_status: "visible" | "removed";
};

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
  const { data, error } = await supabase.rpc("list_conversation_messages", {
    p_public_id: publicId,
    p_before_created_at: options?.beforeCreatedAt ?? null,
    p_before_id: options?.beforeId ?? null,
    p_limit: options?.limit ?? 40,
  });

  if (error) {
    throw new Error(GENERIC_CHAT_ERROR);
  }

  return (data ?? []) as ChatMessage[];
}

export async function sendAnonymousMessage(
  publicId: string,
  body: string,
  idempotencyKey?: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_anonymous_message", {
    p_public_id: publicId,
    p_body: body,
    p_idempotency_key: idempotencyKey ?? null,
  });

  if (error) {
    throw new Error(mapChatError(error.message));
  }

  return (data ?? [])[0] as ChatMessage & { conversation_status: string };
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
