import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  chatMessageSchema,
  conversationPublicIdSchema,
  messageReactionSchema,
  normalizeChatMessage,
  sendChatShareSchema,
  sendChatStickerSchema,
} from "../lib/messages/validation.ts";
import {
  CHAT_MESSAGE_MAX,
  CHAT_RATE_LIMITS,
} from "../lib/messages/constants.ts";
import {
  filterConversations,
  normalizeConversationQuery,
  parseConversationView,
  searchConversations,
} from "../lib/messages/filters.ts";
import {
  getCharacterThresholdAnnouncement,
  isNearChatBottom,
  mergeChatMessages,
  nextChatPollDelay,
  nextPollDelay,
} from "../lib/messages/client-state.ts";
import { CHAT_REACTIONS } from "../lib/messages/reactions.ts";
import {
  CHAT_SHARE_KIND_LABELS,
  getChatShareHref,
} from "../lib/messages/shares.ts";
import { CHAT_STARTERS } from "../lib/messages/starters.ts";
import {
  CHAT_EMOJI_SHORTLIST,
  CHAT_STICKERS,
  getChatStickerById,
} from "../lib/messages/stickers.ts";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202608060003_create_anonymous_chat_v1.sql",
    import.meta.url,
  ),
  "utf8",
);
const stickerMigration = readFileSync(
  new URL(
    "../supabase/migrations/202608250001_anonymous_chat_official_stickers_v1.sql",
    import.meta.url,
  ),
  "utf8",
);
const realtimeMigration = readFileSync(
  new URL(
    "../supabase/migrations/202610020002_anonymous_chat_realtime_v1.sql",
    import.meta.url,
  ),
  "utf8",
);
const sharingMigration = readFileSync(
  new URL(
    "../supabase/migrations/202610070001_anonymous_chat_circle_event_sharing_v1.sql",
    import.meta.url,
  ),
  "utf8",
);
const interactionMigration = readFileSync(
  new URL(
    "../supabase/migrations/202610020004_anonymous_chat_replies_reactions_v1.sql",
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
const messageBubble = readFileSync(
  new URL("../components/messages/chat-message-bubble.tsx", import.meta.url),
  "utf8",
);
const sharedItemCard = readFileSync(
  new URL("../components/messages/chat-shared-item-card.tsx", import.meta.url),
  "utf8",
);
const composerTools = readFileSync(
  new URL("../components/messages/chat-composer-tools.tsx", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("../lib/messages/service.ts", import.meta.url),
  "utf8",
);
const navigation = readFileSync(
  new URL(
    "../components/navigation/responsive-navigation.tsx",
    import.meta.url,
  ),
  "utf8",
);
const pollRoute = readFileSync(
  new URL("../app/api/messages/[publicId]/route.ts", import.meta.url),
  "utf8",
);
const sendRoute = readFileSync(
  new URL("../app/api/messages/[publicId]/send/route.ts", import.meta.url),
  "utf8",
);
const reactionRoute = readFileSync(
  new URL("../app/api/messages/[publicId]/reactions/route.ts", import.meta.url),
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
  assert.doesNotMatch(migration, /encode\(gen_random_bytes\(16\), 'hex'\)/);
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
  assert.match(
    migration,
    /is_eligible_introduction_student\(current_user_id\)/,
  );
  assert.match(migration, /is_eligible_introduction_student\(counterpart_id\)/);
  assert.match(introMigration, /not public\.is_active_staff_user/);
});

test("users cannot create arbitrary conversation shells from chat RPCs", () => {
  assert.doesNotMatch(
    migration,
    /create or replace function public\.create_conversation/,
  );
  assert.match(
    migration,
    /revoke all on table public\.anonymous_messages from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /revoke all on table public\.conversation_events from public, anon, authenticated/,
  );
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
  assert.equal(normalizeChatMessage("  a\n\n\nb  ").includes("a\n\nb"), true);
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
  assert.match(room, /<ChatMessageBubble/);
  assert.match(messageBubble, /Dibaca|Terkirim/);
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
    assert.doesNotMatch(
      block[1],
      /participant_sender_id|first_name|\bnim\b|email/i,
    );
  }
  assert.doesNotMatch(
    service,
    /participant_sender_id|legal_name|nim_ciphertext/,
  );
  assert.equal(conversationPublicIdSchema.safeParse("abc").success, false);
  assert.equal(
    conversationPublicIdSchema.safeParse("0".repeat(32)).success,
    true,
  );
});

test("reporting is participant-only with constrained reasons", () => {
  assert.match(migration, /report_conversation/);
  assert.match(
    migration,
    /only participants|participant_sender_id, shell\.participant_recipient_id/,
  );
  assert.match(migration, /harassment', 'spam', 'contact_pressure'/);
  assert.match(migration, /report rate limited/);
});

test("messages UI uses product terminology and escaped text rendering", () => {
  assert.match(messagesPage, /Belum ada percakapan/);
  assert.match(messagesPage, /Cari teman/);
  assert.match(room, /Tulis pesan/);
  assert.match(room, /Akhiri percakapan/);
  assert.match(messageBubble, /whitespace-pre-wrap break-words/);
  assert.doesNotMatch(room, /dangerouslySetInnerHTML|match score|online now/i);
  assert.doesNotMatch(messagesPage, /\bDM\b|compatibility|swipe/i);
});

test("student navigation includes Pesan and staff shell does not", () => {
  assert.match(navigation, /label: "Pesan"/);
  assert.match(navigation, /href: "\/app\/messages"/);
  assert.doesNotMatch(navigation, /getStaffItems[\s\S]*\/app\/messages/);
});

test("chat sends without a page reload and keeps server authorization", () => {
  assert.match(sendRoute, /getAuthenticatedUser/);
  assert.match(sendRoute, /onboarding_completed_at/);
  assert.match(sendRoute, /sendChatMessageSchema/);
  assert.match(sendRoute, /sendChatStickerSchema/);
  assert.match(sendRoute, /sendAnonymousMessage/);
  assert.match(sendRoute, /sendAnonymousSticker/);
  assert.match(room, /event\.preventDefault\(\)/);
  assert.match(room, /method: "POST"/);
  assert.match(room, /\/api\/messages\/\$\{conversation\.public_id\}\/send/);
  assert.match(room, /mergeChatMessages\(current, \[payload\.message/);
});

test("empty conversations offer student-focused conversation starters", () => {
  assert.equal(CHAT_STARTERS.length, 4);
  for (const starter of CHAT_STARTERS) {
    assert.ok(starter.message.length > 20);
    assert.doesNotMatch(starter.message, /https?:|@|\b\d{8,}\b/i);
  }
  assert.match(room, /Belum tahu mau bahas apa/);
  assert.match(room, /CHAT_STARTERS\.map/);
  assert.match(room, /setBody\(starter\.message\)/);
});

test("message polling preserves sticker metadata", () => {
  assert.match(pollRoute, /message_type: message\.message_type/);
  assert.match(pollRoute, /sticker_id: message\.sticker_id/);
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
    /function stopActivePolls\(\)[\s\S]*messageGeneration \+= 1;[\s\S]*revealGeneration \+= 1;[\s\S]*messageController\?\.abort\(\);[\s\S]*revealController\?\.abort\(\);/,
  );
  assert.match(room, /function handleVisibility\(\)[\s\S]*stopActivePolls\(\)/);
  assert.match(room, /mode=messages/);
  assert.match(room, /mode=reveal/);
  assert.match(migration, /No table SELECT grants|polling/i);
  assert.doesNotMatch(
    migration,
    /grant select on table public\.anonymous_messages to authenticated/i,
  );
});

test("client cannot forge moderation state", () => {
  assert.doesNotMatch(migration, /p_moderation_status/);
  assert.match(migration, /moderation_status text not null default 'visible'/);
});

test("emoji remains plain Unicode text and composer exposes an accessible shortlist", () => {
  assert.ok(CHAT_EMOJI_SHORTLIST.includes("😂"));
  assert.ok(CHAT_EMOJI_SHORTLIST.includes("📚"));
  assert.equal(chatMessageSchema.safeParse("Semangat 📚🔥").success, true);
  assert.match(composerTools, /Tambahkan emoji/);
  assert.match(room, /insertEmoji/);
});

test("official sticker catalog is bounded to approved StudyDate mascot assets", () => {
  assert.equal(CHAT_STICKERS.length, 4);
  for (const sticker of CHAT_STICKERS) {
    assert.match(sticker.id, /^studydate_/);
    assert.match(sticker.src, /^\/brand\/mascot\//);
    assert.equal(getChatStickerById(sticker.id)?.id, sticker.id);
    assert.equal(
      sendChatStickerSchema.safeParse({
        publicId: "0".repeat(32),
        stickerId: sticker.id,
      }).success,
      true,
    );
  }
  assert.equal(
    sendChatStickerSchema.safeParse({
      publicId: "0".repeat(32),
      stickerId: "https://evil.example/sticker.png",
    }).success,
    false,
  );
});

test("sticker migration preserves privacy, rate limits, and rolling-deploy compatibility", () => {
  assert.match(stickerMigration, /message_type in \('text', 'sticker'\)/);
  assert.match(stickerMigration, /sticker_id in \(/);
  assert.match(stickerMigration, /send_anonymous_sticker/);
  assert.match(stickerMigration, /auth\.uid\(\)/);
  assert.match(stickerMigration, /is_eligible_introduction_student/);
  assert.match(stickerMigration, /users_are_blocked/);
  assert.match(stickerMigration, /sent_last_minute >= 20/);
  assert.match(stickerMigration, /sent_last_day >= 300/);
  assert.match(stickerMigration, /list_conversation_messages_v2/);
  assert.doesNotMatch(stickerMigration, /https?:\/\//i);
  assert.match(
    service,
    /error\.code !== "PGRST202" && error\.code !== "42883"/,
  );
  assert.match(service, /list_conversation_messages_v2/);
  assert.match(service, /list_conversation_messages"/);
});

test("chat renders official stickers without user-controlled image URLs", () => {
  assert.match(messageBubble, /message\.message_type === "sticker"/);
  assert.match(messageBubble, /getChatStickerById\(message\.sticker_id\)/);
  assert.match(composerTools, /formAction=\{submitChatSticker\}/);
  assert.doesNotMatch(
    `${messageBubble}\n${composerTools}`,
    /stickerUrl|sticker_url|dangerouslySetInnerHTML/,
  );
});

test("history merge deduplicates and preserves deterministic chronological order", () => {
  const message = (id: string, createdAt: string, body = id) => ({
    message_id: id,
    body,
    message_type: "text" as const,
    sticker_id: null,
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

test("poll backoff is bounded and idle chat polling slows down", () => {
  assert.equal(nextPollDelay(0, 4_000, 30_000), 4_000);
  assert.equal(nextPollDelay(1, 4_000, 30_000), 8_000);
  assert.equal(nextPollDelay(8, 4_000, 30_000), 30_000);
  assert.equal(nextPollDelay(0, 30_000, 120_000), 30_000);
  assert.equal(nextChatPollDelay(0, 0), 6_000);
  assert.equal(nextChatPollDelay(0, 2), 12_000);
  assert.equal(nextChatPollDelay(0, 4), 25_000);
  assert.equal(nextChatPollDelay(1, 0), 12_000);
  assert.equal(nextChatPollDelay(8, 0), 30_000);
  assert.match(room, /navigator\.onLine/);
  assert.match(room, /addEventListener\("offline"/);
  assert.match(room, /addEventListener\("online"/);
  assert.match(room, /markMessagesReadAction/);
});

test("near-bottom policy preserves readers who are scrolled upward", () => {
  assert.equal(isNearChatBottom(1000, 600, 320), true);
  assert.equal(isNearChatBottom(1000, 400, 320), false);
  assert.match(room, /Pesan baru/);
  assert.match(room, /shouldScrollAfterUpdate\.current = nearBottom/);
});

test("message character announcements only occur at useful thresholds", () => {
  assert.equal(
    getCharacterThresholdAnnouncement(900, 1000),
    "100 karakter tersisa.",
  );
  assert.equal(
    getCharacterThresholdAnnouncement(980, 1000),
    "20 karakter tersisa.",
  );
  assert.equal(
    getCharacterThresholdAnnouncement(1000, 1000),
    "Batas karakter tercapai.",
  );
  assert.equal(getCharacterThresholdAnnouncement(500, 1000), "");
  assert.doesNotMatch(room, /id=\{counterId\} aria-live/);
});

test("end dialog and chat layout close accessibility audit contracts", () => {
  assert.match(room, /aria-labelledby=\{endTitleId\}/);
  assert.match(room, /aria-describedby=\{endDescriptionId\}/);
  assert.match(room, /endCancelRef\.current\?\.focus/);
  assert.match(room, /onClose=\{\(\) => endTriggerRef\.current\?\.focus/);
  assert.match(room, /aria-label="Privasi dan pembukaan bertahap"/);
  assert.match(room, /<footer className="sticky bottom-0 z-20[^"]*">/);
  const privacySection = room.indexOf(
    'aria-label="Privasi dan pembukaan bertahap"',
  );
  const stickyFooter = room.indexOf('<footer className="sticky bottom-0');
  assert.ok(privacySection >= 0 && privacySection < stickyFooter);
});

test("private Realtime topics keep chat authorization and payloads narrow", () => {
  assert.match(
    realtimeMigration,
    /p_topic ~ '\^conversation:\[0-9a-f\]\{32\}\$'/,
  );
  assert.match(
    realtimeMigration,
    /shell\.participant_sender_id[\s\S]*shell\.participant_recipient_id/,
  );
  assert.match(
    realtimeMigration,
    /on realtime\.messages[\s\S]*for select[\s\S]*to authenticated/,
  );
  assert.match(
    realtimeMigration,
    /on realtime\.messages[\s\S]*for insert[\s\S]*to authenticated/,
  );
  assert.match(realtimeMigration, /extension = 'broadcast'/);
  assert.match(realtimeMigration, /\(select realtime\.topic\(\)\)/);
  assert.doesNotMatch(
    realtimeMigration,
    /alter table realtime\.messages enable row level security/i,
  );
  assert.doesNotMatch(
    realtimeMigration,
    /grant select on table public\.anonymous_messages to authenticated/i,
  );
  assert.doesNotMatch(realtimeMigration, /jsonb_build_object\([\s\S]*?'body'/i);
});

test("Realtime accelerates safe refetch while polling stays available", () => {
  assert.match(realtimeMigration, /after insert on public\.anonymous_messages/);
  assert.match(realtimeMigration, /'message_changed'/);
  assert.match(realtimeMigration, /when others then[\s\S]*null;/);
  assert.match(room, /config:\s*\{[\s\S]*private: true/);
  assert.match(room, /broadcast: \{ self: false, ack: false \}/);
  assert.match(room, /\.setAuth\(\)/);
  assert.match(room, /event: "message_changed"/);
  assert.match(room, /void pollMessages\(\)/);
  assert.match(room, /scheduleMessages\(6_000\)/);
  assert.match(room, /removeChannel\(realtimeChannel\)/);
});

test("typing status is private, throttled, and expires automatically", () => {
  assert.match(room, /event: "typing"/);
  assert.match(room, /payload: \{ active \}/);
  assert.match(room, /now - lastTypingSignalAtRef\.current >= 1_200/);
  assert.match(room, /\(\) => publishTyping\(false\),\s*1_800/);
  assert.match(room, /\(\) => setCounterpartTyping\(false\),\s*2_500/);
  assert.match(room, /sedang mengetik…/);
  assert.doesNotMatch(room, /payload: \{[^}]*userId/);
});

test("reply targets stay inside the same authorized conversation", () => {
  assert.match(
    interactionMigration,
    /candidate\.id = p_reply_to_message_id[\s\S]*candidate\.conversation_id = shell\.id/,
  );
  assert.match(
    interactionMigration,
    /candidate\.moderation_status = 'visible'/,
  );
  assert.match(interactionMigration, /anonymous_messages_reply_not_self/);
  assert.match(interactionMigration, /send_anonymous_message_v2/);
  assert.match(interactionMigration, /send_anonymous_sticker_v2/);
  assert.match(interactionMigration, /idempotency conflict/);
});

test("message reactions expose aggregates without participant identities", () => {
  assert.equal(CHAT_REACTIONS.length, 5);
  assert.equal(
    messageReactionSchema.safeParse({
      publicId: "a".repeat(32),
      messageId: "00000000-0000-4000-8000-000000000000",
      reaction: "love",
    }).success,
    true,
  );
  assert.equal(
    messageReactionSchema.safeParse({
      publicId: "a".repeat(32),
      messageId: "00000000-0000-4000-8000-000000000000",
      reaction: "dating",
    }).success,
    false,
  );
  assert.match(interactionMigration, /primary key \(message_id, user_id\)/);
  assert.match(interactionMigration, /count\(\*\)::integer as reaction_count/);
  assert.match(interactionMigration, /reacted_by_me/);
  assert.doesNotMatch(
    interactionMigration,
    /grant (select|insert|update|delete) on table public\.anonymous_message_reactions/i,
  );
  assert.match(
    interactionMigration,
    /alter table public\.anonymous_message_reactions enable row level security/i,
  );
});

test("reply and reaction UI stays capability-gated during database rollout", () => {
  assert.match(room, /messageInteractionsEnabled && !closed/);
  assert.match(room, /replyToMessageId/);
  assert.match(room, /Membalas/);
  assert.match(room, /Batalkan balasan/);
  assert.match(messageBubble, /Balas/);
  assert.match(messageBubble, /Reaksi/);
  assert.match(messageBubble, /aria-pressed=\{summary\.reacted_by_me\}/);
  assert.match(sendRoute, /listConversationMessages/);
  assert.match(reactionRoute, /getAuthenticatedUser/);
  assert.match(reactionRoute, /onboarding_completed_at/);
  assert.match(reactionRoute, /messageReactionSchema/);
});

test("message interaction RPCs fall back without disabling existing chat", () => {
  assert.match(service, /list_conversation_messages_v3/);
  assert.match(service, /list_conversation_messages_v2/);
  assert.match(service, /list_conversation_messages"/);
  assert.match(service, /isMissingRpc/);
  assert.match(service, /Fitur balas pesan belum siap/);
  assert.match(interactionMigration, /'message_changed'/);
  assert.match(interactionMigration, /'change', 'reactions'/);
});

test("Circle and Event invitations use bounded internal StudyDate routes", () => {
  assert.equal(
    sendChatShareSchema.safeParse({
      publicId: "a".repeat(32),
      shareKind: "circle",
      sharePublicSlug: `circle-${"b".repeat(24)}`,
    }).success,
    true,
  );
  assert.equal(
    sendChatShareSchema.safeParse({
      publicId: "a".repeat(32),
      shareKind: "event",
      sharePublicSlug: `circle-${"b".repeat(24)}`,
    }).success,
    false,
  );
  assert.equal(
    getChatShareHref("event", `event-${"c".repeat(24)}`),
    `/app/events/event-${"c".repeat(24)}`,
  );
  assert.equal(getChatShareHref("event", "https://evil.example"), null);
  assert.equal(CHAT_SHARE_KIND_LABELS.circle, "Circle belajar");
});

test("chat sharing stays participant-only and never accepts external URLs", () => {
  assert.match(sharingMigration, /list_chat_shareables/);
  assert.match(sharingMigration, /send_anonymous_share_v1/);
  assert.match(sharingMigration, /conversation_counterpart_id/);
  assert.match(
    sharingMigration,
    /actor in \([\s\S]*participant_sender_id[\s\S]*participant_recipient_id/,
  );
  assert.match(sharingMigration, /share_public_slug ~ '\^circle-/);
  assert.match(sharingMigration, /share_public_slug ~ '\^event-/);
  assert.doesNotMatch(sharingMigration, /share_url|external_url|https?:\/\//i);
  assert.doesNotMatch(
    sharingMigration,
    /grant (select|insert|update|delete) on table public\.anonymous_messages/i,
  );
});

test("sharing does not auto-join the recipient", () => {
  assert.doesNotMatch(
    sharingMigration,
    /insert into public\.(study_circle_memberships|campus_event_rsvps)/i,
  );
  assert.match(sharingMigration, /already_member\.user_id = counterpart/);
  assert.match(sharingMigration, /already_registered\.user_id = counterpart/);
  assert.match(
    composerTools,
    /Temanmu tetap memilih sendiri mau ikut atau tidak/,
  );
});

test("shared cards are mobile-safe, escaped, and capability-gated", () => {
  assert.match(room, /chatSharingEnabled/);
  assert.match(room, /shareToken/);
  assert.match(composerTools, /w-\[min\(22rem,calc\(100vw-2rem\)\)\]/);
  assert.match(sharedItemCard, /w-\[min\(19rem,calc\(100vw-4\.5rem\)\)\]/);
  assert.match(sharedItemCard, /getChatShareHref/);
  assert.doesNotMatch(sharedItemCard, /dangerouslySetInnerHTML/);
  assert.match(service, /list_conversation_messages_v4/);
  assert.match(service, /list_conversation_messages_v3/);
});

test("sharing migration preserves durable snapshots and chat rate limits", () => {
  assert.match(sharingMigration, /share_title text/);
  assert.match(sharingMigration, /share_description text/);
  assert.match(sharingMigration, /sent_last_minute >= 20/);
  assert.match(sharingMigration, /sent_last_day >= 300/);
  assert.match(sharingMigration, /duplicate message/);
  assert.match(sharingMigration, /reply_target\.conversation_id = shell\.id/);
  assert.match(sharingMigration, /'message_sent'/);
});


test("message filters use existing unread counts and conversation status", () => {
  const conversations = [
    { id: "waiting", status: "awaiting_chat" as const, unread_count: 0 },
    { id: "active", status: "active" as const, unread_count: 3 },
    { id: "ended", status: "ended" as const, unread_count: 0 },
    { id: "blocked", status: "blocked" as const, unread_count: 0 },
  ];

  assert.deepEqual(
    filterConversations(conversations, "unread").map((item) => item.id),
    ["active"],
  );
  assert.deepEqual(
    filterConversations(conversations, "active").map((item) => item.id),
    ["waiting", "active"],
  );
  assert.deepEqual(
    filterConversations(conversations, "ended").map((item) => item.id),
    ["ended", "blocked"],
  );
  assert.equal(filterConversations(conversations, "all").length, 4);
});

test("message view input is allowlisted and safely falls back", () => {
  assert.equal(parseConversationView("unread"), "unread");
  assert.equal(parseConversationView(["active", "ended"]), "active");
  assert.equal(parseConversationView("dating"), "all");
});

test("message filter navigation is accessible and mobile-contained", () => {
  for (const label of [
    "Semua",
    "Belum dibaca",
    "Masih aktif",
    "Sudah selesai",
  ]) {
    assert.match(messagesPage, new RegExp(label));
  }
  assert.match(messagesPage, /aria-label="Filter daftar pesan"/);
  assert.match(messagesPage, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(messagesPage, /grid grid-cols-2/);
  assert.match(messagesPage, /sm:flex sm:flex-wrap/);
  assert.match(messagesPage, /visibleConversations/);
  assert.doesNotMatch(messagesPage, /overflow-x-visible/);
});

test("conversation search matches alias, campus, and study program", () => {
  const conversations = [
    {
      id: "ui",
      counterpart_alias: "Si Rajin",
      campus: "Universitas Indonesia",
      study_program: "Sistem Informasi",
    },
    {
      id: "itb",
      counterpart_alias: "Teman Ngoding",
      campus: "Institut Teknologi Bandung",
      study_program: "Teknik Informatika",
    },
    {
      id: "tel-u",
      counterpart_alias: "Pejuang Skripsi",
      campus: "Telkom University",
      study_program: "Desain Komunikasi Visual",
    },
  ];

  assert.deepEqual(
    searchConversations(conversations, "rajin").map((item) => item.id),
    ["ui"],
  );
  assert.deepEqual(
    searchConversations(conversations, "teknologi bandung").map(
      (item) => item.id,
    ),
    ["itb"],
  );
  assert.deepEqual(
    searchConversations(conversations, "komunikasi visual").map(
      (item) => item.id,
    ),
    ["tel-u"],
  );
  assert.equal(searchConversations(conversations, "").length, 3);
});

test("conversation search input is normalized, bounded, and accent insensitive", () => {
  assert.equal(
    normalizeConversationQuery(["  Sistem   Informasi ", "ignored"]),
    "Sistem Informasi",
  );
  assert.equal(normalizeConversationQuery(null), "");
  assert.equal(normalizeConversationQuery("a".repeat(100)).length, 80);
  assert.equal(
    searchConversations(
      [
        {
          counterpart_alias: "Café Learner",
          campus: "Université Indonesia",
          study_program: "Sistem Informasi",
        },
      ],
      "CAFE UNIVERSITE",
    ).length,
    1,
  );
});

test("message search is accessible, privacy-scoped, and mobile-safe", () => {
  assert.match(messagesPage, /role="search"/);
  assert.match(messagesPage, /name="q"/);
  assert.match(messagesPage, /type="search"/);
  assert.match(messagesPage, /maxLength=\{80\}/);
  assert.match(
    messagesPage,
    /Cari nama samaran, kampus, atau program studi/,
  );
  assert.match(messagesPage, /searchConversations/);
  assert.match(messagesPage, /min-w-0 flex-1/);
  assert.match(messagesPage, /name="view" value=\{selectedView\}/);
  assert.doesNotMatch(messagesPage, /Cari isi pesan|preview_body/);
});
