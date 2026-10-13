import type {
  ChatMessage,
  ConversationListItem,
  ConversationView,
} from "@/features/chat/types";

export const conversationViews: Array<{ value: ConversationView; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "unread", label: "Belum dibaca" },
  { value: "active", label: "Masih aktif" },
  { value: "ended", label: "Sudah selesai" },
];

export function normalizeConversationQuery(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 80);
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID");
}

export function filterConversations(
  conversations: ConversationListItem[],
  view: ConversationView,
) {
  if (view === "unread") return conversations.filter((item) => item.unread_count > 0);
  if (view === "active") {
    return conversations.filter((item) => item.status === "active" || item.status === "awaiting_chat");
  }
  if (view === "ended") {
    return conversations.filter((item) => item.status === "ended" || item.status === "blocked");
  }
  return conversations;
}

export function searchConversations(
  conversations: ConversationListItem[],
  query: string,
) {
  const normalized = normalizeSearchText(normalizeConversationQuery(query));
  if (!normalized) return conversations;
  const terms = normalized.split(" ");
  return conversations.filter((item) => {
    const searchable = normalizeSearchText(
      `${item.counterpart_alias} ${item.campus} ${item.study_program}`,
    );
    return terms.every((term) => searchable.includes(term));
  });
}

export function searchLoadedMessages(messages: ChatMessage[], query: string) {
  const normalized = normalizeSearchText(normalizeConversationQuery(query));
  if (!normalized) return messages;
  const terms = normalized.split(" ");
  return messages.filter((message) => {
    const searchable = normalizeSearchText(
      `${message.body} ${message.reply_body ?? ""} ${message.share_title ?? ""} ${message.share_description ?? ""}`,
    );
    return terms.every((term) => searchable.includes(term));
  });
}
