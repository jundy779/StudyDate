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

type SearchableConversation = {
  counterpart_alias: string;
  campus: string;
  study_program: string;
};

export function parseConversationView(value: unknown): ConversationView {
  const first = Array.isArray(value) ? value[0] : value;
  return CONVERSATION_VIEWS.some((view) => view.value === first)
    ? (first as ConversationView)
    : "all";
}

export function normalizeConversationQuery(value: unknown) {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== "string") return "";
  return first.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 80);
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID");
}

export function searchConversations<T extends SearchableConversation>(
  conversations: T[],
  query: string,
) {
  const normalizedQuery = normalizeSearchText(normalizeConversationQuery(query));
  if (!normalizedQuery) return conversations;

  const terms = normalizedQuery.split(" ");
  return conversations.filter((item) => {
    const searchable = normalizeSearchText(
      `${item.counterpart_alias} ${item.campus} ${item.study_program}`,
    );
    return terms.every((term) => searchable.includes(term));
  });
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
