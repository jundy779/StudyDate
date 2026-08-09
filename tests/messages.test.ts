import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  chatMessageSchema,
  conversationPublicIdSchema,
  normalizeChatMessage,
} from "../lib/messages/validation.ts";
import {
  CHAT_MESSAGE_MAX,
  CHAT_RATE_LIMITS,
} from "../lib/messages/constants.ts";
import {
  getCharacterThresholdAnnouncement,
  isNearChatBottom,
  mergeChatMessages,
  nextPollDelay,
} from "../lib/messages/client-state.ts";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202608060003_create_anonymous_chat_v1.sql",
    import.meta.url,
  ),
  "utf8",
);
const introMigration = readFileSync(
  new URL(
    "../supabase/migrations/202608060001_create_introduction_requests_v1.sql",
    import.meta.url,
  ),
  "utf8",
);
const messagesPage = readFileSync(
  new URL("../app/app/messages/page.tsx", import.meta.url),
  "utf8",
);
const conversationPage = readFileSync(
  new URL("../app/app/messages/[publicId]/page.tsx", import.meta.url),
  "utf8",
);
const room = readFileSync(
  new URL("../components/messages/conversation-room.tsx", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("../lib/messages/service.ts", import.meta.url),
  "utf8",
);
const navigation = readFileSync(
  new URL("../components/navigation/responsive-navigation.tsx", import.meta.url),
  "utf8",
);
const pollRoute = readFileSync(
  new URL("../app/api/messages/[publicId]/route.ts", import.meta.url),
  "utf8",
);

test("anonymous and incomplete users are gated before chat RPCs", () => {
  assert.match(migration, /authentication required/);
  assert.match(migration, /onboarding required/);
  assert.match(migration, /is_eligible_introduction_student/);
});

test("pending declined cancelled introductions cannot invent chat shells", () => {
  assert.match(introMigration, /accept_introduction_request/);
  assert.match(introMigration, /insert into public\.conversation_shells/);
  assert.doesNotMatch(
    migration,
    /insert into public\.conversation_shells[\s\S]*from browser/i,
  );
  assert.match(migration, /awaiting_chat', 'active', 'ended', 'blocked'/);
});

test("accepted introduction maps to one shell with opaque public id", () => {
  assert.match(introMigration, /introduction_request_id uuid not null unique/);
  assert.match(migration, /public_id text/);
  assert.match(migration, /conversation_shells_public_id_format/);
  assert.match(migration, /public_id ~ '\^\[0-9a-f\]\{32\}\$'/);
  assert.match(migration, /extensions\.gen_random_bytes\(16\)/);
  assert.doesNotMatch(
    migration,
    /encode\(gen_random_bytes\(16\), 'hex'\)/,
  );
  assert.match(conversationPage, /conversationPublicIdSchema/);
  assert.doesNotMatch(conversationPage, /participant_sender_id|user_id/);
});

test("unrelated users cannot discover or read conversations", () => {
  assert.match(migration, /get_conversation_by_public_id/);
  assert.match(
    migration,
    /current_user_id not in \(shell\.participant_sender_id, shell\.participant_recipient_id\)/,
  );
  assert.match(migration, /return;\s*\n\s*end if;/);
  assert.match(pollRoute, /status: 404/);
});

test("sender identity comes from auth.uid only", () => {
  assert.match(migration, /sender_id,\s*\n\s*body/);
  assert.match(migration, /current_user_id,\s*\n\s*normalized/);
  assert.doesNotMatch(migration, /p_sender_id/);
  assert.match(service, /send_anonymous_message/);
});

test("active staff cannot participate via eligibility guards", () => {
  assert.match(migration, /is_eligible_introduction_student\(current_user_id\)/);
  assert.match(migration, /is_eligible_introduction_student\(counterpart_id\)/);
  assert.match(introMigration, /not public\.is_active_staff_user/);
});

test("users cannot create arbitrary conversation shells from chat RPCs", () => {
  assert.doesNotMatch(migration, /create or replace function public\.create_conversation/);
  assert.match(migration, /revoke all on table public\.anonymous_messages from public, anon, authenticated/);
  assert.match(migration, /revoke all on table public\.conversation_events from public, anon, authenticated/);
});

test("ended and blocked conversations reject messages", () => {
  assert.match(migration, /if shell\.status in \('ended', 'blocked'\)/);
  assert.match(migration, /conversation closed/);
  assert.match(migration, /end_conversation/);
  assert.match(migration, /close_conversations_for_block/);
});

test("message length and contact filters are database-enforced", () => {
  assert.match(migration, /char_length\(body\) between 1 and 1000/);
  assert.match(migration, /normalize_anonymous_message/);
  assert.match(migration, /introduction_message_has_contact\(normalized\)/);
  assert.match(migration, /contact disclosure blocked/);
  assert.equal(CHAT_MESSAGE_MAX, 1000);
  assert.equal(chatMessageSchema.safeParse("").success, false);
  assert.equal(chatMessageSchema.safeParse("halo belajar").success, true);
  assert.equal(
    chatMessageSchema.safeParse("email saya nama@kampus.ac.id").success,
    false,
  );
  assert.equal(
    normalizeChatMessage("  a\n\n\nb  ").includes("a\n\nb"),
    true,
  );
});

test("rate limits and idempotency are durable", () => {
  assert.match(migration, /sent_last_minute >= 20/);
  assert.match(migration, /sent_last_day >= 300/);
  assert.match(migration, /duplicate message/);
  assert.match(migration, /anonymous_messages_idempotency_uidx/);
  assert.match(migration, /client_idempotency_key/);
  assert.equal(CHAT_RATE_LIMITS.perMinute, 20);
  assert.equal(CHAT_RATE_LIMITS.perDay, 300);
});

test("read state is recipient-only and private", () => {
  assert.match(migration, /mark_conversation_messages_read/);
  assert.match(migration, /msg\.sender_id <> current_user_id/);
  assert.doesNotMatch(migration, /p_read_at/);
  assert.match(room, /Dibaca|Terkirim/);
});

test("projections never expose participant UUIDs or private identity", () => {
  for (const fn of [
    "list_my_conversations",
    "get_conversation_by_public_id",
    "list_conversation_messages",
    "send_anonymous_message",
  ]) {
    const block = migration.match(
      new RegExp(
        `create or replace function public\\.${fn}[\\s\\S]*?returns table \\(([\\s\\S]*?)\\)\\s*language`,
      ),
    );
    assert.ok(block, `missing returns table for ${fn}`);
    assert.doesNotMatch(block[1], /participant_sender_id|first_name|\bnim\b|email/i);
  }
  assert.doesNotMatch(service, /participant_sender_id|legal_name|nim_ciphertext/);
  assert.equal(conversationPublicIdSchema.safeParse("abc").success, false);
  assert.equal(
    conversationPublicIdSchema.safeParse("0".repeat(32)).success,
    true,
  );
});

test("reporting is participant-only with constrained reasons", () => {
  assert.match(migration, /report_conversation/);
  assert.match(migration, /only participants|participant_sender_id, shell\.participant_recipient_id/);
  assert.match(migration, /harassment', 'spam', 'contact_pressure'/);
  assert.match(migration, /report rate limited/);
});

test("messages UI uses product terminology and escaped text rendering", () => {
  assert.match(messagesPage, /Belum ada percakapan/);
  assert.match(messagesPage, /Jelajahi People/);
  assert.match(room, /Tulis pesan/);
  assert.match(room, /Akhiri percakapan/);
  assert.match(room, /whitespace-pre-wrap break-words/);
  assert.doesNotMatch(room, /dangerouslySetInnerHTML|match score|online now/i);
  assert.doesNotMatch(messagesPage, /\bDM\b|compatibility|swipe/i);
});

test("student navigation includes Pesan and staff shell does not", () => {
  assert.match(navigation, /label: "Pesan"/);
  assert.match(navigation, /href: "\/app\/messages"/);
  assert.doesNotMatch(
    navigation,
    /getStaffItems[\s\S]*\/app\/messages/,
  );
});

test("delivery uses authenticated poll route without Realtime table grants", () => {
  assert.match(pollRoute, /listConversationMessages/);
  assert.match(room, /setTimeout/);
  assert.doesNotMatch(room, /setInterval/);
  assert.match(room, /document\.hidden/);
  assert.match(room, /visibilitychange/);
  assert.match(room, /messageController\?\.abort/);
  assert.match(room, /revealController\?\.abort/);
  assert.match(
    room,
    /function handleVisibility\(\)[\s\S]*messageGeneration \+= 1;[\s\S]*revealGeneration \+= 1;[\s\S]*messageController\?\.abort\(\);[\s\S]*revealController\?\.abort\(\);/,
  );
  assert.match(room, /mode=messages/);
  assert.match(room, /mode=reveal/);
  assert.match(migration, /No table SELECT grants|polling/i);
  assert.doesNotMatch(migration, /grant select on table public\.anonymous_messages to authenticated/i);
});

test("client cannot forge moderation state", () => {
  assert.doesNotMatch(migration, /p_moderation_status/);
  assert.match(migration, /moderation_status text not null default 'visible'/);
});

test("history merge deduplicates and preserves deterministic chronological order", () => {
  const message = (
    id: string,
    createdAt: string,
    body = id,
  ) => ({
    message_id: id,
    body,
    is_mine: false,
    created_at: createdAt,
    read_at: null,
    moderation_status: "visible" as const,
  });
  const merged = mergeChatMessages(
    [
      message("b", "2026-08-09T10:00:00.000Z"),
      message("c", "2026-08-09T10:01:00.000Z"),
    ],
    [
      message("a", "2026-08-09T09:59:00.000Z"),
      message("b", "2026-08-09T10:00:00.000Z", "updated"),
    ],
  );
  assert.deepEqual(
    merged.map(({ message_id }) => message_id),
    ["a", "b", "c"],
  );
  assert.equal(merged[1]?.body, "updated");
});

test("history endpoint uses existing stable cursor and bounded page", () => {
  assert.match(
    service,
    /p_before_created_at:\s*options\?\.beforeCreatedAt \?\? null/,
  );
  assert.match(service, /p_before_id:\s*options\?\.beforeId \?\? null/);
  assert.match(pollRoute, /export async function POST/);
  assert.match(pollRoute, /beforeCreatedAt/);
  assert.match(pollRoute, /beforeId/);
  assert.match(pollRoute, /limit:\s*50/);
  assert.match(pollRoute, /hasMore:\s*messages\.length === 50/);
  assert.match(room, /Muat pesan sebelumnya/);
  assert.match(room, /Awal percakapan/);
  assert.match(room, /prependSnapshot/);
  assert.match(room, /mergeChatMessages/);
});

test("poll backoff is bounded and success cadence can reset", () => {
  assert.equal(nextPollDelay(0, 4000, 30000), 4000);
  assert.equal(nextPollDelay(1, 4000, 30000), 8000);
  assert.equal(nextPollDelay(8, 4000, 30000), 30000);
  assert.equal(nextPollDelay(0, 30000, 120000), 30000);
});

test("near-bottom policy preserves readers who are scrolled upward", () => {
  assert.equal(isNearChatBottom(1000, 600, 320), true);
  assert.equal(isNearChatBottom(1000, 400, 320), false);
  assert.match(room, /Pesan baru/);
  assert.match(room, /shouldScrollAfterUpdate\.current = nearBottom/);
});

test("message character announcements only occur at useful thresholds", () => {
  assert.equal(getCharacterThresholdAnnouncement(900, 1000), "100 karakter tersisa.");
  assert.equal(getCharacterThresholdAnnouncement(980, 1000), "20 karakter tersisa.");
  assert.equal(getCharacterThresholdAnnouncement(1000, 1000), "Batas karakter tercapai.");
  assert.equal(getCharacterThresholdAnnouncement(500, 1000), "");
  assert.doesNotMatch(room, /id=\{counterId\} aria-live/);
});

test("end dialog and chat layout close accessibility audit contracts", () => {
  assert.match(room, /aria-labelledby=\{endTitleId\}/);
  assert.match(room, /aria-describedby=\{endDescriptionId\}/);
  assert.match(room, /endCancelRef\.current\?\.focus/);
  assert.match(room, /onClose=\{\(\) => endTriggerRef\.current\?\.focus/);
  assert.match(room, /aria-label="Privasi dan pembukaan bertahap"/);
  assert.match(
    room,
    /<footer className="sticky bottom-0 z-20[^"]*">/,
  );
  const privacySection = room.indexOf('aria-label="Privasi dan pembukaan bertahap"');
  const stickyFooter = room.indexOf('<footer className="sticky bottom-0');
  assert.ok(privacySection >= 0 && privacySection < stickyFooter);
});
