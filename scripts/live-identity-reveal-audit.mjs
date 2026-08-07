/**
 * Live Identity Reveal A/B/C audit against linked Supabase.
 * Pattern after scripts/live-intro-audit.mjs.
 * Uses Admin createUser + generateLink/verifyOtp (no inbox).
 *
 * HARD RULES: never log emails, complete UUIDs, tokens, cookies,
 * Storage paths, signed URLs, first names, image bytes, or magic links.
 * Log only: id suffixes (last 8), public aliases, pass/fail booleans,
 * HTTP status codes, field NAMES, sanitized error categories.
 *
 *   node scripts/live-identity-reveal-audit.mjs
 */
import assert from "node:assert/strict";
import { randomBytes, randomInt } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const projectRoot = process.cwd();
const artifactDir = join(projectRoot, "audit-artifacts");
const reportPath = join(artifactDir, "identity-reveal-live-report.json");
const accountsPath = join(artifactDir, "identity-reveal-audit-accounts.json");

/** Linked project ref only — fail closed if .env.local points elsewhere. */
const EXPECTED_PROJECT_REF = "ctbqudtvrfezuoqcecyj";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BUCKET = "identity-reveal-photos";
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_DIM = 64;
const MAX_DIM = 4096;
const OUTPUT_MAX_EDGE = 1280;

mkdirSync(artifactDir, { recursive: true });

const uploadedKeys = [];

const results = {
  deploymentSanity: {},
  schemaObjects: {},
  eligibility: {},
  firstNameValidation: {},
  photoValidation: {},
  preparedPrivacy: {},
  replacement: {},
  oneSided: {},
  withdraw: {},
  completion: {},
  mediaResolve: {},
  storageIsolation: {},
  endBefore: {},
  blockBefore: {},
  endAfter: {},
  blockAfter: {},
  staffIsolation: {},
  sideChannel: {},
  cleanup: {},
  verificationDisabled: true,
};

function loadEnvLocal() {
  const env = {};
  for (const line of readFileSync(join(projectRoot, ".env.local"), "utf8").split(
    /\r?\n/,
  )) {
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    env[line.slice(0, index)] = line.slice(index + 1);
  }
  return env;
}

/**
 * Fail closed before any remote Supabase call if URL host/ref is not the
 * linked StudyDate project. Never continue on missing/mismatched ref.
 */
function assertLinkedProjectRef(env) {
  const raw = env?.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) {
    throw new Error(
      `REFUSING: NEXT_PUBLIC_SUPABASE_URL missing; expected ref ${EXPECTED_PROJECT_REF}`,
    );
  }
  let host = "";
  try {
    host = new URL(raw).hostname;
  } catch {
    throw new Error(
      `REFUSING: NEXT_PUBLIC_SUPABASE_URL invalid; expected ref ${EXPECTED_PROJECT_REF}`,
    );
  }
  const refFromHost = host.split(".")[0] ?? "";
  if (refFromHost !== EXPECTED_PROJECT_REF) {
    throw new Error(
      `REFUSING: Supabase project ref mismatch (want ${EXPECTED_PROJECT_REF}). Fail closed.`,
    );
  }
}

function adminBundle() {
  const env = loadEnvLocal();
  assertLinkedProjectRef(env);
  assert.ok(env.SUPABASE_SERVICE_ROLE_KEY);
  const publishable =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.ok(publishable);
  return {
    env,
    publishable,
    admin: createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

function suffix(id) {
  return String(id).slice(-8);
}

function log(label, detail = "") {
  console.log(detail ? `${label} ${detail}` : label);
}

function pass(section) {
  log(`PASS ${section}`);
}

function fail(section, detail = "") {
  log(`FAIL ${section}`, detail);
}

function errorCategory(error) {
  if (error?.code === "ERR_ASSERTION" || error?.name === "AssertionError") {
    const msg = String(error.message ?? "")
      .replace(/['"`]/g, "")
      .slice(0, 120);
    return `assert:${msg}`;
  }
  const message = String(error?.message ?? error ?? "").toLowerCase();
  if (!message) return "empty";
  if (message.includes("service role")) return "service_role_required";
  if (message.includes("authentication required")) return "auth_required";
  if (message.includes("invalid first name")) return "invalid_first_name";
  if (message.includes("invalid photo")) return "invalid_photo";
  if (message.includes("conversation closed")) return "conversation_closed";
  if (message.includes("identity reveal unavailable")) {
    return "identity_reveal_unavailable";
  }
  if (message.includes("conversation unavailable")) {
    return "conversation_unavailable";
  }
  if (message.includes("onboarding")) return "onboarding_required";
  if (message.includes("contact disclosure")) return "contact_blocked";
  if (message.includes("permission") || message.includes("rls")) {
    return "permission_denied";
  }
  if (message.includes("row-level security")) return "rls_denied";
  if (message.includes("jwt")) return "jwt_error";
  return "other";
}

function stateKeys(row) {
  if (!row || typeof row !== "object") return [];
  return Object.keys(row).sort();
}

function firstState(data) {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

function safeStateShape(row) {
  const keys = stateKeys(row);
  const sensitive = keys.filter((key) =>
    /first_name|email|photo|object_key|user_id|token|nim|legal/i.test(key),
  );
  return { keys, sensitiveLeak: sensitive.length > 0, sensitive };
}

/** Duplicate of identityRevealProfileSchema first-name rules (no TS import). */
function validateFirstNameLocal(raw) {
  const trimmed = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 40) return false;
  if (/(https?:\/\/|www\.|@|\+?\d{8,}|<[^>]+>)/i.test(trimmed)) return false;
  return /^[\p{L}\p{M}][\p{L}\p{M}'’\- ]*[\p{L}\p{M}]$/u.test(trimmed);
}

function randomHex(bytes) {
  return randomBytes(bytes).toString("hex");
}

/** Mirrors lib/identity-reveal/photo.ts without importing server-only. */
async function processRevealPhoto(input) {
  if (!input.length || input.byteLength > MAX_BYTES) {
    throw new Error("photo_rejected");
  }

  const image = sharp(input, {
    failOn: "error",
    animated: false,
    pages: 1,
  });
  const metadata = await image.metadata();

  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
    throw new Error("photo_rejected");
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new Error("photo_rejected");
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (
    width < MIN_DIM ||
    height < MIN_DIM ||
    width > MAX_DIM ||
    height > MAX_DIM
  ) {
    throw new Error("photo_rejected");
  }

  const buffer = await image
    .rotate()
    .resize({
      width: OUTPUT_MAX_EDGE,
      height: OUTPUT_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  const outputMeta = await sharp(buffer).metadata();
  const outWidth = outputMeta.width ?? 0;
  const outHeight = outputMeta.height ?? 0;

  if (outWidth < MIN_DIM || outHeight < MIN_DIM) {
    throw new Error("photo_rejected");
  }
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error("photo_rejected");
  }

  return {
    buffer,
    contentType: "image/jpeg",
    extension: "jpg",
    width: outWidth,
    height: outHeight,
    byteSize: buffer.byteLength,
    objectKey: `${randomHex(16)}/${randomHex(16)}.jpg`,
  };
}

async function makeRaster(format, size = 256) {
  const base = sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 70, g: 110, b: 150 },
    },
  });
  if (format === "png") return base.png().toBuffer();
  if (format === "webp") return base.webp().toBuffer();
  return base.jpeg().toBuffer();
}

async function ensureAccount(kind, accounts, admin) {
  if (accounts[kind]?.id) {
    const { data } = await admin.auth.admin.getUserById(accounts[kind].id);
    if (data?.user && !data.user.app_metadata?.role) {
      return accounts[kind];
    }
  }
  const stamp = `${Date.now()}.${randomInt(1000, 9999)}`;
  const email = `studydate.reveal.${kind}.${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {},
    app_metadata: {},
  });
  if (error || !data.user) throw new Error(`createUser ${kind} failed`);
  if (data.user.app_metadata?.role) {
    throw new Error(`Refusing privileged account for ${kind}`);
  }
  accounts[kind] = {
    id: data.user.id,
    email,
    suffix: suffix(data.user.id),
  };
  writeFileSync(accountsPath, JSON.stringify(accounts, null, 2));
  log("ACCOUNT_READY", `kind=${kind} suffix=${accounts[kind].suffix}`);
  return accounts[kind];
}

async function sessionFor(email) {
  const { env, admin, publishable } = adminBundle();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${env.NEXT_PUBLIC_SITE_URL || "http://localhost:3010"}/auth/callback?next=/app`,
    },
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error("generateLink failed");
  }
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const verified = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verified.error) throw new Error("verifyOtp failed");
  return client;
}

async function onboard(client, firstName) {
  const {
    data: { user },
  } = await client.auth.getUser();
  const { data: existing } = await client
    .from("profiles")
    .select("public_alias,onboarding_completed_at,is_discoverable")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing?.onboarding_completed_at) {
    return existing.public_alias;
  }
  const alias = `Partner #${randomInt(100000, 1000000)}`;
  const { error } = await client.rpc("complete_student_onboarding_v2", {
    p_public_alias: alias,
    p_first_name: firstName,
    p_nim_ciphertext: null,
    p_nim_iv: null,
    p_nim_auth_tag: null,
    p_nim_last_four: null,
    p_nim_fingerprint: null,
    p_campus: "Universitas Audit Reveal",
    p_study_program: "Informatika",
    p_degree_level: "sarjana",
    p_semester: 4,
    p_city_region: "Bandung",
    p_short_intro: "Profil sintetik untuk uji pembukaan identitas.",
    p_interests: ["technology", "design"],
    p_connection_goals: ["study", "friendship"],
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
  if (error) throw new Error(`onboarding failed: ${errorCategory(error)}`);
  return alias;
}

async function setDiscoverable(client, value) {
  const { error } = await client.rpc("set_people_discovery_visibility", {
    p_is_discoverable: value,
  });
  if (error) throw new Error(`visibility failed: ${errorCategory(error)}`);
}

async function aliasOf(client) {
  const {
    data: { user },
  } = await client.auth.getUser();
  const { data } = await client
    .from("profiles")
    .select("public_alias")
    .eq("user_id", user.id)
    .single();
  return data.public_alias;
}

async function openActiveMutualConversation(senderClient, recipientClient) {
  const recipientAlias = await aliasOf(recipientClient);
  const { data: requestId, error: sendError } = await senderClient.rpc(
    "send_introduction_request",
    {
      p_recipient_alias: recipientAlias,
      p_opening_message:
        "Halo, aku ingin berkenalan soal minat belajar bersama secara aman.",
    },
  );
  if (sendError) {
    throw new Error(`intro send failed: ${errorCategory(sendError)}`);
  }

  const { error: acceptError } = await recipientClient.rpc(
    "accept_introduction_request",
    { p_request_id: requestId },
  );
  if (acceptError) {
    throw new Error(`intro accept failed: ${errorCategory(acceptError)}`);
  }

  const { data: publicId, error: pidError } = await senderClient.rpc(
    "get_conversation_public_id_for_introduction",
    { p_request_id: requestId },
  );
  if (pidError || typeof publicId !== "string") {
    throw new Error("public id resolve failed");
  }
  assert.match(publicId, /^[0-9a-f]{32}$/);

  // Mutual interest requires at least one visible message from each participant.
  // First message also activates awaiting_chat -> active.
  const { error: msgSender } = await senderClient.rpc("send_anonymous_message", {
    p_public_id: publicId,
    p_body: "Pesan pertama dari pengirim untuk mengaktifkan percakapan audit.",
  });
  if (msgSender) {
    throw new Error(`sender message failed: ${errorCategory(msgSender)}`);
  }

  const { error: msgRecipient } = await recipientClient.rpc(
    "send_anonymous_message",
    {
      p_public_id: publicId,
      p_body: "Pesan balasan dari penerima agar mutual interest tersedia.",
    },
  );
  if (msgRecipient) {
    throw new Error(`recipient message failed: ${errorCategory(msgRecipient)}`);
  }

  const { error: mutualSender } = await senderClient.rpc(
    "select_mutual_interest",
    { p_public_id: publicId },
  );
  if (mutualSender) {
    throw new Error(`mutual sender failed: ${errorCategory(mutualSender)}`);
  }

  const { error: mutualRecipient } = await recipientClient.rpc(
    "select_mutual_interest",
    { p_public_id: publicId },
  );
  if (mutualRecipient) {
    throw new Error(
      `mutual recipient failed: ${errorCategory(mutualRecipient)}`,
    );
  }

  return { publicId };
}

async function uploadAndRegister(admin, {
  publicId,
  ownerUserId,
  firstName,
  photoBytes,
}) {
  const processed = await processRevealPhoto(photoBytes);
  uploadedKeys.push(processed.objectKey);

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(processed.objectKey, processed.buffer, {
      contentType: processed.contentType,
      upsert: false,
      cacheControl: "private, max-age=0",
    });

  if (uploadError) {
    return {
      versionId: null,
      error: uploadError,
      uploaded: false,
      objectKeyTracked: true,
    };
  }

  const { data: versionId, error: registerError } = await admin.rpc(
    "register_identity_reveal_profile_version",
    {
      p_public_id: publicId,
      p_owner_user_id: ownerUserId,
      p_first_name: firstName,
      p_photo_object_key: processed.objectKey,
      p_photo_content_type: processed.contentType,
      p_photo_byte_size: processed.byteSize,
      p_photo_width: processed.width,
      p_photo_height: processed.height,
    },
  );

  if (registerError || !versionId) {
    await admin.storage
      .from(BUCKET)
      .remove([processed.objectKey])
      .catch(() => undefined);
    return {
      versionId: null,
      error: registerError ?? new Error("register returned empty"),
      uploaded: true,
      objectKeyTracked: true,
    };
  }

  return {
    versionId: String(versionId),
    error: null,
    uploaded: true,
    objectKeyTracked: true,
  };
}

async function getRevealState(client, publicId) {
  const { data, error } = await client.rpc("get_identity_reveal_state", {
    p_public_id: publicId,
  });
  return { row: firstState(data), error, raw: data };
}

async function getCompleted(client, publicId) {
  const { data, error } = await client.rpc("get_completed_identity_reveal", {
    p_public_id: publicId,
  });
  return { row: firstState(data), error };
}

async function shellMeta(admin, publicId) {
  const { data, error } = await admin
    .from("conversation_shells")
    .select("id,status,identity_revealed_at")
    .eq("public_id", publicId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/**
 * Cleanup safety (fail closed):
 * - ONLY deletes rows for explicitly allowlisted synthetic user IDs from
 *   identity-reveal-audit-accounts.json (written by ensureAccount in this script).
 * - Must NOT delete by date range alone.
 * - Must NOT empty the whole identity-reveal-photos bucket.
 * - Must NOT touch staff_members or migrations.
 * - Storage removes are limited to keys in `uploadedKeys` and/or owned by
 *   allowlisted users only (never list+wipe the bucket).
 */
async function deleteSyntheticRows(admin, allowlistedIds) {
  const ids = [...new Set((allowlistedIds ?? []).filter(Boolean))];
  if (ids.length === 0) {
    throw new Error(
      "REFUSING cleanup: empty allowlist — only delete ensureAccount synthetic IDs",
    );
  }
  for (const id of ids) {
    if (!UUID_RE.test(id)) {
      throw new Error("REFUSING cleanup: allowlist entry is not a UUID");
    }
  }

  const idList = ids.join(",");

  const { data: ownedVersions } = await admin
    .from("identity_reveal_profile_versions")
    .select("photo_object_key,conversation_id")
    .in("owner_user_id", ids);
  const keysFromDb = (ownedVersions ?? [])
    .map((row) => row.photo_object_key)
    .filter(Boolean);

  const { data: shells } = await admin
    .from("conversation_shells")
    .select("id,introduction_request_id")
    .or(
      `participant_sender_id.in.(${idList}),participant_recipient_id.in.(${idList})`,
    );
  const shellIds = (shells ?? []).map((row) => row.id);
  const introFromShells = (shells ?? [])
    .map((row) => row.introduction_request_id)
    .filter(Boolean);

  if (shellIds.length) {
    await admin
      .from("conversation_identity_reveals")
      .delete()
      .in("conversation_id", shellIds);
    await admin
      .from("conversation_identity_reveal_consents")
      .delete()
      .in("conversation_id", shellIds);
    await admin
      .from("identity_reveal_profile_versions")
      .delete()
      .in("conversation_id", shellIds);
    await admin
      .from("conversation_events")
      .delete()
      .in("conversation_id", shellIds);
    await admin
      .from("anonymous_messages")
      .delete()
      .in("conversation_id", shellIds);
    await admin
      .from("conversation_mutual_interests")
      .delete()
      .in("conversation_id", shellIds);
  }

  await admin
    .from("identity_reveal_profile_versions")
    .delete()
    .in("owner_user_id", ids);

  await admin.from("user_reports").delete().in("reporter_id", ids);
  await admin
    .from("user_blocks")
    .delete()
    .or(`blocker_id.in.(${idList}),blocked_id.in.(${idList})`);

  const { data: introRows } = await admin
    .from("introduction_requests")
    .select("id")
    .or(`sender_id.in.(${idList}),recipient_id.in.(${idList})`);
  const introIds = [
    ...new Set([
      ...(introRows ?? []).map((row) => row.id),
      ...introFromShells,
    ]),
  ];

  if (introIds.length) {
    await admin.from("introduction_events").delete().in("request_id", introIds);
    await admin
      .from("conversation_shells")
      .delete()
      .in("introduction_request_id", introIds);
    await admin.from("introduction_requests").delete().in("id", introIds);
  }

  if (shellIds.length) {
    await admin.from("conversation_shells").delete().in("id", shellIds);
  }

  // Never empty the bucket — only tracked uploads + keys owned by allowlist.
  const allKeys = [...new Set([...keysFromDb, ...uploadedKeys])];
  if (allKeys.length) {
    // Chunk removals; never log keys.
    for (let i = 0; i < allKeys.length; i += 50) {
      const chunk = allKeys.slice(i, i + 50);
      await admin.storage
        .from(BUCKET)
        .remove(chunk)
        .catch(() => undefined);
    }
  }

  return {
    shellsTouched: shellIds.length,
    introsRemoved: introIds.length,
    storageKeysRemoved: allKeys.length,
  };
}

async function prepareBoth(admin, publicId, ownerA, ownerB, nameA, nameB) {
  const photoA = await makeRaster("jpeg");
  const photoB = await makeRaster("jpeg");
  const regA = await uploadAndRegister(admin, {
    publicId,
    ownerUserId: ownerA,
    firstName: nameA,
    photoBytes: photoA,
  });
  const regB = await uploadAndRegister(admin, {
    publicId,
    ownerUserId: ownerB,
    firstName: nameB,
    photoBytes: photoB,
  });
  if (regA.error || !regA.versionId) {
    throw new Error(`prepare A failed: ${errorCategory(regA.error)}`);
  }
  if (regB.error || !regB.versionId) {
    throw new Error(`prepare B failed: ${errorCategory(regB.error)}`);
  }
  return { versionA: regA.versionId, versionB: regB.versionId };
}

async function main() {
  assert.notEqual(
    process.env.STUDENT_VERIFICATION_ENABLED,
    "true",
    "Student Verification must stay disabled for this audit",
  );
  const env = loadEnvLocal();
  assertLinkedProjectRef(env);
  results.verificationDisabled = env.STUDENT_VERIFICATION_ENABLED !== "true";
  assert.equal(
    results.verificationDisabled,
    true,
    "STUDENT_VERIFICATION_ENABLED must not be true in .env.local",
  );

  const { admin, publishable, env: envBundle } = adminBundle();
  let accounts = existsSync(accountsPath)
    ? JSON.parse(readFileSync(accountsPath, "utf8"))
    : {};

  const kinds = [
    "A",
    "B",
    "C",
    "E1",
    "E2",
    "B1",
    "B2",
    "R1",
    "R2",
    "K1",
    "K2",
    "X1",
    "X2",
  ];

  for (const kind of kinds) {
    accounts[kind] = await ensureAccount(kind, accounts, admin);
  }

  // Allowlist = only IDs written by ensureAccount into accountsPath.
  const ids = kinds.map((kind) => accounts[kind].id);
  const precleanStats = await deleteSyntheticRows(admin, ids);
  log(
    "PRECLEAN_OK",
    `shells=${precleanStats.shellsTouched} intros=${precleanStats.introsRemoved}`,
  );

  const sessions = {};
  const aliases = {};
  for (const kind of kinds) {
    const client = await sessionFor(accounts[kind].email);
    aliases[kind] = await onboard(client, `Audit${kind}`);
    await setDiscoverable(client, true);
    sessions[kind] = client;
    log("ONBOARDED", `kind=${kind} alias=${aliases[kind]}`);
  }

  const anonClient = createClient(
    envBundle.NEXT_PUBLIC_SUPABASE_URL,
    publishable,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // -------------------------------------------------------------------------
  // 1. deploymentSanity
  // -------------------------------------------------------------------------
  {
    const section = "deploymentSanity";
    try {
      results.deploymentSanity = {
        verificationDisabled: env.STUDENT_VERIFICATION_ENABLED !== "true",
        processEnvNotTrue:
          process.env.STUDENT_VERIFICATION_ENABLED !== "true",
      };
      assert.equal(results.deploymentSanity.verificationDisabled, true);
      assert.equal(results.deploymentSanity.processEnvNotTrue, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 2. schemaObjects
  // -------------------------------------------------------------------------
  {
    const section = "schemaObjects";
    try {
      const { error: adminSelectError, status: adminSelectStatus } =
        await admin
          .from("identity_reveal_profile_versions")
          .select("id")
          .limit(0);

      const bucket = await admin.storage.getBucket(BUCKET);

      const { error: authTableError, status: authTableStatus } =
        await sessions.A.from("identity_reveal_profile_versions")
          .select("id")
          .limit(1);

      const { error: authConsentError } = await sessions.A.from(
        "conversation_identity_reveal_consents",
      )
        .select("id")
        .limit(1);

      const { error: authRevealError } = await sessions.A.from(
        "conversation_identity_reveals",
      )
        .select("conversation_id")
        .limit(1);

      const authList = await sessions.A.storage.from(BUCKET).list("", {
        limit: 10,
      });
      const authDownload = await sessions.A.storage
        .from(BUCKET)
        .download("probe/not-a-real-object.jpg");
      const authUpload = await sessions.A.storage.from(BUCKET).upload(
        `probe/${randomBytes(8).toString("hex")}.jpg`,
        Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
        { contentType: "image/jpeg", upsert: false },
      );

      // Supabase Storage RLS often returns [] without error for denied list.
      // Treat non-enumerable empty list + failed download/upload as denial.
      const authStorageListDenied =
        Boolean(authList.error) ||
        (Array.isArray(authList.data) && authList.data.length === 0);
      const authStorageDownloadDenied = Boolean(authDownload.error);
      const authStorageUploadDenied = Boolean(authUpload.error);

      results.schemaObjects = {
        adminSelectOk: !adminSelectError,
        adminSelectStatus: adminSelectStatus ?? null,
        bucketExists: Boolean(bucket?.data),
        bucketPublicFalse: bucket?.data?.public === false,
        authSelectDenied: Boolean(authTableError),
        authSelectStatus: authTableStatus ?? null,
        authConsentDenied: Boolean(authConsentError),
        authRevealDenied: Boolean(authRevealError),
        authStorageListDenied,
        authStorageListEmpty:
          Array.isArray(authList.data) && authList.data.length === 0,
        authStorageDownloadDenied,
        authStorageUploadDenied,
        fieldNamesChecked: [
          "identity_reveal_profile_versions",
          "conversation_identity_reveal_consents",
          "conversation_identity_reveals",
          BUCKET,
        ],
      };

      assert.equal(results.schemaObjects.adminSelectOk, true);
      assert.equal(results.schemaObjects.bucketExists, true);
      assert.equal(results.schemaObjects.bucketPublicFalse, true);
      assert.equal(results.schemaObjects.authSelectDenied, true);
      assert.equal(results.schemaObjects.authConsentDenied, true);
      assert.equal(results.schemaObjects.authRevealDenied, true);
      assert.equal(results.schemaObjects.authStorageListDenied, true);
      assert.equal(results.schemaObjects.authStorageDownloadDenied, true);
      assert.equal(results.schemaObjects.authStorageUploadDenied, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Bootstrap main A/B mutual conversation
  // -------------------------------------------------------------------------
  const { publicId: publicAB } = await openActiveMutualConversation(
    sessions.A,
    sessions.B,
  );
  log("CONVERSATION_READY", "pair=A/B");

  // Cross-conversation partner for ownership / version reuse checks
  const { publicId: publicAX } = await openActiveMutualConversation(
    sessions.A,
    sessions.X1,
  );
  log("CONVERSATION_READY", "pair=A/X1");

  // -------------------------------------------------------------------------
  // 3. eligibility
  // -------------------------------------------------------------------------
  {
    const section = "eligibility";
    try {
      const stateA = await getRevealState(sessions.A, publicAB);
      const stateB = await getRevealState(sessions.B, publicAB);
      const stateC = await getRevealState(sessions.C, publicAB);

      const shapeA = safeStateShape(stateA.row);
      const shapeB = safeStateShape(stateB.row);
      const shapeC = safeStateShape(stateC.row);

      results.eligibility = {
        aEligible: stateA.row?.eligible === true,
        bEligible: stateB.row?.eligible === true,
        cEligible: stateC.row?.eligible === true,
        cEmptyOrFalse:
          !stateC.row ||
          stateC.row.eligible === false,
        aKeys: shapeA.keys,
        bKeys: shapeB.keys,
        cKeys: shapeC.keys,
        sensitiveLeak:
          shapeA.sensitiveLeak || shapeB.sensitiveLeak || shapeC.sensitiveLeak,
        aError: stateA.error ? errorCategory(stateA.error) : null,
        bError: stateB.error ? errorCategory(stateB.error) : null,
        cError: stateC.error ? errorCategory(stateC.error) : null,
      };

      assert.equal(results.eligibility.aEligible, true);
      assert.equal(results.eligibility.bEligible, true);
      assert.equal(results.eligibility.cEligible, false);
      assert.equal(results.eligibility.sensitiveLeak, false);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 4. firstNameValidation
  // -------------------------------------------------------------------------
  {
    const section = "firstNameValidation";
    try {
      const photo = await makeRaster("jpeg");
      const cases = [
        ["valid_alpha", "AuditAlpha", true],
        ["too_short", "A", false],
        ["too_long", "X".repeat(41), false],
        ["at_sign", "Audit@Beta", false],
        ["url", "https://evil.example", false],
        ["digits", "12345678", false],
        ["html", "<script>x</script>", false],
      ];

      const caseResults = {};
      for (const [name, firstName, expectOk] of cases) {
        const localOk = validateFirstNameLocal(firstName);
        const reg = await uploadAndRegister(admin, {
          publicId: publicAB,
          ownerUserId: accounts.A.id,
          firstName,
          photoBytes: photo,
        });
        const rpcOk = !reg.error && Boolean(reg.versionId);
        caseResults[name] = {
          localValidationOk: localOk,
          localMatchesExpectation: localOk === expectOk,
          rpcOk,
          rpcMatchesExpectation: rpcOk === expectOk,
          errorCategory: reg.error ? errorCategory(reg.error) : null,
        };
        assert.equal(caseResults[name].localMatchesExpectation, true);
        assert.equal(caseResults[name].rpcMatchesExpectation, true);
      }

      // Ensure a valid profile exists for later steps (last valid may have been overwritten)
      const ensure = await uploadAndRegister(admin, {
        publicId: publicAB,
        ownerUserId: accounts.A.id,
        firstName: "AuditAlpha",
        photoBytes: photo,
      });
      assert.ok(ensure.versionId);

      results.firstNameValidation = {
        cases: Object.fromEntries(
          Object.entries(caseResults).map(([k, v]) => [
            k,
            {
              localMatchesExpectation: v.localMatchesExpectation,
              rpcMatchesExpectation: v.rpcMatchesExpectation,
              errorCategory: v.errorCategory,
            },
          ]),
        ),
        allPassed: Object.values(caseResults).every(
          (row) => row.localMatchesExpectation && row.rpcMatchesExpectation,
        ),
      };
      assert.equal(results.firstNameValidation.allPassed, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 5. photoValidation
  // -------------------------------------------------------------------------
  {
    const section = "photoValidation";
    try {
      const accept = {};
      for (const format of ["jpeg", "png", "webp"]) {
        const bytes = await makeRaster(format);
        let processOk = false;
        try {
          await processRevealPhoto(bytes);
          processOk = true;
        } catch {
          processOk = false;
        }
        accept[format] = { processOk };
        assert.equal(processOk, true);
      }

      const reject = {};
      // SVG
      {
        const svg = Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128"/></svg>',
        );
        let processOk = true;
        try {
          await processRevealPhoto(svg);
        } catch {
          processOk = false;
        }
        reject.svg = { processOk };
        assert.equal(processOk, false);
      }
      // GIF
      {
        const gif = await sharp({
          create: {
            width: 128,
            height: 128,
            channels: 3,
            background: { r: 10, g: 20, b: 30 },
          },
        })
          .gif()
          .toBuffer();
        let processOk = true;
        try {
          await processRevealPhoto(gif);
        } catch {
          processOk = false;
        }
        reject.gif = { processOk };
        assert.equal(processOk, false);
      }
      // Spoof: tiny non-image with jpeg extension claim
      {
        const spoof = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00]);
        let processOk = true;
        try {
          await processRevealPhoto(spoof);
        } catch {
          processOk = false;
        }
        reject.spoof = { processOk };
        assert.equal(processOk, false);
      }
      // Oversized
      {
        const oversized = Buffer.alloc(MAX_BYTES + 1, 1);
        let processOk = true;
        try {
          await processRevealPhoto(oversized);
        } catch {
          processOk = false;
        }
        reject.oversized = { processOk };
        assert.equal(processOk, false);
      }

      // Failed register must not leave a profile for B (clean conversation check via A has_profile after bad name)
      const before = await getRevealState(sessions.B, publicAB);
      const badPhotoKeyAttempt = await (async () => {
        const good = await makeRaster("jpeg");
        const processed = await processRevealPhoto(good);
        uploadedKeys.push(processed.objectKey);
        await admin.storage.from(BUCKET).upload(processed.objectKey, processed.buffer, {
          contentType: "image/jpeg",
          upsert: false,
        });
        const { error } = await admin.rpc(
          "register_identity_reveal_profile_version",
          {
            p_public_id: publicAB,
            p_owner_user_id: accounts.B.id,
            p_first_name: "Bad@Name",
            p_photo_object_key: processed.objectKey,
            p_photo_content_type: "image/jpeg",
            p_photo_byte_size: processed.byteSize,
            p_photo_width: processed.width,
            p_photo_height: processed.height,
          },
        );
        if (error) {
          await admin.storage
            .from(BUCKET)
            .remove([processed.objectKey])
            .catch(() => undefined);
        }
        return { failed: Boolean(error), category: errorCategory(error) };
      })();

      const after = await getRevealState(sessions.B, publicAB);
      const { count: bOwnerCount } = await admin
        .from("identity_reveal_profile_versions")
        .select("*", { count: "exact", head: true })
        .eq("owner_user_id", accounts.B.id);

      results.photoValidation = {
        accept,
        reject,
        badRegisterFailed: badPhotoKeyAttempt.failed,
        badRegisterCategory: badPhotoKeyAttempt.category,
        bHasProfileUnchanged:
          Boolean(before.row?.has_profile) ===
          Boolean(after.row?.has_profile),
        bOwnerProfileCount: bOwnerCount ?? 0,
        failedRegisterLeftNoProfile: (bOwnerCount ?? 0) === 0,
      };

      assert.equal(results.photoValidation.badRegisterFailed, true);
      assert.equal(results.photoValidation.failedRegisterLeftNoProfile, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 6. preparedPrivacy
  // -------------------------------------------------------------------------
  let versionA = null;
  {
    const section = "preparedPrivacy";
    try {
      const photo = await makeRaster("jpeg");
      const reg = await uploadAndRegister(admin, {
        publicId: publicAB,
        ownerUserId: accounts.A.id,
        firstName: "AuditAlpha",
        photoBytes: photo,
      });
      assert.ok(reg.versionId);
      versionA = reg.versionId;

      const { data: previewA, error: previewAError } = await sessions.A.rpc(
        "get_identity_reveal_profile_preview",
        { p_public_id: publicAB },
      );
      const previewRow = firstState(previewA);
      const { data: previewB, error: previewBError } = await sessions.B.rpc(
        "get_identity_reveal_profile_preview",
        { p_public_id: publicAB },
      );
      const { data: previewC, error: previewCError } = await sessions.C.rpc(
        "get_identity_reveal_profile_preview",
        { p_public_id: publicAB },
      );

      const stateB = await getRevealState(sessions.B, publicAB);
      const stateBaselineKeys = safeStateShape(stateB.row);

      results.preparedPrivacy = {
        aPreviewOk: !previewAError && Boolean(previewRow?.profile_version_id),
        aPreviewHasPhotoReady: previewRow?.photo_ready === true,
        aPreviewFieldNames: previewRow ? Object.keys(previewRow).sort() : [],
        bPreviewEmpty:
          Boolean(previewBError) ||
          !firstState(previewB)?.profile_version_id,
        cPreviewEmpty:
          Boolean(previewCError) ||
          !firstState(previewC)?.profile_version_id,
        bEligible: stateB.row?.eligible === true,
        bHasProfile: stateB.row?.has_profile === true,
        bSelectedByMe: stateB.row?.selected_by_me === true,
        bIndistinguishable:
          stateB.row?.has_profile === false &&
          stateB.row?.selected_by_me === false &&
          stateB.row?.completed === false,
        bStateKeys: stateBaselineKeys.keys,
      };

      assert.equal(results.preparedPrivacy.aPreviewOk, true);
      assert.equal(results.preparedPrivacy.bPreviewEmpty, true);
      assert.equal(results.preparedPrivacy.cPreviewEmpty, true);
      assert.equal(results.preparedPrivacy.bIndistinguishable, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 7. replacement
  // -------------------------------------------------------------------------
  let versionA2 = null;
  let versionAX = null;
  {
    const section = "replacement";
    try {
      const { error: consentError } = await sessions.A.rpc(
        "select_identity_reveal",
        {
          p_public_id: publicAB,
          p_profile_version_id: versionA,
        },
      );
      assert.ifError(consentError);

      const stateAfterConsent = await getRevealState(sessions.A, publicAB);
      assert.equal(stateAfterConsent.row?.selected_by_me, true);

      const photo2 = await makeRaster("jpeg");
      const reg2 = await uploadAndRegister(admin, {
        publicId: publicAB,
        ownerUserId: accounts.A.id,
        firstName: "AuditAlpha",
        photoBytes: photo2,
      });
      assert.ok(reg2.versionId);
      versionA2 = reg2.versionId;

      const stateAfterReplace = await getRevealState(sessions.A, publicAB);
      const stateB = await getRevealState(sessions.B, publicAB);

      // Cross-conversation version for A on A/X1
      const photoX = await makeRaster("jpeg");
      const regX = await uploadAndRegister(admin, {
        publicId: publicAX,
        ownerUserId: accounts.A.id,
        firstName: "AuditAlpha",
        photoBytes: photoX,
      });
      assert.ok(regX.versionId);
      versionAX = regX.versionId;

      const { error: wrongConvError } = await sessions.A.rpc(
        "select_identity_reveal",
        {
          p_public_id: publicAB,
          p_profile_version_id: versionAX,
        },
      );

      const { error: ownershipError } = await sessions.B.rpc(
        "select_identity_reveal",
        {
          p_public_id: publicAB,
          p_profile_version_id: versionA2,
        },
      );

      results.replacement = {
        selectedClearedAfterReplace:
          stateAfterReplace.row?.selected_by_me === false,
        hasProfileAfterReplace: stateAfterReplace.row?.has_profile === true,
        bUnchanged:
          stateB.row?.has_profile === false &&
          stateB.row?.selected_by_me === false,
        wrongConversationRejected: Boolean(wrongConvError),
        wrongConversationCategory: errorCategory(wrongConvError),
        ownershipRejected: Boolean(ownershipError),
        ownershipCategory: errorCategory(ownershipError),
      };

      assert.equal(results.replacement.selectedClearedAfterReplace, true);
      assert.equal(results.replacement.bUnchanged, true);
      assert.equal(results.replacement.wrongConversationRejected, true);
      assert.equal(results.replacement.ownershipRejected, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 8. oneSided
  // -------------------------------------------------------------------------
  {
    const section = "oneSided";
    try {
      const { error: selectError } = await sessions.A.rpc(
        "select_identity_reveal",
        {
          p_public_id: publicAB,
          p_profile_version_id: versionA2,
        },
      );
      assert.ifError(selectError);

      const stateA = await getRevealState(sessions.A, publicAB);
      const stateB = await getRevealState(sessions.B, publicAB);
      const shapeB = safeStateShape(stateB.row);

      results.oneSided = {
        aSelected: stateA.row?.selected_by_me === true,
        bSelected: stateB.row?.selected_by_me === true,
        bCompleted: stateB.row?.completed === true,
        bHasProfile: stateB.row?.has_profile === true,
        bKeys: shapeB.keys,
        noCounterpartFields: !shapeB.keys.some((key) =>
          /counterpart|other|them|peer/i.test(key),
        ),
        sameShapeAsEligibleBaseline:
          stateB.row?.eligible === true &&
          stateB.row?.has_profile === false &&
          stateB.row?.selected_by_me === false &&
          stateB.row?.completed === false,
      };

      assert.equal(results.oneSided.aSelected, true);
      assert.equal(results.oneSided.sameShapeAsEligibleBaseline, true);
      assert.equal(results.oneSided.noCounterpartFields, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 9. withdraw
  // -------------------------------------------------------------------------
  let versionB = null;
  {
    const section = "withdraw";
    try {
      const { error: withdrawError } = await sessions.A.rpc(
        "withdraw_identity_reveal",
        { p_public_id: publicAB },
      );
      assert.ifError(withdrawError);

      const { error: withdrawAgain } = await sessions.A.rpc(
        "withdraw_identity_reveal",
        { p_public_id: publicAB },
      );

      const stateA = await getRevealState(sessions.A, publicAB);
      const stateB = await getRevealState(sessions.B, publicAB);
      const meta = await shellMeta(admin, publicAB);

      results.withdraw = {
        withdrawn: stateA.row?.selected_by_me === false,
        canWithdrawFalse: stateA.row?.can_withdraw === false,
        idempotentOk: !withdrawAgain,
        identityRevealedAtNull: meta?.identity_revealed_at == null,
        bNoSignal:
          stateB.row?.selected_by_me === false &&
          stateB.row?.has_profile === false &&
          stateB.row?.completed === false,
      };

      assert.equal(results.withdraw.withdrawn, true);
      assert.equal(results.withdraw.idempotentOk, true);
      assert.equal(results.withdraw.identityRevealedAtNull, true);
      assert.equal(results.withdraw.bNoSignal, true);

      // Re-prepare both for completion path
      const photoA = await makeRaster("jpeg");
      const photoB = await makeRaster("jpeg");
      const regA = await uploadAndRegister(admin, {
        publicId: publicAB,
        ownerUserId: accounts.A.id,
        firstName: "AuditAlpha",
        photoBytes: photoA,
      });
      const regB = await uploadAndRegister(admin, {
        publicId: publicAB,
        ownerUserId: accounts.B.id,
        firstName: "AuditBeta",
        photoBytes: photoB,
      });
      assert.ok(regA.versionId);
      assert.ok(regB.versionId);
      versionA2 = regA.versionId;
      versionB = regB.versionId;

      results.withdraw.reprepareOk = true;
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 10. completion
  // -------------------------------------------------------------------------
  {
    const section = "completion";
    try {
      const { error: selectA } = await sessions.A.rpc("select_identity_reveal", {
        p_public_id: publicAB,
        p_profile_version_id: versionA2,
      });
      assert.ifError(selectA);

      const { error: selectB } = await sessions.B.rpc("select_identity_reveal", {
        p_public_id: publicAB,
        p_profile_version_id: versionB,
      });
      assert.ifError(selectB);

      const meta = await shellMeta(admin, publicAB);
      const { count: snapshotCount } = await admin
        .from("conversation_identity_reveals")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", meta.id);
      const { count: eventCount } = await admin
        .from("conversation_events")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", meta.id)
        .eq("event_type", "identity_revealed");

      const completedA = await getCompleted(sessions.A, publicAB);
      const completedB = await getCompleted(sessions.B, publicAB);
      const completedC = await getCompleted(sessions.C, publicAB);

      const { error: dupSelect } = await sessions.A.rpc(
        "select_identity_reveal",
        {
          p_public_id: publicAB,
          p_profile_version_id: versionA2,
        },
      );
      const { count: eventCountAfter } = await admin
        .from("conversation_events")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", meta.id)
        .eq("event_type", "identity_revealed");

      results.completion = {
        snapshotCount: snapshotCount ?? 0,
        identityRevealedEventCount: eventCount ?? 0,
        identityRevealedAtSet: Boolean(meta?.identity_revealed_at),
        aCompleted: completedA.row?.completed === true,
        bCompleted: completedB.row?.completed === true,
        cCompleted: completedC.row?.completed === true,
        aMinePresent: completedA.row?.mine_first_name != null,
        aCounterpartPresent: completedA.row?.counterpart_first_name != null,
        bMinePresent: completedB.row?.mine_first_name != null,
        bCounterpartPresent: completedB.row?.counterpart_first_name != null,
        duplicateSelectNoError: !dupSelect,
        noSecondEvent: (eventCountAfter ?? 0) === (eventCount ?? 0),
        completedFieldNames: completedA.row
          ? Object.keys(completedA.row).sort()
          : [],
      };

      assert.equal(results.completion.snapshotCount, 1);
      assert.equal(results.completion.identityRevealedEventCount, 1);
      assert.equal(results.completion.identityRevealedAtSet, true);
      assert.equal(results.completion.aCompleted, true);
      assert.equal(results.completion.bCompleted, true);
      assert.equal(results.completion.cCompleted, false);
      assert.equal(results.completion.aMinePresent, true);
      assert.equal(results.completion.aCounterpartPresent, true);
      assert.equal(results.completion.noSecondEvent, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 11. mediaResolve
  // -------------------------------------------------------------------------
  {
    const section = "mediaResolve";
    try {
      const { data: resolveAMine, error: errAMine } = await admin.rpc(
        "resolve_identity_reveal_photo_key",
        {
          p_public_id: publicAB,
          p_viewer_user_id: accounts.A.id,
          p_which: "mine",
        },
      );
      const { data: resolveAOther, error: errAOther } = await admin.rpc(
        "resolve_identity_reveal_photo_key",
        {
          p_public_id: publicAB,
          p_viewer_user_id: accounts.A.id,
          p_which: "counterpart",
        },
      );
      const { data: resolveBMine, error: errBMine } = await admin.rpc(
        "resolve_identity_reveal_photo_key",
        {
          p_public_id: publicAB,
          p_viewer_user_id: accounts.B.id,
          p_which: "mine",
        },
      );
      const { data: resolveC, error: errC } = await admin.rpc(
        "resolve_identity_reveal_photo_key",
        {
          p_public_id: publicAB,
          p_viewer_user_id: accounts.C.id,
          p_which: "mine",
        },
      );

      const { error: authResolveError } = await sessions.A.rpc(
        "resolve_identity_reveal_photo_key",
        {
          p_public_id: publicAB,
          p_viewer_user_id: accounts.A.id,
          p_which: "mine",
        },
      );

      const rowHasKey = (data) => Boolean(firstState(data)?.photo_object_key);

      results.mediaResolve = {
        aMineOk: !errAMine && rowHasKey(resolveAMine),
        aCounterpartOk: !errAOther && rowHasKey(resolveAOther),
        bMineOk: !errBMine && rowHasKey(resolveBMine),
        cNull: !errC && !rowHasKey(resolveC),
        authResolveFailed: Boolean(authResolveError),
        authResolveCategory: errorCategory(authResolveError),
      };

      assert.equal(results.mediaResolve.aMineOk, true);
      assert.equal(results.mediaResolve.aCounterpartOk, true);
      assert.equal(results.mediaResolve.bMineOk, true);
      assert.equal(results.mediaResolve.cNull, true);
      assert.equal(results.mediaResolve.authResolveFailed, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 12. storageIsolation
  // -------------------------------------------------------------------------
  {
    const section = "storageIsolation";
    try {
      const probeBytes = await makeRaster("jpeg");
      const probeKey = `${randomHex(16)}/${randomHex(16)}.jpg`;

      const anonList = await anonClient.storage.from(BUCKET).list("", {
        limit: 1,
      });
      const authList = await sessions.A.storage.from(BUCKET).list("", {
        limit: 1,
      });
      const anonUpload = await anonClient.storage
        .from(BUCKET)
        .upload(probeKey, probeBytes, { contentType: "image/jpeg" });
      const authUpload = await sessions.A.storage
        .from(BUCKET)
        .upload(probeKey, probeBytes, { contentType: "image/jpeg" });
      const anonDownload = await anonClient.storage
        .from(BUCKET)
        .download(probeKey);
      const authDownload = await sessions.A.storage
        .from(BUCKET)
        .download(probeKey);

      results.storageIsolation = {
        anonListDenied:
          Boolean(anonList.error) ||
          (Array.isArray(anonList.data) && anonList.data.length === 0),
        authListDenied:
          Boolean(authList.error) ||
          (Array.isArray(authList.data) && authList.data.length === 0),
        anonListEmpty:
          Array.isArray(anonList.data) && anonList.data.length === 0,
        authListEmpty:
          Array.isArray(authList.data) && authList.data.length === 0,
        anonUploadDenied: Boolean(anonUpload.error),
        authUploadDenied: Boolean(authUpload.error),
        anonDownloadDenied: Boolean(anonDownload.error),
        authDownloadDenied: Boolean(authDownload.error),
      };

      assert.equal(results.storageIsolation.anonListDenied, true);
      assert.equal(results.storageIsolation.authListDenied, true);
      assert.equal(results.storageIsolation.anonListEmpty, true);
      assert.equal(results.storageIsolation.authListEmpty, true);
      assert.equal(results.storageIsolation.anonUploadDenied, true);
      assert.equal(results.storageIsolation.authUploadDenied, true);
      assert.equal(results.storageIsolation.anonDownloadDenied, true);
      assert.equal(results.storageIsolation.authDownloadDenied, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 13. endBefore (E1/E2)
  // -------------------------------------------------------------------------
  {
    const section = "endBefore";
    try {
      const { publicId } = await openActiveMutualConversation(
        sessions.E1,
        sessions.E2,
      );
      const prepared = await prepareBoth(
        admin,
        publicId,
        accounts.E1.id,
        accounts.E2.id,
        "AuditAlpha",
        "AuditBeta",
      );

      const { error: endError } = await sessions.E1.rpc("end_conversation", {
        p_public_id: publicId,
      });
      assert.ifError(endError);

      const { error: selectError } = await sessions.E1.rpc(
        "select_identity_reveal",
        {
          p_public_id: publicId,
          p_profile_version_id: prepared.versionA,
        },
      );
      const meta = await shellMeta(admin, publicId);
      const { count: snapshots } = await admin
        .from("conversation_identity_reveals")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", meta.id);

      results.endBefore = {
        selectFailed: Boolean(selectError),
        selectCategory: errorCategory(selectError),
        snapshotCount: snapshots ?? 0,
        shellStatus: meta?.status ?? null,
      };

      assert.equal(results.endBefore.selectFailed, true);
      assert.equal(results.endBefore.snapshotCount, 0);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 14. blockBefore (B1/B2)
  // -------------------------------------------------------------------------
  {
    const section = "blockBefore";
    try {
      const { publicId } = await openActiveMutualConversation(
        sessions.B1,
        sessions.B2,
      );
      const prepared = await prepareBoth(
        admin,
        publicId,
        accounts.B1.id,
        accounts.B2.id,
        "AuditAlpha",
        "AuditBeta",
      );

      const { error: blockError } = await sessions.B1.rpc(
        "block_student_by_alias",
        { p_alias: aliases.B2 },
      );
      assert.ifError(blockError);

      const { error: selectError } = await sessions.B1.rpc(
        "select_identity_reveal",
        {
          p_public_id: publicId,
          p_profile_version_id: prepared.versionA,
        },
      );
      const meta = await shellMeta(admin, publicId);

      results.blockBefore = {
        selectFailed: Boolean(selectError),
        selectCategory: errorCategory(selectError),
        shellStatus: meta?.status ?? null,
      };

      assert.equal(results.blockBefore.selectFailed, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 15. endAfter (R1/R2)
  // -------------------------------------------------------------------------
  {
    const section = "endAfter";
    try {
      const { publicId } = await openActiveMutualConversation(
        sessions.R1,
        sessions.R2,
      );
      const prepared = await prepareBoth(
        admin,
        publicId,
        accounts.R1.id,
        accounts.R2.id,
        "AuditAlpha",
        "AuditBeta",
      );
      assert.ifError(
        (
          await sessions.R1.rpc("select_identity_reveal", {
            p_public_id: publicId,
            p_profile_version_id: prepared.versionA,
          })
        ).error,
      );
      assert.ifError(
        (
          await sessions.R2.rpc("select_identity_reveal", {
            p_public_id: publicId,
            p_profile_version_id: prepared.versionB,
          })
        ).error,
      );

      const { error: endError } = await sessions.R1.rpc("end_conversation", {
        p_public_id: publicId,
      });
      assert.ifError(endError);

      const completedR1 = await getCompleted(sessions.R1, publicId);
      const completedR2 = await getCompleted(sessions.R2, publicId);

      const { data: resolveOther } = await admin.rpc(
        "resolve_identity_reveal_photo_key",
        {
          p_public_id: publicId,
          p_viewer_user_id: accounts.R1.id,
          p_which: "counterpart",
        },
      );

      const photo = await makeRaster("jpeg");
      const regFail = await uploadAndRegister(admin, {
        publicId,
        ownerUserId: accounts.R1.id,
        firstName: "AuditAlpha",
        photoBytes: photo,
      });

      results.endAfter = {
        r1CounterpartPresent:
          completedR1.row?.counterpart_first_name != null,
        r2CounterpartPresent:
          completedR2.row?.counterpart_first_name != null,
        mediaCounterpartOk: Boolean(firstState(resolveOther)?.photo_object_key),
        registerFailed: Boolean(regFail.error),
        registerCategory: errorCategory(regFail.error),
      };

      assert.equal(results.endAfter.r1CounterpartPresent, true);
      assert.equal(results.endAfter.r2CounterpartPresent, true);
      assert.equal(results.endAfter.mediaCounterpartOk, true);
      assert.equal(results.endAfter.registerFailed, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 16. blockAfter (K1/K2)
  // -------------------------------------------------------------------------
  {
    const section = "blockAfter";
    try {
      const { publicId } = await openActiveMutualConversation(
        sessions.K1,
        sessions.K2,
      );
      const prepared = await prepareBoth(
        admin,
        publicId,
        accounts.K1.id,
        accounts.K2.id,
        "AuditAlpha",
        "AuditBeta",
      );
      assert.ifError(
        (
          await sessions.K1.rpc("select_identity_reveal", {
            p_public_id: publicId,
            p_profile_version_id: prepared.versionA,
          })
        ).error,
      );
      assert.ifError(
        (
          await sessions.K2.rpc("select_identity_reveal", {
            p_public_id: publicId,
            p_profile_version_id: prepared.versionB,
          })
        ).error,
      );

      const { error: blockError } = await sessions.K1.rpc(
        "block_student_by_alias",
        { p_alias: aliases.K2 },
      );
      assert.ifError(blockError);

      const completedK1 = await getCompleted(sessions.K1, publicId);
      const { data: resolveOther } = await admin.rpc(
        "resolve_identity_reveal_photo_key",
        {
          p_public_id: publicId,
          p_viewer_user_id: accounts.K1.id,
          p_which: "counterpart",
        },
      );
      const { data: resolveMine } = await admin.rpc(
        "resolve_identity_reveal_photo_key",
        {
          p_public_id: publicId,
          p_viewer_user_id: accounts.K1.id,
          p_which: "mine",
        },
      );
      const meta = await shellMeta(admin, publicId);
      const { count: snapshots } = await admin
        .from("conversation_identity_reveals")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", meta.id);

      results.blockAfter = {
        counterpartNameNull:
          completedK1.row?.counterpart_first_name == null,
        completedStillTrue: completedK1.row?.completed === true,
        mineNamePresent: completedK1.row?.mine_first_name != null,
        resolveCounterpartNull: !firstState(resolveOther)?.photo_object_key,
        resolveMineOk: Boolean(firstState(resolveMine)?.photo_object_key),
        snapshotStillExists: (snapshots ?? 0) === 1,
      };

      assert.equal(results.blockAfter.counterpartNameNull, true);
      assert.equal(results.blockAfter.resolveCounterpartNull, true);
      assert.equal(results.blockAfter.resolveMineOk, true);
      assert.equal(results.blockAfter.snapshotStillExists, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 17. staffIsolation
  // -------------------------------------------------------------------------
  {
    const section = "staffIsolation";
    try {
      const photo = await makeRaster("jpeg");
      const processed = await processRevealPhoto(photo);
      uploadedKeys.push(processed.objectKey);
      await admin.storage.from(BUCKET).upload(processed.objectKey, processed.buffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

      const { error: authRegisterError } = await sessions.A.rpc(
        "register_identity_reveal_profile_version",
        {
          p_public_id: publicAB,
          p_owner_user_id: accounts.A.id,
          p_first_name: "AuditAlpha",
          p_photo_object_key: processed.objectKey,
          p_photo_content_type: "image/jpeg",
          p_photo_byte_size: processed.byteSize,
          p_photo_width: processed.width,
          p_photo_height: processed.height,
        },
      );

      await admin.storage
        .from(BUCKET)
        .remove([processed.objectKey])
        .catch(() => undefined);

      const completedC = await getCompleted(sessions.C, publicAB);
      const stateC = await getRevealState(sessions.C, publicAB);

      results.staffIsolation = {
        authCannotRegister: Boolean(authRegisterError),
        authRegisterCategory: errorCategory(authRegisterError),
        cCannotCompleteForAB: completedC.row?.completed !== true,
        cStateNotEligible: stateC.row?.eligible !== true,
        note: "Temp staff skipped; service_role-only register + outsider isolation asserted",
      };

      assert.equal(results.staffIsolation.authCannotRegister, true);
      assert.equal(results.staffIsolation.cCannotCompleteForAB, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 18. sideChannel (fresh A/X2 conversation)
  // -------------------------------------------------------------------------
  {
    const section = "sideChannel";
    try {
      const { publicId } = await openActiveMutualConversation(
        sessions.A,
        sessions.X2,
      );

      const snap = async () => {
        const { row } = await getRevealState(sessions.X2, publicId);
        return JSON.stringify(row);
      };

      const baseline = await snap();

      const photo = await makeRaster("jpeg");
      const reg1 = await uploadAndRegister(admin, {
        publicId,
        ownerUserId: accounts.A.id,
        firstName: "AuditAlpha",
        photoBytes: photo,
      });
      assert.ok(reg1.versionId);
      const afterPrepare = await snap();

      assert.ifError(
        (
          await sessions.A.rpc("select_identity_reveal", {
            p_public_id: publicId,
            p_profile_version_id: reg1.versionId,
          })
        ).error,
      );
      const afterConsent = await snap();

      assert.ifError(
        (
          await sessions.A.rpc("withdraw_identity_reveal", {
            p_public_id: publicId,
          })
        ).error,
      );
      const afterWithdraw = await snap();

      const reg2 = await uploadAndRegister(admin, {
        publicId,
        ownerUserId: accounts.A.id,
        firstName: "AuditAlpha",
        photoBytes: photo,
      });
      assert.ok(reg2.versionId);
      const afterReplace = await snap();

      const equalHidden =
        baseline === afterPrepare &&
        afterPrepare === afterConsent &&
        afterConsent === afterWithdraw &&
        afterWithdraw === afterReplace;

      results.sideChannel = {
        baselineEqualsPrepared: baseline === afterPrepare,
        baselineEqualsConsented: baseline === afterConsent,
        baselineEqualsWithdrawn: baseline === afterWithdraw,
        baselineEqualsReplaced: baseline === afterReplace,
        allHiddenStagesEqual: equalHidden,
      };

      assert.equal(results.sideChannel.allHiddenStagesEqual, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 19. cleanup
  // -------------------------------------------------------------------------
  {
    const section = "cleanup";
    try {
      const stats = await deleteSyntheticRows(admin, ids);
      results.cleanup = {
        shellsTouched: stats.shellsTouched,
        introsRemoved: stats.introsRemoved,
        storageKeysRemoved: stats.storageKeysRemoved,
        accountsRetained: kinds.map((kind) => ({
          kind,
          suffix: accounts[kind].suffix,
          alias: aliases[kind],
        })),
        note: "Synthetic Auth users retained in audit-artifacts/identity-reveal-audit-accounts.json; no secrets in report.",
      };
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  for (const kind of kinds) {
    await sessions[kind].auth.signOut().catch(() => undefined);
  }

  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  log("REPORT_WRITTEN", "audit-artifacts/identity-reveal-live-report.json");
  log("IDENTITY_REVEAL_LIVE_AUDIT_COMPLETE");
}

main().catch((error) => {
  console.error("IDENTITY_REVEAL_LIVE_AUDIT_FAILED", errorCategory(error));
  try {
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          failed: true,
          messageCategory: errorCategory(error),
          results,
        },
        null,
        2,
      ),
    );
  } catch {
    // ignore write failures on crash path
  }
  process.exitCode = 1;
});
