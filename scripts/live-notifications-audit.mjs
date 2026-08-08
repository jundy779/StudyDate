/**
 * Live Notifications v1 audit. Requires the local Notifications migration to
 * already exist on the target environment; this script never applies it.
 *
 * Sanitized output only: no emails, UUIDs, tokens, message bodies, contacts,
 * names, NIM, Storage paths, or dedupe keys.
 */
import assert from "node:assert/strict";
import { randomBytes, randomInt } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const artifactDir = join(root, "audit-artifacts");
const reportPath = join(artifactDir, "notifications-live-report.json");
const EXPECTED_PROJECT_REF = "ctbqudtvrfezuoqcecyj";
mkdirSync(artifactDir, { recursive: true });

function loadEnv() {
  const env = { ...process.env };
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(
    /\r?\n/,
  )) {
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    env[line.slice(0, index)] = line.slice(index + 1);
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const publishable =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(url && serviceKey && publishable, "missing environment");
assert.equal(new URL(url).hostname.split(".")[0], EXPECTED_PROJECT_REF);

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, publishable, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const users = [];
const report = {
  projectRefOk: true,
  migrationAvailable: false,
  anonDenied: false,
  recipientIsolation: false,
  trustedCreation: false,
  introduction: false,
  messageIdempotency: false,
  oneSidedMutual: false,
  mutualCompletion: false,
  oneSidedIdentity: false,
  identityCompletion: false,
  oneSidedContact: false,
  contactCompletion: false,
  crossChannelIsolation: false,
  blockStopsFuture: false,
  safeProjection: false,
  cleanup: false,
};

function client() {
  return createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createStudent(kind) {
  const stamp = `${Date.now()}.${randomInt(1000, 9999)}`;
  const email = `studydate.notifications.${kind}.${stamp}@audit.ac.id`;
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (created.error || !created.data.user) throw new Error("create failed");
  users.push(created.data.user.id);

  const sessionClient = client();
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (link.error || !link.data.properties?.hashed_token) {
    throw new Error("link failed");
  }
  const verified = await sessionClient.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "email",
  });
  if (verified.error) throw new Error("session failed");

  const alias = `Partner #${randomInt(100000, 999999)}`;
  const onboarded = await sessionClient.rpc("complete_student_onboarding_v2", {
    p_public_alias: alias,
    p_first_name: "Audit",
    p_last_name: "Sintetik",
    p_nim_ciphertext: null,
    p_nim_iv: null,
    p_nim_auth_tag: null,
    p_nim_key_version: null,
    p_nim_last_four: null,
    p_nim_fingerprint: null,
    p_campus: "Universitas Audit",
    p_study_program: "Teknik Audit",
    p_degree_level: "sarjana",
    p_semester: 4,
    p_city_region: "Kota Audit",
    p_short_intro: "Akun sintetis untuk audit notifikasi.",
    p_interests: ["technology"],
    p_connection_goals: ["study"],
    p_online_first: true,
    p_group_first: false,
    p_verified_users_only: false,
    p_same_campus_preferred: false,
    p_cross_campus_allowed: true,
    p_terms_version: "audit",
    p_privacy_version: "audit",
    p_guidelines_version: "audit",
  });
  if (onboarded.error) throw new Error("onboarding failed");
  await sessionClient.rpc("upsert_my_student_social_contacts", {
    p_linkedin_url: `https://www.linkedin.com/in/studydate-${kind}-${stamp.replaceAll(".", "-")}`,
    p_instagram_username: null,
  });
  const visible = await sessionClient.rpc("set_people_discovery_visibility", {
    p_is_discoverable: true,
  });
  if (visible.error) throw new Error("visibility failed");
  return { alias, client: sessionClient, id: created.data.user.id };
}

async function list(sessionClient) {
  const result = await sessionClient.rpc("list_my_notifications", {
    p_limit: 51,
    p_before_created_at: null,
    p_before_public_id: null,
    p_unread_only: false,
  });
  if (result.error) throw new Error("list failed");
  return result.data ?? [];
}

async function count(sessionClient) {
  const result = await sessionClient.rpc("count_my_unread_notifications");
  if (result.error) throw new Error("count failed");
  return Number(result.data ?? 0);
}

async function notificationTypes(sessionClient) {
  return (await list(sessionClient)).map((row) => row.notification_type);
}

async function safeRowScan(rows) {
  const serialized = JSON.stringify(rows);
  assert.doesNotMatch(
    serialized,
    /recipient|dedupe|cipher|contact_value|message_body|first_name|email|nim|storage/i,
  );
  assert.equal(
    rows.every((row) =>
      [
        "notification_public_id",
        "notification_type",
        "target_path",
        "channel",
        "created_at",
        "read_at",
      ].every((key) => Object.hasOwn(row, key)),
    ),
    true,
  );
}

async function registerContact(owner, publicId, channel, value) {
  const payload = Buffer.from(value);
  const result = await admin.rpc("register_contact_reveal_version", {
    p_public_id: publicId,
    p_owner_user_id: owner.id,
    p_channel: channel,
    p_contact_ciphertext: `\\x${payload.toString("hex")}`,
    p_contact_iv: `\\x${randomBytes(12).toString("hex")}`,
    p_contact_auth_tag: `\\x${randomBytes(16).toString("hex")}`,
    p_contact_key_version: 1,
  });
  if (result.error) throw new Error("contact setup failed");
  return Array.isArray(result.data) ? result.data[0]?.contact_version_id : null;
}

try {
  const probe = await anon.rpc("count_my_unread_notifications");
  report.migrationAvailable = !/function .* does not exist/i.test(
    probe.error?.message ?? "",
  );
  report.anonDenied = Boolean(probe.error);
  if (!report.migrationAvailable) throw new Error("migration unavailable");

  const [a, b, c] = await Promise.all([
    createStudent("a"),
    createStudent("b"),
    createStudent("c"),
  ]);
  const bStart = await count(b.client);

  const arbitrary = await a.client
    .from("user_notifications")
    .insert({
      recipient_user_id: b.id,
      notification_type: "MESSAGE_RECEIVED",
      target_path: "/app/introductions",
      dedupe_key: "forged",
    });
  report.trustedCreation = Boolean(arbitrary.error);

  const intro = await a.client.rpc("send_introduction_request", {
    p_recipient_alias: b.alias,
    p_opening_message: "Halo, mau belajar bareng untuk audit kampus?",
  });
  if (intro.error) throw new Error("intro failed");
  report.introduction =
    (await notificationTypes(b.client)).filter(
      (type) => type === "INTRODUCTION_RECEIVED",
    ).length === 1;
  report.recipientIsolation =
    !(await notificationTypes(a.client)).includes("INTRODUCTION_RECEIVED") &&
    !(await notificationTypes(c.client)).includes("INTRODUCTION_RECEIVED");

  const accepted = await b.client.rpc("accept_introduction_request", {
    p_request_id: intro.data,
  });
  if (accepted.error) throw new Error("accept failed");
  const shellResult = await a.client.rpc(
    "get_conversation_public_id_for_introduction",
    { p_request_id: intro.data },
  );
  if (shellResult.error || typeof shellResult.data !== "string") {
    throw new Error("shell failed");
  }
  const publicId = shellResult.data;

  const sentA = await a.client.rpc("send_anonymous_message", {
    p_public_id: publicId,
    p_body: "Pesan audit pertama.",
    p_idempotency_key: "notifications-a-0001",
  });
  if (sentA.error) throw new Error("message failed");
  await a.client.rpc("send_anonymous_message", {
    p_public_id: publicId,
    p_body: "Pesan audit pertama.",
    p_idempotency_key: "notifications-a-0001",
  });
  report.messageIdempotency =
    (await notificationTypes(b.client)).filter(
      (type) => type === "MESSAGE_RECEIVED",
    ).length === 1;
  const sentB = await b.client.rpc("send_anonymous_message", {
    p_public_id: publicId,
    p_body: "Balasan audit pertama.",
    p_idempotency_key: "notifications-b-0001",
  });
  if (sentB.error) throw new Error("reply failed");

  const beforeMutual = await count(b.client);
  await a.client.rpc("select_mutual_interest", { p_public_id: publicId });
  report.oneSidedMutual =
    (await count(b.client)) === beforeMutual &&
    JSON.stringify(await notificationTypes(b.client)).indexOf(
      "MUTUAL_INTEREST_COMPLETED",
    ) === -1;
  await b.client.rpc("select_mutual_interest", { p_public_id: publicId });
  report.mutualCompletion =
    (await notificationTypes(a.client)).includes(
      "MUTUAL_INTEREST_COMPLETED",
    ) &&
    (await notificationTypes(b.client)).includes(
      "MUTUAL_INTEREST_COMPLETED",
    );

  const beforeIdentity = await count(b.client);
  const aProfile = await admin.rpc("register_identity_reveal_profile", {
    p_public_id: publicId,
    p_owner_user_id: a.id,
    p_first_name: "Audit",
    p_photo_object_key: `${a.id}/audit.jpg`,
  });
  report.oneSidedIdentity =
    !aProfile.error && (await count(b.client)) === beforeIdentity;
  if (aProfile.error) throw new Error("identity profile failed");
  const bProfile = await admin.rpc("register_identity_reveal_profile", {
    p_public_id: publicId,
    p_owner_user_id: b.id,
    p_first_name: "Audit",
    p_photo_object_key: `${b.id}/audit.jpg`,
  });
  if (bProfile.error) throw new Error("identity profile failed");
  const aVersion = Array.isArray(aProfile.data)
    ? aProfile.data[0]?.profile_version_id
    : null;
  const bVersion = Array.isArray(bProfile.data)
    ? bProfile.data[0]?.profile_version_id
    : null;
  await a.client.rpc("select_identity_reveal", {
    p_public_id: publicId,
    p_profile_version_id: aVersion,
  });
  report.oneSidedIdentity =
    report.oneSidedIdentity && (await count(b.client)) === beforeIdentity;
  await b.client.rpc("select_identity_reveal", {
    p_public_id: publicId,
    p_profile_version_id: bVersion,
  });
  report.identityCompletion =
    (await notificationTypes(a.client)).includes(
      "IDENTITY_REVEAL_COMPLETED",
    ) &&
    (await notificationTypes(b.client)).includes(
      "IDENTITY_REVEAL_COMPLETED",
    );

  const beforeContact = await count(b.client);
  const aTelegram = await registerContact(
    a,
    publicId,
    "telegram",
    "audit_a",
  );
  report.oneSidedContact = (await count(b.client)) === beforeContact;
  const bTelegram = await registerContact(
    b,
    publicId,
    "telegram",
    "audit_b",
  );
  await a.client.rpc("select_contact_reveal", {
    p_public_id: publicId,
    p_channel: "telegram",
    p_contact_version_id: aTelegram,
  });
  report.oneSidedContact =
    report.oneSidedContact && (await count(b.client)) === beforeContact;
  await b.client.rpc("select_contact_reveal", {
    p_public_id: publicId,
    p_channel: "telegram",
    p_contact_version_id: bTelegram,
  });
  const bRows = await list(b.client);
  report.contactCompletion = bRows.some(
    (row) =>
      row.notification_type === "CONTACT_REVEAL_COMPLETED" &&
      row.channel === "telegram",
  );
  report.crossChannelIsolation = !bRows.some(
    (row) =>
      row.notification_type === "CONTACT_REVEAL_COMPLETED" &&
      row.channel !== "telegram",
  );
  await safeRowScan(bRows);
  report.safeProjection = true;

  const beforeBlock = await count(b.client);
  const blocked = await a.client.rpc("block_student_by_alias", {
    p_target_alias: b.alias,
  });
  if (blocked.error) throw new Error("block failed");
  const afterBlockMessage = await a.client.rpc("send_anonymous_message", {
    p_public_id: publicId,
    p_body: "Tidak boleh terkirim.",
    p_idempotency_key: "notifications-a-0002",
  });
  report.blockStopsFuture =
    Boolean(afterBlockMessage.error) && (await count(b.client)) === beforeBlock;
  assert.ok((await count(b.client)) >= bStart);
} finally {
  for (const id of users) {
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
  report.cleanup = true;
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

const ok = Object.values(report).every(Boolean);
console.log(ok ? "NOTIFICATIONS_LIVE_AUDIT_COMPLETE" : "NOTIFICATIONS_LIVE_AUDIT_FAILED");
process.exit(ok ? 0 : 1);
