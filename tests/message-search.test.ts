import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  findChatMessageIds,
  normalizeChatSearchQuery,
  splitChatSearchText,
} from "../lib/messages/search.ts";

const room = readFileSync(
  new URL("../components/messages/conversation-room.tsx", import.meta.url),
  "utf8",
);
const bubble = readFileSync(
  new URL("../components/messages/chat-message-bubble.tsx", import.meta.url),
  "utf8",
);

const messages = [
  {
    message_id: "one",
    body: "Kita belajar di perpustakaan besok.",
    moderation_status: "visible" as const,
    reply_body: null,
    share_title: null,
    share_description: null,
  },
  {
    message_id: "two",
    body: "",
    moderation_status: "visible" as const,
    reply_body: null,
    share_title: "Workshop UI/UX",
    share_description: "Belajar bareng mahasiswa.",
  },
  {
    message_id: "removed",
    body: "perpustakaan",
    moderation_status: "removed" as const,
    reply_body: null,
    share_title: null,
    share_description: null,
  },
];

test("chat search query is normalized and bounded", () => {
  assert.equal(
    normalizeChatSearchQuery("  belajar   bareng  "),
    "belajar bareng",
  );
  assert.equal(normalizeChatSearchQuery(null), "");
  assert.equal(normalizeChatSearchQuery("a".repeat(100)).length, 80);
});

test("chat search finds visible messages and shared-card text", () => {
  assert.deepEqual(findChatMessageIds(messages, "PERPUSTAKAAN"), ["one"]);
  assert.deepEqual(findChatMessageIds(messages, "workshop ui/ux"), ["two"]);
  assert.deepEqual(findChatMessageIds(messages, ""), []);
});

test("chat search text is split safely for React highlighting", () => {
  assert.deepEqual(splitChatSearchText("Belajar dan belajar", "belajar"), [
    { text: "Belajar", matched: true },
    { text: " dan ", matched: false },
    { text: "belajar", matched: true },
  ]);
  assert.deepEqual(splitChatSearchText("<script>alert(1)</script>", "alert"), [
    { text: "<script>", matched: false },
    { text: "alert", matched: true },
    { text: "(1)</script>", matched: false },
  ]);
});

test("chat search controls are accessible and mobile-contained", () => {
  assert.match(room, /Cari chat/);
  assert.match(room, /placeholder="Cari isi chat"/);
  assert.match(room, /aria-label="Hasil sebelumnya"/);
  assert.match(room, /aria-label="Hasil berikutnya"/);
  assert.match(room, /aria-label="Tutup pencarian"/);
  assert.match(room, /min-w-0 flex-1/);
  assert.match(room, /scrollIntoView/);
  assert.match(room, /pesan yang sudah dimuat/);
});

test("matching text is highlighted without HTML injection", () => {
  assert.match(bubble, /splitChatSearchText/);
  assert.match(bubble, /<mark/);
  assert.match(bubble, /aria-current=\{activeSearchMatch/);
  assert.doesNotMatch(bubble, /dangerouslySetInnerHTML/);
});
