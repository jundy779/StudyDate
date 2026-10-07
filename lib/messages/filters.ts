import type { ConversationStatus } from "./constants.ts";

export const CONVERSATION_VIEWS = [
  { value: "all", label: "Semua" },
  { value: "unread", label: "Belum dibaca" },
  { value: "active", label: "Masih aktif" },
  { value: "ended", label: "Sudah selesai" },
] as const;

export type ConversationView = (typeof CONVERSATION_VIEWS)[number]["value"];

type FilterableConversation = {
  status: ConversationStatus;
  unread_count: number;
};

export function parseConversationView(value: unknown): ConversationView {
  const first = Array.isArray(value) ? value[0] : value;
  return CONVERSATION_VIEWS.some((view) => view.value === first)
    ? (first as ConversationView)
    : "all";
}

export function filterConversations<T extends FilterableConversation>(
  conversations: T[],
  view: ConversationView,
) {
  if (view === "unread") {
    return conversations.filter((item) => item.unread_count > 0);
  }
  if (view === "active") {
    return conversations.filter(
      (item) => item.status === "awaiting_chat" || item.status === "active",
    );
  }
  if (view === "ended") {
    return conversations.filter(
      (item) => item.status === "ended" || item.status === "blocked",
    );
  }
  return conversations;
}
