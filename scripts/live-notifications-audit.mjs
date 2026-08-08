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
  anonRpcDenied: false,
  anonTableDenied: false,
  studentTableDenied: false,
  recipientIsolation: false,
  trustedCreation: false,
  emitterDenied: false,
  introductionReceived: false,
  introductionAccepted: false,
  introductionDedupe: false,
  messageAB: false,
  messageBA: false,
  messageIdempotency: false,
  oneSidedMutual: false,
  mutualWithdrawal: false,
  mutualCompletion: false,
  mutualDedupe: false,
  oneSidedIdentity: false,
  identityWithdrawal: false,
  identityCompletion: false,
  identityDedupe: false,
  oneSidedContact: false,
  contactWithdrawal: false,
  telegramCompletion: false,
  instagramCompletion: false,
  linkedinCompletion: false,
  crossChannelIsolation: false,
  contactDedupe: false,
  markOne: false,
  markOneIdempotent: false,
  markAll: false,
  crossUserMarkDenied: false,
  unreadAccurate: false,
  blockStopsFuture: false,
  blockedHistorySafe: false,
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
    p_policy_version: "2026-07-30",
    p_terms_accepted: true,
    p_privacy_accepted: true,
    p_community_guidelines_accepted: true,
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
  const allowedKeys = new Set([
    "notification_public_id",
    "notification_type",
    "target_path",
    "channel",
    "created_at",
    "read_at",
  ]);
  assert.equal(
    rows.every((row) =>
      Object.keys(row).every((key) => allowedKeys.has(key)),
    ),
    true,
  );
}

function rowsOfType(rows, type, channel = undefined) {
  return rows.filter(
    (row) =>
      row.notification_type === type &&
      (channel === undefined || row.channel === channel),
  );
}

function notificationSnapshot(rows) {
  return JSON.stringify(
    rows.map((row) => ({
      publicId: row.notification_public_id,
      type: row.notification_type,
      target: row.target_path,
      channel: row.channel,
      readAt: row.read_at,
    })),
  );
}

async function internalCount(recipientId, type, channel = undefined) {
  let query = admin
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", recipientId)
    .eq("notification_type", type);
  if (channel !== undefined) {
    query = query.eq("metadata->>channel", channel);
  }
  const result = await query;
  if (result.error) throw new Error("internal count failed");
  return result.count ?? 0;
}

async function registerIdentity(owner, publicId) {
  const objectKey = `${owner.id.replaceAll("-", "")}/${randomBytes(16).toString("hex")}.jpg`;
  const result = await admin.rpc("register_identity_reveal_profile_version", {
    p_public_id: publicId,
    p_owner_user_id: owner.id,
    p_first_name: "Audit",
    p_photo_object_key: objectKey,
    p_photo_content_type: "image/jpeg",
    p_photo_byte_size: 1024,
    p_photo_width: 512,
    p_photo_height: 512,
  });
  if (result.error || !result.data) throw new Error("identity setup failed");
  return result.data;
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
    p_encryption_key_version: 1,
  });
  if (result.error || !result.data) throw new Error("contact setup failed");
  return result.data;
}

async function exerciseContactChannel(a, b, publicId, channel) {
  const beforeB = notificationSnapshot(await list(b.client));
  const beforeInternalB = await internalCount(
    b.id,
    "CONTACT_REVEAL_COMPLETED",
    channel,
  );
  const aVersion = await registerContact(
    a,
    publicId,
    channel,
    `audit_${channel}_a`,
  );
  assert.equal(notificationSnapshot(await list(b.client)), beforeB);
  assert.equal(
    await internalCount(b.id, "CONTACT_REVEAL_COMPLETED", channel),
    beforeInternalB,
  );

  const selectedA = await a.client.rpc("select_contact_reveal", {
    p_public_id: publicId,
    p_channel: channel,
    p_contact_version_id: aVersion,
  });
  if (selectedA.error) throw new Error("contact consent failed");
  assert.equal(notificationSnapshot(await list(b.client)), beforeB);
  assert.equal(
    await internalCount(b.id, "CONTACT_REVEAL_COMPLETED", channel),
    beforeInternalB,
  );
  const withdrawnA = await a.client.rpc("withdraw_contact_reveal", {
    p_public_id: publicId,
    p_channel: channel,
  });
  if (withdrawnA.error) throw new Error("contact withdrawal failed");
  assert.equal(notificationSnapshot(await list(b.client)), beforeB);
  assert.equal(
    await internalCount(b.id, "CONTACT_REVEAL_COMPLETED", channel),
    beforeInternalB,
  );
  const reselectedA = await a.client.rpc("select_contact_reveal", {
    p_public_id: publicId,
    p_channel: channel,
    p_contact_version_id: aVersion,
  });
  if (reselectedA.error) throw new Error("contact reconsent failed");
  assert.equal(notificationSnapshot(await list(b.client)), beforeB);

  const bVersion = await registerContact(
    b,
    publicId,
    channel,
    `audit_${channel}_b`,
  );
  const selectedB = await b.client.rpc("select_contact_reveal", {
    p_public_id: publicId,
    p_channel: channel,
    p_contact_version_id: bVersion,
  });
  if (selectedB.error) throw new Error("contact completion failed");

  const [aRows, bRows] = await Promise.all([list(a.client), list(b.client)]);
  const aCompleted = rowsOfType(
    aRows,
    "CONTACT_REVEAL_COMPLETED",
    channel,
  );
  const bCompleted = rowsOfType(
    bRows,
    "CONTACT_REVEAL_COMPLETED",
    channel,
  );
  assert.equal(aCompleted.length, 1);
  assert.equal(bCompleted.length, 1);
  assert.equal(aCompleted[0].target_path, `/app/messages/${publicId}`);
  assert.equal(bCompleted[0].target_path, `/app/messages/${publicId}`);

  const beforeRetryA = notificationSnapshot(aRows);
  const beforeRetryB = notificationSnapshot(bRows);
  const retry = await b.client.rpc("select_contact_reveal", {
    p_public_id: publicId,
    p_channel: channel,
    p_contact_version_id: bVersion,
  });
  assert.equal(retry.error, null);
  assert.equal(notificationSnapshot(await list(a.client)), beforeRetryA);
  assert.equal(notificationSnapshot(await list(b.client)), beforeRetryB);
}

try {
  const probe = await anon.rpc("count_my_unread_notifications");
  report.migrationAvailable = !/function .* does not exist/i.test(
    probe.error?.message ?? "",
  );
  report.anonRpcDenied = Boolean(probe.error);
  if (!report.migrationAvailable) throw new Error("migration unavailable");

  const deniedAnonOperations = await Promise.all([
    anon.from("user_notifications").select("public_id").limit(1),
    anon.from("user_notifications").insert({
      recipient_user_id: "00000000-0000-4000-8000-000000000001",
      notification_type: "MESSAGE_RECEIVED",
      target_path: "/app/introductions",
      dedupe_key: "anon-forged",
    }),
    anon
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("public_id", "00".repeat(16)),
    anon
      .from("user_notifications")
      .delete()
      .eq("public_id", "00".repeat(16)),
  ]);
  report.anonTableDenied = deniedAnonOperations.every(({ error }) =>
    Boolean(error),
  );

  const [a, b, c] = await Promise.all([
    createStudent("a"),
    createStudent("b"),
    createStudent("c"),
  ]);
  assert.equal((await list(a.client)).length, 0);
  assert.equal((await list(b.client)).length, 0);
  assert.equal((await list(c.client)).length, 0);
  assert.equal(await count(a.client), 0);
  assert.equal(await count(b.client), 0);
  assert.equal(await count(c.client), 0);

  const arbitrary = await a.client
    .from("user_notifications")
    .insert({
      recipient_user_id: b.id,
      notification_type: "MESSAGE_RECEIVED",
      target_path: "/app/introductions",
      dedupe_key: "forged",
    });
  report.trustedCreation = Boolean(arbitrary.error);
  const deniedStudentOperations = await Promise.all([
    a.client.from("user_notifications").select("public_id").limit(1),
    a.client
      .from("user_notifications")
      .update({
        read_at: new Date().toISOString(),
        notification_type: "IDENTITY_REVEAL_COMPLETED",
      })
      .eq("public_id", "00".repeat(16)),
    a.client
      .from("user_notifications")
      .delete()
      .eq("public_id", "00".repeat(16)),
  ]);
  report.studentTableDenied =
    report.trustedCreation &&
    deniedStudentOperations.every(({ error }) => Boolean(error));
  const emitterAttempt = await a.client.rpc("emit_user_notification", {
    p_recipient_user_id: b.id,
    p_notification_type: "MESSAGE_RECEIVED",
    p_target_path: "/app/introductions",
    p_metadata: {},
    p_dedupe_key: "student-forged",
  });
  report.emitterDenied = Boolean(emitterAttempt.error);

  const bUnreadBeforeIntro = await count(b.client);
  const intro = await a.client.rpc("send_introduction_request", {
    p_recipient_alias: b.alias,
    p_opening_message: "Halo, mau belajar bareng untuk audit kampus?",
  });
  if (intro.error) throw new Error("intro failed");
  const bIntroRows = await list(b.client);
  const received = rowsOfType(bIntroRows, "INTRODUCTION_RECEIVED");
  report.introductionReceived =
    received.length === 1 &&
    received[0].target_path === "/app/introductions" &&
    (await count(b.client)) === bUnreadBeforeIntro + 1 &&
    (await internalCount(b.id, "INTRODUCTION_RECEIVED")) === 1;
  report.recipientIsolation =
    rowsOfType(await list(a.client), "INTRODUCTION_RECEIVED").length === 0 &&
    rowsOfType(await list(c.client), "INTRODUCTION_RECEIVED").length === 0;

  const markTarget = received[0].notification_public_id;
  const crossMarkA = await a.client.rpc("mark_my_notification_read", {
    p_notification_public_id: markTarget,
  });
  const crossMarkC = await c.client.rpc("mark_my_notification_read", {
    p_notification_public_id: markTarget,
  });
  const anonMark = await anon.rpc("mark_my_notification_read", {
    p_notification_public_id: markTarget,
  });
  report.crossUserMarkDenied =
    crossMarkA.data === false &&
    crossMarkC.data === false &&
    Boolean(anonMark.error);
  const markOne = await b.client.rpc("mark_my_notification_read", {
    p_notification_public_id: markTarget,
  });
  const markedAt = (await list(b.client)).find(
    (row) => row.notification_public_id === markTarget,
  )?.read_at;
  report.markOne =
    markOne.data === true &&
    typeof markedAt === "string" &&
    (await count(b.client)) === bUnreadBeforeIntro;
  const markAgain = await b.client.rpc("mark_my_notification_read", {
    p_notification_public_id: markTarget,
  });
  report.markOneIdempotent =
    markAgain.data === true &&
    (await list(b.client)).find(
      (row) => row.notification_public_id === markTarget,
    )?.read_at === markedAt;

  const duplicateIntro = await a.client.rpc("send_introduction_request", {
    p_recipient_alias: b.alias,
    p_opening_message: "Percobaan duplikat yang harus ditolak aman.",
  });
  report.introductionDedupe =
    Boolean(duplicateIntro.error) &&
    (await internalCount(b.id, "INTRODUCTION_RECEIVED")) === 1;

  const accepted = await b.client.rpc("accept_introduction_request", {
    p_request_id: intro.data,
  });
  if (accepted.error) throw new Error("accept failed");
  const acceptedRowsA = rowsOfType(
    await list(a.client),
    "INTRODUCTION_ACCEPTED",
  );
  report.introductionAccepted =
    acceptedRowsA.length === 1 &&
    acceptedRowsA[0].target_path === "/app/introductions" &&
    (await internalCount(a.id, "INTRODUCTION_ACCEPTED")) === 1;
  const beforeAcceptRetry = notificationSnapshot(await list(a.client));
  await b.client.rpc("accept_introduction_request", {
    p_request_id: intro.data,
  });
  report.introductionDedupe =
    report.introductionDedupe &&
    notificationSnapshot(await list(a.client)) === beforeAcceptRetry;

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
  const bMessageRows = rowsOfType(await list(b.client), "MESSAGE_RECEIVED");
  report.messageAB =
    bMessageRows.length === 1 &&
    bMessageRows[0].target_path === `/app/messages/${publicId}`;
  const beforeMessageRetry = notificationSnapshot(await list(b.client));
  const retryMessage = await a.client.rpc("send_anonymous_message", {
    p_public_id: publicId,
    p_body: "Pesan audit pertama.",
    p_idempotency_key: "notifications-a-0001",
  });
  if (retryMessage.error) throw new Error("message retry failed");
  report.messageIdempotency =
    notificationSnapshot(await list(b.client)) === beforeMessageRetry &&
    (await internalCount(b.id, "MESSAGE_RECEIVED")) === 1;
  const sentB = await b.client.rpc("send_anonymous_message", {
    p_public_id: publicId,
    p_body: "Balasan audit pertama.",
    p_idempotency_key: "notifications-b-0001",
  });
  if (sentB.error) throw new Error("reply failed");
  const aMessageRows = rowsOfType(await list(a.client), "MESSAGE_RECEIVED");
  report.messageBA =
    aMessageRows.length === 1 &&
    aMessageRows[0].target_path === `/app/messages/${publicId}` &&
    rowsOfType(await list(c.client), "MESSAGE_RECEIVED").length === 0;

  const beforeMutualB = notificationSnapshot(await list(b.client));
  const beforeMutualInternalB = await internalCount(
    b.id,
    "MUTUAL_INTEREST_COMPLETED",
  );
  const selectedMutualA = await a.client.rpc("select_mutual_interest", {
    p_public_id: publicId,
  });
  if (selectedMutualA.error) throw new Error("mutual consent failed");
  report.oneSidedMutual =
    notificationSnapshot(await list(b.client)) === beforeMutualB &&
    (await internalCount(b.id, "MUTUAL_INTEREST_COMPLETED")) ===
      beforeMutualInternalB &&
    rowsOfType(await list(c.client), "MUTUAL_INTEREST_COMPLETED").length === 0;
  const withdrawnMutualA = await a.client.rpc("withdraw_mutual_interest", {
    p_public_id: publicId,
  });
  report.mutualWithdrawal =
    !withdrawnMutualA.error &&
    notificationSnapshot(await list(b.client)) === beforeMutualB &&
    (await internalCount(b.id, "MUTUAL_INTEREST_COMPLETED")) ===
      beforeMutualInternalB;
  const reselectedMutualA = await a.client.rpc("select_mutual_interest", {
    p_public_id: publicId,
  });
  if (reselectedMutualA.error) throw new Error("mutual reconsent failed");
  const selectedMutualB = await b.client.rpc("select_mutual_interest", {
    p_public_id: publicId,
  });
  if (selectedMutualB.error) throw new Error("mutual completion failed");
  report.mutualCompletion =
    rowsOfType(await list(a.client), "MUTUAL_INTEREST_COMPLETED").length ===
      1 &&
    rowsOfType(await list(b.client), "MUTUAL_INTEREST_COMPLETED").length ===
      1;
  const beforeMutualRetryA = notificationSnapshot(await list(a.client));
  const beforeMutualRetryB = notificationSnapshot(await list(b.client));
  await b.client.rpc("select_mutual_interest", { p_public_id: publicId });
  report.mutualDedupe =
    notificationSnapshot(await list(a.client)) === beforeMutualRetryA &&
    notificationSnapshot(await list(b.client)) === beforeMutualRetryB;

  const beforeIdentityB = notificationSnapshot(await list(b.client));
  const beforeIdentityInternalB = await internalCount(
    b.id,
    "IDENTITY_REVEAL_COMPLETED",
  );
  const aVersion = await registerIdentity(a, publicId);
  report.oneSidedIdentity =
    notificationSnapshot(await list(b.client)) === beforeIdentityB &&
    (await internalCount(b.id, "IDENTITY_REVEAL_COMPLETED")) ===
      beforeIdentityInternalB;
  const selectedIdentityA = await a.client.rpc("select_identity_reveal", {
    p_public_id: publicId,
    p_profile_version_id: aVersion,
  });
  if (selectedIdentityA.error) throw new Error("identity consent failed");
  report.oneSidedIdentity =
    report.oneSidedIdentity &&
    notificationSnapshot(await list(b.client)) === beforeIdentityB &&
    (await internalCount(b.id, "IDENTITY_REVEAL_COMPLETED")) ===
      beforeIdentityInternalB;
  const withdrawnIdentity = await a.client.rpc("withdraw_identity_reveal", {
    p_public_id: publicId,
  });
  report.identityWithdrawal =
    !withdrawnIdentity.error &&
    notificationSnapshot(await list(b.client)) === beforeIdentityB &&
    (await internalCount(b.id, "IDENTITY_REVEAL_COMPLETED")) ===
      beforeIdentityInternalB;
  const reselectedIdentityA = await a.client.rpc("select_identity_reveal", {
    p_public_id: publicId,
    p_profile_version_id: aVersion,
  });
  if (reselectedIdentityA.error) throw new Error("identity reconsent failed");
  const bVersion = await registerIdentity(b, publicId);
  assert.equal(notificationSnapshot(await list(a.client)), beforeMutualRetryA);
  const selectedIdentityB = await b.client.rpc("select_identity_reveal", {
    p_public_id: publicId,
    p_profile_version_id: bVersion,
  });
  if (selectedIdentityB.error) throw new Error("identity completion failed");
  report.identityCompletion =
    rowsOfType(await list(a.client), "IDENTITY_REVEAL_COMPLETED").length ===
      1 &&
    rowsOfType(await list(b.client), "IDENTITY_REVEAL_COMPLETED").length ===
      1;
  const beforeIdentityRetryA = notificationSnapshot(await list(a.client));
  const beforeIdentityRetryB = notificationSnapshot(await list(b.client));
  const identityRetry = await b.client.rpc("select_identity_reveal", {
    p_public_id: publicId,
    p_profile_version_id: bVersion,
  });
  if (identityRetry.error) throw new Error("identity retry failed");
  report.identityDedupe =
    notificationSnapshot(await list(a.client)) === beforeIdentityRetryA &&
    notificationSnapshot(await list(b.client)) === beforeIdentityRetryB;

  await exerciseContactChannel(a, b, publicId, "telegram");
  report.oneSidedContact = true;
  report.contactWithdrawal = true;
  report.telegramCompletion =
    rowsOfType(
      await list(b.client),
      "CONTACT_REVEAL_COMPLETED",
      "telegram",
    ).length === 1;
  report.crossChannelIsolation =
    rowsOfType(
      await list(b.client),
      "CONTACT_REVEAL_COMPLETED",
      "instagram",
    ).length === 0 &&
    rowsOfType(
      await list(b.client),
      "CONTACT_REVEAL_COMPLETED",
      "linkedin",
    ).length === 0;

  await exerciseContactChannel(a, b, publicId, "instagram");
  report.instagramCompletion =
    rowsOfType(
      await list(b.client),
      "CONTACT_REVEAL_COMPLETED",
      "instagram",
    ).length === 1;
  await exerciseContactChannel(a, b, publicId, "linkedin");
  report.linkedinCompletion =
    rowsOfType(
      await list(b.client),
      "CONTACT_REVEAL_COMPLETED",
      "linkedin",
    ).length === 1;
  report.contactDedupe = true;

  const [aRows, bRows, cRows] = await Promise.all([
    list(a.client),
    list(b.client),
    list(c.client),
  ]);
  await Promise.all([
    safeRowScan(aRows),
    safeRowScan(bRows),
    safeRowScan(cRows),
  ]);
  assert.equal(cRows.length, 0);
  report.safeProjection = true;

  const unreadA = aRows.filter((row) => row.read_at === null).length;
  const unreadB = bRows.filter((row) => row.read_at === null).length;
  report.unreadAccurate =
    (await count(a.client)) === unreadA &&
    (await count(b.client)) === unreadB &&
    (await count(c.client)) === 0;
  const aUnreadBeforeMarkAll = await count(a.client);
  const markedAllB = await b.client.rpc("mark_all_my_notifications_read");
  const markedAllBAgain = await b.client.rpc("mark_all_my_notifications_read");
  report.markAll =
    !markedAllB.error &&
    markedAllB.data === unreadB &&
    !markedAllBAgain.error &&
    markedAllBAgain.data === 0 &&
    (await count(b.client)) === 0 &&
    (await count(a.client)) === aUnreadBeforeMarkAll &&
    (await count(c.client)) === 0;

  const beforeBlock = await count(b.client);
  const blocked = await a.client.rpc("block_student_by_alias", {
    p_alias: b.alias,
  });
  if (blocked.error) throw new Error("block failed");
  const afterBlockMessage = await a.client.rpc("send_anonymous_message", {
    p_public_id: publicId,
    p_body: "Tidak boleh terkirim.",
    p_idempotency_key: "notifications-a-0002",
  });
  report.blockStopsFuture =
    Boolean(afterBlockMessage.error) && (await count(b.client)) === beforeBlock;
  const completedAfterBlock = await a.client.rpc(
    "get_completed_identity_reveal",
    { p_public_id: publicId },
  );
  const contactAfterBlock = await a.client.rpc("get_contact_reveal_state", {
    p_public_id: publicId,
  });
  const safeContactStateKeys = new Set([
    "channel",
    "eligible",
    "has_contact",
    "selected_by_me",
    "completed",
    "completed_at",
    "can_withdraw",
  ]);
  report.blockedHistorySafe =
    !completedAfterBlock.error &&
    completedAfterBlock.data?.[0]?.counterpart_first_name === null &&
    !contactAfterBlock.error &&
    (contactAfterBlock.data ?? []).every((row) =>
      Object.keys(row).every((key) => safeContactStateKeys.has(key)),
    );
} finally {
  let cleanupOk = true;
  for (const id of users) {
    const deleted = await admin.auth.admin.deleteUser(id);
    if (deleted.error) cleanupOk = false;
  }
  if (users.length > 0) {
    const remaining = await admin
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .in("user_id", users);
    cleanupOk =
      cleanupOk && !remaining.error && Number(remaining.count ?? 0) === 0;
  }
  report.cleanup = cleanupOk;
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

const ok = Object.values(report).every(Boolean);
console.log(ok ? "NOTIFICATIONS_LIVE_AUDIT_COMPLETE" : "NOTIFICATIONS_LIVE_AUDIT_FAILED");
process.exit(ok ? 0 : 1);
