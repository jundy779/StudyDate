export type ChatSearchMessage = {
  message_id: string;
  body: string;
  moderation_status: "visible" | "removed";
  reply_body?: string | null;
  share_title?: string | null;
  share_description?: string | null;
};

export type ChatSearchTextPart = {
  text: string;
  matched: boolean;
};

export function normalizeChatSearchQuery(value: unknown) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 80);
}

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("id-ID");
}

export function findChatMessageIds<T extends ChatSearchMessage>(
  messages: T[],
  query: string,
) {
  const normalizedQuery = normalizeSearchText(normalizeChatSearchQuery(query));
  if (!normalizedQuery) return [];

  return messages
    .filter((message) => {
      if (message.moderation_status !== "visible") return false;
      const searchable = normalizeSearchText(
        [
          message.body,
          message.reply_body,
          message.share_title,
          message.share_description,
        ]
          .filter((value): value is string => Boolean(value))
          .join(" "),
      );
      return searchable.includes(normalizedQuery);
    })
    .map((message) => message.message_id);
}

export function splitChatSearchText(
  text: string,
  query: string,
): ChatSearchTextPart[] {
  const normalizedQuery = normalizeChatSearchQuery(query);
  if (!normalizedQuery) return [{ text, matched: false }];

  const searchableText = normalizeSearchText(text);
  const searchableQuery = normalizeSearchText(normalizedQuery);
  const parts: ChatSearchTextPart[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = searchableText.indexOf(searchableQuery, cursor);
    if (matchIndex === -1) break;
    if (matchIndex > cursor) {
      parts.push({ text: text.slice(cursor, matchIndex), matched: false });
    }
    parts.push({
      text: text.slice(matchIndex, matchIndex + normalizedQuery.length),
      matched: true,
    });
    cursor = matchIndex + normalizedQuery.length;
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), matched: false });
  }
  return parts.length > 0 ? parts : [{ text, matched: false }];
}
