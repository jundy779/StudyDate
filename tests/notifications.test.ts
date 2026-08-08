import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { NotificationBehaviorModel } from "../lib/notifications/behavior-model.ts";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/202608070013_create_notifications_v1.sql",
  ),
  "utf8",
);
const service = readFileSync(
  join(root, "lib/notifications/service.ts"),
  "utf8",
);
const route = readFileSync(
  join(root, "app/api/notifications/route.ts"),
  "utf8",
);
const actions = readFileSync(
  join(root, "app/app/notifications/actions.ts"),
  "utf8",
);
const navigation = readFileSync(
  join(root, "components/navigation/responsive-navigation.tsx"),
  "utf8",
);
const bell = readFileSync(
  join(root, "components/notifications/notification-bell.tsx"),
  "utf8",
);
const item = readFileSync(
  join(root, "components/notifications/notification-item.tsx"),
  "utf8",
);
const page = readFileSync(
  join(root, "app/app/notifications/page.tsx"),
  "utf8",
);
const copy = readFileSync(
  join(root, "lib/notifications/constants.ts"),
  "utf8",
);

const A = "student-a";
const B = "student-b";
const C = "student-c";
const STAFF = "student-staff";
const PUBLIC_ID = "ab".repeat(16);

function seed() {
  const model = new NotificationBehaviorModel();
  model.seedStudent(A);
  model.seedStudent(B);
  model.seedStudent(C);
  model.seedStudent(STAFF);
  model.seedStaff(STAFF);
  model.seedConversation(PUBLIC_ID, A, B);
  return model;
}

test("1–10. recipient-specific list and controlled read state", () => {
  const model = seed();
  assert.throws(() => model.list(null), /student/);
  model.sendIntroduction(A, B, "request-1");
  assert.equal(model.list(A).length, 0);
  assert.equal(model.list(C).length, 0);
  assert.equal(model.list(B).length, 1);
  assert.equal(model.unreadCount(B), 1);
  assert.equal(model.unreadCount(A), 0);

  const row = model.list(B)[0];
  assert.equal(model.markRead(A, row.publicId), false);
  assert.equal(model.markRead(B, row.publicId), true);
  assert.equal(model.unreadCount(B), 0);

  model.sendIntroduction(A, B, "request-2");
  model.sendIntroduction(A, B, "request-3");
  assert.equal(model.markAllRead(B), 2);
  assert.equal(model.unreadCount(B), 0);
  assert.equal(model.list(A).length, 0);

  assert.throws(() => model.list(STAFF), /student/);
  assert.match(migration, /revoke all on table public\.user_notifications from public, anon, authenticated/);
  assert.doesNotMatch(migration, /grant (insert|update|delete)[^;]*user_notifications/i);
  assert.match(migration, /current_user_id uuid := auth\.uid\(\)/g);
  assert.doesNotMatch(
    migration,
    /list_my_notifications\([^)]*p_(recipient|user)_id/i,
  );
});

test("11–16. introduction and message notifications are atomic and deduped", () => {
  const model = seed();
  model.sendIntroduction(A, B, "request-1");
  assert.equal(model.list(B)[0].type, "INTRODUCTION_RECEIVED");

  model.acceptIntroduction(B, A, "request-1");
  model.acceptIntroduction(B, A, "request-1");
  assert.deepEqual(
    model.list(A).map((row) => row.type),
    ["INTRODUCTION_ACCEPTED"],
  );

  model.sendMessage(A, PUBLIC_ID, "message-1", "idem-key-1");
  model.sendMessage(A, PUBLIC_ID, "message-2", "idem-key-1");
  assert.equal(
    model.list(B).filter((row) => row.type === "MESSAGE_RECEIVED").length,
    1,
  );
  assert.equal(
    model.list(A).filter((row) => row.type === "MESSAGE_RECEIVED").length,
    0,
  );

  assert.match(migration, /after insert or update of status on public\.introduction_requests/);
  assert.match(migration, /after insert on public\.anonymous_messages/);
  assert.match(migration, /on conflict \(dedupe_key\) do nothing/);
});

test("17–20. Mutual and Identity notify only after two-party completion", () => {
  const model = seed();
  const initialPayload = JSON.stringify(model.list(B));
  const beforeB = model.unreadCount(B);
  model.selectMutual(A, PUBLIC_ID);
  assert.equal(model.unreadCount(B), beforeB);
  assert.equal(JSON.stringify(model.list(B)), initialPayload);
  model.withdrawMutual(A, PUBLIC_ID);
  assert.equal(model.unreadCount(B), beforeB);
  assert.equal(JSON.stringify(model.list(B)), initialPayload);
  model.selectMutual(A, PUBLIC_ID);
  model.selectMutual(B, PUBLIC_ID);
  assert.equal(
    model.list(B).filter((row) => row.type === "MUTUAL_INTEREST_COMPLETED")
      .length,
    1,
  );

  const afterMutual = model.unreadCount(B);
  const mutualPayload = JSON.stringify(model.list(B));
  model.prepareIdentity(A, PUBLIC_ID);
  model.selectIdentity(A, PUBLIC_ID);
  assert.equal(model.unreadCount(B), afterMutual);
  assert.equal(JSON.stringify(model.list(B)), mutualPayload);
  model.withdrawIdentity(A, PUBLIC_ID);
  assert.equal(model.unreadCount(B), afterMutual);
  assert.equal(JSON.stringify(model.list(B)), mutualPayload);
  model.selectIdentity(A, PUBLIC_ID);
  model.selectIdentity(B, PUBLIC_ID);
  assert.equal(
    model.list(B).filter((row) => row.type === "IDENTITY_REVEAL_COMPLETED")
      .length,
    1,
  );

  assert.doesNotMatch(
    migration,
    /conversation_mutual_interests_notify|identity_reveal_profile_versions_notify|conversation_identity_reveal_consents_notify/,
  );
});

test("21–24. Contact channels are independent and contain no contact value", () => {
  const model = seed();
  const initialPayload = JSON.stringify(model.list(B));
  const beforeB = model.unreadCount(B);
  model.prepareContact(A, PUBLIC_ID, "telegram");
  model.selectContact(A, PUBLIC_ID, "telegram");
  assert.equal(model.unreadCount(B), beforeB);
  assert.equal(JSON.stringify(model.list(B)), initialPayload);
  model.withdrawContact(A, PUBLIC_ID, "telegram");
  assert.equal(model.unreadCount(B), beforeB);
  assert.equal(JSON.stringify(model.list(B)), initialPayload);

  model.selectContact(A, PUBLIC_ID, "telegram");
  model.selectContact(B, PUBLIC_ID, "telegram");
  const contact = model
    .list(B)
    .filter((row) => row.type === "CONTACT_REVEAL_COMPLETED");
  assert.equal(contact.length, 1);
  assert.equal(contact[0].channel, "telegram");
  assert.equal(
    contact.some((row) => row.channel === "instagram" || row.channel === "linkedin"),
    false,
  );
  assert.doesNotMatch(JSON.stringify(contact), /username|linkedin\.com|@|contact value/i);

  model.selectContact(A, PUBLIC_ID, "instagram");
  model.selectContact(B, PUBLIC_ID, "instagram");
  assert.deepEqual(
    model
      .list(B)
      .filter((row) => row.type === "CONTACT_REVEAL_COMPLETED")
      .map((row) => row.channel),
    ["telegram", "instagram"],
  );
  assert.doesNotMatch(
    migration,
    /conversation_contact_versions_notify|conversation_contact_reveal_consents_notify/,
  );
});

test("25–27. safe projection, block/end authorization, and staff isolation", () => {
  const model = seed();
  model.sendMessage(A, PUBLIC_ID, "message-1", "idem-key-1");
  const payload = JSON.stringify(model.list(B));
  assert.doesNotMatch(
    payload,
    /student-a|student-b|recipientId|dedupeKey|ciphertext|storage|nim|email/i,
  );
  assert.match(payload, new RegExp(PUBLIC_ID));

  const oldTarget = model.list(B)[0].targetPath;
  model.block(A, B, PUBLIC_ID);
  assert.throws(
    () => model.sendMessage(A, PUBLIC_ID, "message-2", "idem-key-2"),
    /unavailable/,
  );
  assert.equal(model.list(B)[0].targetPath, oldTarget);
  assert.throws(() => model.selectIdentity(B, PUBLIC_ID), /unavailable/);

  assert.throws(() => model.list(STAFF), /student/);
  assert.match(migration, /not public\.is_active_staff_user\(p_user_id\)/);
});

test("static SQL contracts harden table, RPCs, emitters, and types", () => {
  assert.match(migration, /alter table public\.user_notifications enable row level security/);
  assert.match(migration, /constraint user_notifications_type_allowed/);
  assert.match(migration, /constraint user_notifications_target_safe/);
  assert.match(migration, /constraint user_notifications_metadata_safe/);
  assert.match(migration, /set search_path = ''/g);
  assert.doesNotMatch(migration, /execute\s+format|dynamic sql/i);
  assert.match(
    migration,
    /session_user not in \('postgres', 'supabase_admin', 'authenticator'\)/,
  );

  for (const helper of [
    "emit_user_notification",
    "notify_introduction_transition",
    "notify_anonymous_message",
    "notify_completed_connection_event",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${helper}\\([\\s\\S]*?from public, anon, authenticated`,
      ),
    );
  }
  for (const rpc of [
    "list_my_notifications",
    "count_my_unread_notifications",
    "mark_my_notification_read",
    "mark_all_my_notifications_read",
  ]) {
    assert.match(migration, new RegExp(`grant execute on function public\\.${rpc}`));
  }
  assert.doesNotMatch(migration, /REPORT_STATUS_UPDATED/);
});

test("client projection and copy contain no sensitive fields or UUIDs", () => {
  assert.match(service, /notification_public_id/);
  assert.doesNotMatch(
    service,
    /recipient_user_id|dedupe_key|metadata|contact_(ciphertext|iv|auth_tag)/,
  );
  assert.doesNotMatch(
    route,
    /recipient_user_id|dedupe_key|message body|first_name|legal_name|nim|email/i,
  );
  assert.doesNotMatch(
    copy,
    /Someone likes you|Someone wants to know you|1 of 2|nomor telepon|\bNIM\b|legal name/i,
  );
  assert.doesNotMatch(
    migration,
    /title text|description text|message_body|first_name|legal_name|email|phone|nim|contact_value/i,
  );
});

test("navigation, polling, page, and accessibility contracts are real", () => {
  assert.match(navigation, /href: "\/app\/notifications"/);
  assert.match(navigation, /variant="student"|!isStaff/);
  assert.match(bell, /POLL_INTERVAL_MS = 25_000/);
  assert.match(bell, /visibilitychange/);
  assert.match(bell, /requestActive/);
  assert.match(bell, /clearInterval/);
  assert.match(bell, /aria-label=\{label\}/);
  assert.match(bell, /99\+/);
  assert.match(item, /<button/);
  assert.match(item, /focus-ring/);
  assert.match(item, /Belum dibaca/);
  assert.match(page, /NotificationCenter/);
  assert.match(page, /Notifikasi/);
  assert.match(page, /limit: 21/);
  assert.doesNotMatch(navigation, /variant === "staff"[\s\S]{0,120}NotificationBell/);
  assert.match(route, /status: 401/);
  assert.match(route, /status: 403/);
  assert.doesNotMatch(route, /redirect\(/);
  assert.match(actions, /markNotificationRead/);
  assert.match(actions, /markAllNotificationsRead/);
});
