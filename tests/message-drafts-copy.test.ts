import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  clearChatDraft,
  getChatDraftStorageKey,
  readChatDraft,
  writeChatDraft,
} from "../lib/messages/drafts.ts";

const room = readFileSync(
  new URL("../components/messages/conversation-room.tsx", import.meta.url),
  "utf8",
);
const bubble = readFileSync(
  new URL("../components/messages/chat-message-bubble.tsx", import.meta.url),
  "utf8",
);
const listItem = readFileSync(
  new URL("../components/messages/conversation-list-item.tsx", import.meta.url),
  "utf8",
);
const draftPreview = readFileSync(
  new URL(
    "../components/messages/conversation-draft-preview.tsx",
    import.meta.url,
  ),
  "utf8",
);

function makeStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

test("chat draft is stored per conversation and bounded", () => {
  const storage = makeStorage();
  const stored = writeChatDraft(
    storage,
    "conversation-a",
    "a".repeat(1_100),
    10,
  );
  assert.equal(stored.length, 1_000);
  assert.equal(readChatDraft(storage, "conversation-a", 11).length, 1_000);
  assert.equal(readChatDraft(storage, "conversation-b", 11), "");
});

test("blank and expired chat drafts are removed", () => {
  const storage = makeStorage();
  writeChatDraft(storage, "conversation-a", "belajar besok", 10);
  assert.equal(
    readChatDraft(storage, "conversation-a", 8 * 24 * 60 * 60 * 1_000),
    "",
  );
  writeChatDraft(storage, "conversation-a", "baru", 20);
  assert.equal(writeChatDraft(storage, "conversation-a", "   ", 21), "");
  assert.equal(readChatDraft(storage, "conversation-a", 22), "");
});

test("malformed or blocked browser storage never breaks chat", () => {
  const storage = makeStorage();
  storage.setItem(getChatDraftStorageKey("conversation-a"), "{broken");
  assert.equal(readChatDraft(storage, "conversation-a"), "");

  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(readChatDraft(blocked, "conversation-a"), "");
  assert.equal(writeChatDraft(blocked, "conversation-a", "halo"), "");
  assert.doesNotThrow(() => clearChatDraft(blocked, "conversation-a"));
});

test("composer restores, saves, and clears local drafts", () => {
  assert.match(room, /readChatDraft\(window\.localStorage/);
  assert.match(room, /writeChatDraft\(window\.localStorage/);
  assert.match(room, /clearChatDraft\(window\.localStorage/);
  assert.match(room, /Draf tersimpan otomatis di perangkat ini/);
  assert.match(room, /if \(!stickerId && !share\)/);
});

test("conversation list shows drafts only for sendable conversations", () => {
  assert.match(listItem, /ConversationDraftPreview/);
  assert.match(listItem, /item\.status === "awaiting_chat"/);
  assert.match(listItem, /item\.status === "active"/);
  assert.match(draftPreview, /Draf:/);
  assert.match(draftPreview, /visibilitychange/);
});

test("copy message action reports success and failure accessibly", () => {
  assert.match(bubble, /navigator\.clipboard\?\.writeText/);
  assert.match(bubble, /Pesan berhasil disalin/);
  assert.match(bubble, /Pesan belum bisa disalin/);
  assert.match(bubble, /aria-live="polite"/);
  assert.match(bubble, /canInteract \|\| canCopy/);
  assert.doesNotMatch(bubble, /document\.execCommand|dangerouslySetInnerHTML/);
});
