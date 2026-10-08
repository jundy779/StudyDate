const CHAT_DRAFT_PREFIX = "studydate:chat-draft:v1:";
const CHAT_DRAFT_MAX_LENGTH = 1_000;
const CHAT_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type StoredDraft = {
  text: string;
  updatedAt: number;
};

export function getChatDraftStorageKey(publicId: string) {
  return `${CHAT_DRAFT_PREFIX}${publicId}`;
}

function normalizeDraft(value: unknown) {
  return typeof value === "string"
    ? value
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .slice(0, CHAT_DRAFT_MAX_LENGTH)
    : "";
}

function safelyRemoveDraft(storage: DraftStorage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Private browsing or a full storage quota must not break chat.
  }
}

export function readChatDraft(
  storage: DraftStorage,
  publicId: string,
  now = Date.now(),
) {
  const key = getChatDraftStorageKey(publicId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    const text = normalizeDraft(parsed.text);
    const updatedAt =
      typeof parsed.updatedAt === "number" ? parsed.updatedAt : Number.NaN;
    if (
      !text.trim() ||
      !Number.isFinite(updatedAt) ||
      now - updatedAt > CHAT_DRAFT_MAX_AGE_MS
    ) {
      safelyRemoveDraft(storage, key);
      return "";
    }
    return text;
  } catch {
    safelyRemoveDraft(storage, key);
    return "";
  }
}

export function writeChatDraft(
  storage: DraftStorage,
  publicId: string,
  text: string,
  now = Date.now(),
) {
  const key = getChatDraftStorageKey(publicId);
  const normalized = normalizeDraft(text);
  try {
    if (!normalized.trim()) {
      safelyRemoveDraft(storage, key);
      return "";
    }
    storage.setItem(
      key,
      JSON.stringify({ text: normalized, updatedAt: now } satisfies StoredDraft),
    );
    return normalized;
  } catch {
    return "";
  }
}

export function clearChatDraft(storage: DraftStorage, publicId: string) {
  safelyRemoveDraft(storage, getChatDraftStorageKey(publicId));
}
