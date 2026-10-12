import assert from "node:assert/strict";
import test from "node:test";

import {
  filterConversations,
  normalizeConversationQuery,
  searchConversations,
} from "../src/features/chat/filters.ts";
import type { ConversationListItem } from "../src/features/chat/types.ts";
import {
  chatMessageHasContact,
  normalizeChatMessage,
  validateChatMessage,
  validateReportDetails,
} from "../src/features/chat/validation.ts";

const conversations: ConversationListItem[] = [
  {
    public_id: "a".repeat(32),
    status: "active",
    counterpart_alias: "Partner #123456",
    campus: "Universitas Indonesia",
    study_program: "Sistem Informasi",
    semester: 7,
    is_verified: true,
    preview_body: "Siap belajar bareng",
    last_activity_at: "2026-10-12T08:00:00.000Z",
    unread_count: 2,
    created_at: "2026-10-10T08:00:00.000Z",
  },
  {
    public_id: "b".repeat(32),
    status: "ended",
    counterpart_alias: "Partner #654321",
    campus: "Institut Teknologi Bandung",
    study_program: "Teknik Informatika",
    semester: 5,
    is_verified: false,
    preview_body: null,
    last_activity_at: "2026-10-11T08:00:00.000Z",
    unread_count: 0,
    created_at: "2026-10-09T08:00:00.000Z",
  },
];

test("normalizes chat text without removing line breaks", () => {
  assert.equal(normalizeChatMessage("  Hai   kamu\n\n\nsiap?  "), "Hai kamu\n\nsiap?");
});

test("blocks contact details in chat and report details", () => {
  for (const message of ["Nomorku 081234567890", "Telegram @temanbaru", "Buka https://example.com"]) {
    assert.equal(chatMessageHasContact(message), true);
    assert.match(validateChatMessage(message).error ?? "", /kontak/);
  }
  assert.match(validateReportDetails("emailku nama@example.com") ?? "", /Jangan/);
});

test("allows a normal study message", () => {
  assert.equal(validateChatMessage("Besok belajar basis data bareng, yuk?").error, null);
});

test("searches by alias, campus, and study program", () => {
  assert.equal(searchConversations(conversations, "123456").length, 1);
  assert.equal(searchConversations(conversations, "universitas sistem").length, 1);
  assert.equal(searchConversations(conversations, "teknik informatika").length, 1);
  assert.equal(normalizeConversationQuery("  Universitas   Indonesia "), "Universitas Indonesia");
});

test("filters unread, active, and ended conversations", () => {
  assert.equal(filterConversations(conversations, "unread").length, 1);
  assert.equal(filterConversations(conversations, "active").length, 1);
  assert.equal(filterConversations(conversations, "ended").length, 1);
});
