import { supabase } from "@/lib/supabase";
import type {
  ChatMessage,
  ChatMessageType,
  ConversationDetail,
  ConversationListItem,
  ConversationStatus,
  ReportReasonCode,
} from "@/features/chat/types";

const publicIdPattern = /^[0-9a-f]{32}$/;
const aliasPattern = /^Partner #[0-9]{6}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const conversationStatuses = new Set<ConversationStatus>(["awaiting_chat", "active", "ended", "blocked"]);
const messageTypes = new Set<ChatMessageType>(["text", "sticker", "circle_invite", "event_invite"]);

function requireClient() {
  if (!supabase) throw new Error("Koneksi aplikasi belum disiapkan.");
  return supabase;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isMissingRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return error.code === "PGRST202"
    || error.code === "42883"
    || message.includes("schema cache")
    || message.includes("could not find the function")
    || message.includes("does not exist");
}

function mapChatError(message?: string) {
  const normalized = (message ?? "").toLowerCase();
  if (normalized.includes("contact disclosure")) {
    return "Simpan kontak untuk tahap berikutnya. Kenalan dulu lewat chat StudyDate.";
  }
  if (normalized.includes("rate limited") || normalized.includes("duplicate message")) {
    return "Pesan dikirim terlalu cepat. Tunggu sebentar, lalu coba lagi.";
  }
  if (normalized.includes("conversation closed")) {
    return "Percakapan ini sudah berakhir dan tidak bisa menerima pesan baru.";
  }
  if (normalized.includes("invalid message length")) {
    return "Periksa panjang pesanmu, lalu coba lagi.";
  }
  return "Pesan belum dapat diproses. Coba lagi sebentar.";
}

function toConversationListItem(value: unknown): ConversationListItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const publicId = text(row.public_id);
  const alias = text(row.counterpart_alias);
  const status = text(row.status) as ConversationStatus;
  if (!publicIdPattern.test(publicId) || !aliasPattern.test(alias) || !conversationStatuses.has(status)) return null;
  return {
    public_id: publicId,
    status,
    counterpart_alias: alias,
    campus: text(row.campus, "Kampus belum ditampilkan"),
    study_program: text(row.study_program, "Program studi belum ditampilkan"),
    semester: typeof row.semester === "number" ? row.semester : null,
    is_verified: row.is_verified === true,
    preview_body: optionalText(row.preview_body),
    last_activity_at: text(row.last_activity_at),
    unread_count: Math.max(0, number(row.unread_count)),
    created_at: text(row.created_at),
  };
}

function toConversationDetail(value: unknown): ConversationDetail | null {
  const listItem = toConversationListItem(value);
  if (!listItem || !value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return {
    ...listItem,
    activated_at: optionalText(row.activated_at),
    ended_at: optionalText(row.ended_at),
    can_send: row.can_send === true,
  };
}

function toChatMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const messageId = text(row.message_id);
  const messageTypeValue = text(row.message_type, "text") as ChatMessageType;
  if (!uuidPattern.test(messageId) || !messageTypes.has(messageTypeValue)) return null;
  const shareKind = row.share_kind === "circle" || row.share_kind === "event" ? row.share_kind : null;
  return {
    message_id: messageId,
    body: text(row.body),
    message_type: messageTypeValue,
    sticker_id: optionalText(row.sticker_id),
    share_kind: shareKind,
    share_public_slug: optionalText(row.share_public_slug),
    share_title: optionalText(row.share_title),
    share_description: optionalText(row.share_description),
    is_mine: row.is_mine === true,
    created_at: text(row.created_at),
    read_at: optionalText(row.read_at),
    moderation_status: row.moderation_status === "removed" ? "removed" : "visible",
    reply_message_id: optionalText(row.reply_message_id),
    reply_body: optionalText(row.reply_body),
    reply_is_mine: row.reply_is_mine === true,
  };
}

export async function listConversations() {
  const { data, error } = await requireClient().rpc("list_my_conversations", { p_limit: 40 });
  if (error) throw new Error("Percakapan belum dapat dimuat. Coba lagi sebentar.");
  return (Array.isArray(data) ? data : []).map(toConversationListItem).filter((item): item is ConversationListItem => item !== null);
}

export async function getConversation(publicId: string) {
  if (!publicIdPattern.test(publicId)) return null;
  const { data, error } = await requireClient().rpc("get_conversation_by_public_id", { p_public_id: publicId });
  if (error) throw new Error("Percakapan belum dapat dibuka.");
  return toConversationDetail(Array.isArray(data) ? data[0] : null);
}

export async function listMessages(publicId: string, before?: ChatMessage) {
  const client = requireClient();
  const params = {
    p_public_id: publicId,
    p_before_created_at: before?.created_at ?? null,
    p_before_id: before?.message_id ?? null,
    p_limit: 50,
  };
  const attempts = [
    "list_conversation_messages_v4",
    "list_conversation_messages_v3",
    "list_conversation_messages_v2",
    "list_conversation_messages",
  ];
  for (const functionName of attempts) {
    const { data, error } = await client.rpc(functionName, params);
    if (!error) {
      return (Array.isArray(data) ? data : []).map(toChatMessage).filter((item): item is ChatMessage => item !== null);
    }
    if (!isMissingRpc(error)) throw new Error("Pesan belum dapat dimuat. Coba lagi sebentar.");
  }
  throw new Error("Pesan belum dapat dimuat. Coba lagi sebentar.");
}

function idempotencyKey() {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.slice(0, 32);
}

export async function sendMessage(publicId: string, body: string) {
  const client = requireClient();
  const key = idempotencyKey();
  const modern = await client.rpc("send_anonymous_message_v2", {
    p_public_id: publicId,
    p_body: body,
    p_reply_to_message_id: null,
    p_idempotency_key: key,
  });
  if (!modern.error) return toChatMessage(Array.isArray(modern.data) ? modern.data[0] : null);
  if (!isMissingRpc(modern.error)) throw new Error(mapChatError(modern.error.message));
  const legacy = await client.rpc("send_anonymous_message", {
    p_public_id: publicId,
    p_body: body,
    p_idempotency_key: key,
  });
  if (legacy.error) throw new Error(mapChatError(legacy.error.message));
  return toChatMessage(Array.isArray(legacy.data) ? legacy.data[0] : null);
}

export async function markMessagesRead(publicId: string) {
  const { error } = await requireClient().rpc("mark_conversation_messages_read", { p_public_id: publicId });
  if (error) throw new Error("Status pesan belum dapat diperbarui.");
}

export async function endConversation(publicId: string) {
  const { error } = await requireClient().rpc("end_conversation", { p_public_id: publicId });
  if (error) throw new Error(mapChatError(error.message));
}

export async function blockConversationCounterpart(alias: string) {
  const { error } = await requireClient().rpc("block_student_by_alias", { p_alias: alias });
  if (error) throw new Error("Akun ini belum dapat diblokir. Coba lagi sebentar.");
}

export async function reportConversation(input: {
  publicId: string;
  reasonCode: ReportReasonCode;
  details?: string;
}) {
  const { error } = await requireClient().rpc("report_conversation", {
    p_public_id: input.publicId,
    p_reason_code: input.reasonCode,
    p_details: input.details || null,
    p_message_id: null,
  });
  if (error) throw new Error(mapChatError(error.message));
}
