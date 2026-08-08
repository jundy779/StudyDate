/**
 * Live Contact Reveal A/B/C audit against linked Supabase.
 * Pattern after scripts/live-identity-reveal-audit.mjs (helpers duplicated, not imported).
 * Uses Admin createUser + generateLink/verifyOtp (no inbox).
 *
 * HARD RULES: never log emails, complete UUIDs, tokens, cookies,
 * plaintext contact values, ciphertext hex, IVs, auth tags, keys,
 * legal names, NIM, or magic links.
 * Log only: id suffixes (last 8), public aliases, pass/fail booleans,
 * HTTP-ish status via error categories, field NAMES, sanitized error categories.
 *
 *   node scripts/live-contact-reveal-audit.mjs
 */
import assert from "node:assert/strict";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomInt,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const projectRoot = process.cwd();
const artifactDir = join(projectRoot, "audit-artifacts");
const reportPath = join(artifactDir, "contact-reveal-live-report.json");
const accountsPath = join(artifactDir, "contact-reveal-audit-accounts.json");

/** Linked project ref only — fail closed if .env.local points elsewhere. */
const EXPECTED_PROJECT_REF = "ctbqudtvrfezuoqcecyj";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BUCKET = "identity-reveal-photos";
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_DIM = 64;
const MAX_DIM = 4096;
const OUTPUT_MAX_EDGE = 1280;
const CONTACT_KEY_ENV = "CONTACT_REVEAL_ENCRYPTION_KEY";
const CONTACT_KEY_VERSION = 1;
const SAFE_STATE_KEYS = new Set([
  "channel",
  "eligible",
  "has_contact",
  "selected_by_me",
  "completed",
  "completed_at",
  "can_withdraw",
]);

mkdirSync(artifactDir, { recursive: true });

const uploadedKeys = [];
let failureCleanup = null;

const results = {
  deploymentSanity: {},
  schemaObjects: {},
  encryption: {},
  eligibility: {},
  telegramValidation: {},
  instagramValidation: {},
  linkedinValidation: {},
  preparedPrivacy: {},
  replacement: {},
  oneSided: {},
  withdraw: {},
  telegramCompletion: {},
  crossChannel: {},
  linkSecurity: {},
  endBefore: {},
  blockBefore: {},
  endAfter: {},
  blockAfter: {},
  staffIsolation: {},
  encryptionAtRest: {},
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
  if (message.includes("contact cryptography is unavailable")) {
    return "crypto_unavailable";
  }
  if (message.includes("invalid contact")) return "invalid_contact";
  if (message.includes("invalid channel")) return "invalid_channel";
  if (message.includes("conversation closed")) return "conversation_closed";
  if (message.includes("contact reveal unavailable")) {
    return "contact_reveal_unavailable";
  }
  if (message.includes("identity reveal unavailable")) {
    return "identity_reveal_unavailable";
  }
  if (message.includes("conversation unavailable")) {
    return "conversation_unavailable";
  }
  if (message.includes("onboarding")) return "onboarding_required";
  if (message.includes("permission") || message.includes("rls")) {
    return "permission_denied";
  }
  if (message.includes("row-level security")) return "rls_denied";
  if (message.includes("jwt")) return "jwt_error";
  if (message.includes("column") && message.includes("does not exist")) {
    return "column_missing";
  }
  return "other";
}

function firstState(data) {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

function randomHex(bytes) {
  return randomBytes(bytes).toString("hex");
}

function decodeContactKey(value) {
  if (!value) return null;
  if (/^[a-f0-9]{64}$/i.test(value)) {
    return Buffer.from(value, "hex");
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const decoded = Buffer.from(value, "base64");
  const canonical = decoded.toString("base64").replace(/=+$/, "");
  if (canonical !== value.replace(/=+$/, "")) return null;
  return decoded;
}

function isContactRevealKeyConfigured(envValue) {
  const decoded = decodeContactKey(envValue);
  return decoded?.length === 32;
}

function readContactKey(envOverride) {
  const value =
    envOverride !== undefined
      ? envOverride
      : loadEnvLocal()[CONTACT_KEY_ENV];
  if (!value) {
    throw new Error("Contact cryptography is unavailable.");
  }
  const decoded = decodeContactKey(value);
  if (!decoded || decoded.length !== 32) {
    throw new Error("Contact cryptography is unavailable.");
  }
  return decoded;
}

function bytea(value) {
  return `\\x${value.toString("hex")}`;
}

function fromBytea(value) {
  if (typeof value === "string") {
    if (value.startsWith("\\x")) return Buffer.from(value.slice(2), "hex");
    if (/^[a-f0-9]+$/i.test(value)) return Buffer.from(value, "hex");
  }
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new Error("Contact cryptography is unavailable.");
}

function encryptContactWithKey(plaintext, keyBuf) {
  if (!keyBuf || keyBuf.length !== 32) {
    throw new Error("Contact cryptography is unavailable.");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBuf, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: bytea(ciphertext),
    iv: bytea(iv),
    authTag: bytea(cipher.getAuthTag()),
    keyVersion: CONTACT_KEY_VERSION,
  };
}

function encryptContact(plaintext) {
  return encryptContactWithKey(plaintext, readContactKey());
}

function decryptContact(value, keyBuf) {
  const key = keyBuf ?? readContactKey();
  const decipher = createDecipheriv("aes-256-gcm", key, fromBytea(value.iv));
  decipher.setAuthTag(fromBytea(value.authTag));
  return Buffer.concat([
    decipher.update(fromBytea(value.ciphertext)),
    decipher.final(),
  ]).toString("utf8");
}

function cipherFieldPresent(value) {
  if (value == null) return false;
  if (typeof value === "string") {
    const hex = value.startsWith("\\x") ? value.slice(2) : value;
    return hex.length > 0;
  }
  if (value instanceof Uint8Array) return value.length > 0;
  return Boolean(value);
}

function formatContactHref(channel, stored) {
  if (channel === "telegram") {
    return `https://t.me/${String(stored).replace(/^@/, "")}`;
  }
  if (channel === "instagram") {
    return `https://instagram.com/${String(stored).replace(/^@/, "")}`;
  }
  return stored;
}

function normalizeTelegramLocal(raw) {
  const trimmed = String(raw ?? "").trim().replace(/^@+/, "");
  if (trimmed.length < 5 || trimmed.length > 32) throw new Error("invalid");
  if (!/^[A-Za-z0-9_]+$/.test(trimmed)) throw new Error("invalid");
  return trimmed;
}

function normalizeInstagramLocal(raw) {
  const trimmed = String(raw ?? "").trim().replace(/^@+/, "");
  if (trimmed.length < 1 || trimmed.length > 30) throw new Error("invalid");
  if (!/^[A-Za-z0-9._]+$/.test(trimmed)) throw new Error("invalid");
  if (trimmed.includes("..")) throw new Error("invalid");
  return trimmed;
}

function normalizeLinkedInLocal(raw) {
  const trimmed = String(raw ?? "").trim();
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("invalid");
  }
  if (url.protocol !== "https:") throw new Error("invalid");
  const host = url.hostname.toLowerCase();
  if (host !== "www.linkedin.com" && host !== "linkedin.com") {
    throw new Error("invalid");
  }
  const match = url.pathname.match(
    /^\/in\/([A-Za-z0-9][A-Za-z0-9_-]{0,99})\/?$/,
  );
  if (!match) throw new Error("invalid");
  return `https://www.linkedin.com/in/${match[1]}`;
}

function tryNormalize(fn, label) {
  try {
    fn();
    return { label, accepted: true };
  } catch {
    return { label, accepted: false };
  }
}

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
  if ((metadata.pages ?? 1) > 1) throw new Error("photo_rejected");
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
  if (buffer.byteLength > MAX_BYTES) throw new Error("photo_rejected");
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
  const email = `studydate.contact.${kind}.${stamp}@example.com`;
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
    p_last_name: "Sintetik",
    p_nim_ciphertext: null,
    p_nim_iv: null,
    p_nim_auth_tag: null,
    p_nim_last_four: null,
    p_nim_fingerprint: null,
    p_campus: "Universitas Audit Contact",
    p_study_program: "Informatika",
    p_degree_level: "sarjana",
    p_semester: 4,
    p_city_region: "Bandung",
    p_short_intro: "Profil sintetik untuk uji pembukaan kontak.",
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
  if (value) {
    const { error: socialError } = await client.rpc(
      "upsert_my_student_social_contacts",
      {
        p_linkedin_url: "https://www.linkedin.com/in/studydate-audit",
        p_instagram_username: null,
      },
    );
    if (socialError) {
      throw new Error(`social setup failed: ${errorCategory(socialError)}`);
    }
  }
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

async function uploadAndRegisterIdentity(admin, {
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
    return { versionId: null, error: uploadError };
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
    };
  }
  return { versionId: String(versionId), error: null };
}

async function completeIdentityReveal(
  admin,
  clientA,
  clientB,
  publicId,
  ownerA,
  ownerB,
) {
  const photoA = await makeRaster("jpeg");
  const photoB = await makeRaster("jpeg");
  const regA = await uploadAndRegisterIdentity(admin, {
    publicId,
    ownerUserId: ownerA,
    firstName: "AuditAlpha",
    photoBytes: photoA,
  });
  const regB = await uploadAndRegisterIdentity(admin, {
    publicId,
    ownerUserId: ownerB,
    firstName: "AuditBeta",
    photoBytes: photoB,
  });
  if (regA.error || !regA.versionId) {
    throw new Error(`IR prepare A failed: ${errorCategory(regA.error)}`);
  }
  if (regB.error || !regB.versionId) {
    throw new Error(`IR prepare B failed: ${errorCategory(regB.error)}`);
  }
  const { error: selA } = await clientA.rpc("select_identity_reveal", {
    p_public_id: publicId,
    p_profile_version_id: regA.versionId,
  });
  if (selA) throw new Error(`IR select A failed: ${errorCategory(selA)}`);
  const { error: selB } = await clientB.rpc("select_identity_reveal", {
    p_public_id: publicId,
    p_profile_version_id: regB.versionId,
  });
  if (selB) throw new Error(`IR select B failed: ${errorCategory(selB)}`);
  return { versionA: regA.versionId, versionB: regB.versionId };
}

async function registerContact(admin, { publicId, ownerUserId, channel, value }) {
  const encrypted = encryptContact(value);
  const { data: versionId, error } = await admin.rpc(
    "register_contact_reveal_version",
    {
      p_public_id: publicId,
      p_owner_user_id: ownerUserId,
      p_channel: channel,
      p_contact_ciphertext: encrypted.ciphertext,
      p_contact_iv: encrypted.iv,
      p_contact_auth_tag: encrypted.authTag,
      p_encryption_key_version: encrypted.keyVersion,
    },
  );
  return {
    versionId: versionId ? String(versionId) : null,
    error,
  };
}

async function getContactState(client, publicId) {
  const { data, error } = await client.rpc("get_contact_reveal_state", {
    p_public_id: publicId,
  });
  const rows = Array.isArray(data) ? data : [];
  return { rows, error };
}

function channelRow(state, channel) {
  const rows = Array.isArray(state?.rows) ? state.rows : state;
  if (!Array.isArray(rows)) return null;
  return rows.find((row) => row?.channel === channel) ?? null;
}

function safeStateKeys(rows) {
  const allKeys = new Set();
  let sensitiveLeak = false;
  const sensitive = [];
  for (const row of rows ?? []) {
    if (!row || typeof row !== "object") continue;
    for (const key of Object.keys(row)) {
      allKeys.add(key);
      if (!SAFE_STATE_KEYS.has(key)) {
        sensitiveLeak = true;
        sensitive.push(key);
      }
      if (
        /counterpart|ciphertext|auth_tag|contact_iv|email|token|nim|legal|user_id/i.test(
          key,
        )
      ) {
        sensitiveLeak = true;
        sensitive.push(key);
      }
      const val = row[key];
      if (
        typeof val === "string" &&
        UUID_RE.test(val) &&
        key !== "channel"
      ) {
        // completed_at is timestamp; channel is enum — flag uuid-looking extras
        if (!["completed_at"].includes(key)) {
          sensitiveLeak = true;
          sensitive.push(`uuidish:${key}`);
        }
      }
    }
  }
  return {
    keys: [...allKeys].sort(),
    sensitiveLeak,
    sensitive: [...new Set(sensitive)].sort(),
  };
}

function channelSnapshot(rows) {
  return JSON.stringify(
    (rows ?? [])
      .map((row) => ({
        channel: row.channel,
        eligible: row.eligible,
        has_contact: row.has_contact,
        selected_by_me: row.selected_by_me,
        completed: row.completed,
        completed_at: row.completed_at,
        can_withdraw: row.can_withdraw,
      }))
      .sort((a, b) => String(a.channel).localeCompare(String(b.channel))),
  );
}

async function selectContact(client, publicId, channel, versionId) {
  const { data, error } = await client.rpc("select_contact_reveal", {
    p_public_id: publicId,
    p_channel: channel,
    p_contact_version_id: versionId,
  });
  return { rows: Array.isArray(data) ? data : [], error };
}

async function withdrawContact(client, publicId, channel) {
  const { data, error } = await client.rpc("withdraw_contact_reveal", {
    p_public_id: publicId,
    p_channel: channel,
  });
  return { rows: Array.isArray(data) ? data : [], error };
}

async function getCompletedCipher(admin, publicId, viewerId, channel) {
  const { data, error } = await admin.rpc(
    "get_completed_contact_reveal_cipher",
    {
      p_public_id: publicId,
      p_viewer_user_id: viewerId,
      p_channel: channel,
    },
  );
  const row = firstState(data);
  if (!row) {
    return {
      error,
      completed: false,
      minePresent: false,
      counterpartPresent: false,
      row: null,
    };
  }
  return {
    error,
    completed: row.completed === true,
    minePresent: cipherFieldPresent(row.mine_ciphertext),
    counterpartPresent: cipherFieldPresent(row.counterpart_ciphertext),
    completedAtPresent: row.completed_at != null,
    fieldNames: Object.keys(row).sort(),
    row,
  };
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

async function completeContactChannel(
  admin,
  clientA,
  clientB,
  publicId,
  ownerA,
  ownerB,
  channel,
  valueA,
  valueB,
) {
  const regA = await registerContact(admin, {
    publicId,
    ownerUserId: ownerA,
    channel,
    value: valueA,
  });
  const regB = await registerContact(admin, {
    publicId,
    ownerUserId: ownerB,
    channel,
    value: valueB,
  });
  if (regA.error || !regA.versionId) {
    throw new Error(`register A ${channel}: ${errorCategory(regA.error)}`);
  }
  if (regB.error || !regB.versionId) {
    throw new Error(`register B ${channel}: ${errorCategory(regB.error)}`);
  }
  const selA = await selectContact(clientA, publicId, channel, regA.versionId);
  if (selA.error) {
    throw new Error(`select A ${channel}: ${errorCategory(selA.error)}`);
  }
  const selB = await selectContact(clientB, publicId, channel, regB.versionId);
  if (selB.error) {
    throw new Error(`select B ${channel}: ${errorCategory(selB.error)}`);
  }
  return { versionA: regA.versionId, versionB: regB.versionId };
}

/**
 * Cleanup safety (fail closed):
 * - ONLY deletes rows for explicitly allowlisted synthetic user IDs.
 * - Contact tables deleted BEFORE identity-reveal cleanup order.
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
      .from("conversation_contact_reveals")
      .delete()
      .in("conversation_id", shellIds);
    await admin
      .from("conversation_contact_reveal_consents")
      .delete()
      .in("conversation_id", shellIds);
    await admin
      .from("conversation_contact_versions")
      .delete()
      .in("conversation_id", shellIds);

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
    .from("conversation_contact_versions")
    .delete()
    .in("owner_user_id", ids);
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

  const allKeys = [...new Set([...keysFromDb, ...uploadedKeys])];
  if (allKeys.length) {
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

  const { admin } = adminBundle();
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
    "Y1",
    "Y2",
  ];

  for (const kind of kinds) {
    accounts[kind] = await ensureAccount(kind, accounts, admin);
  }

  const ids = kinds.map((kind) => accounts[kind].id);
  failureCleanup = async () => {
    await deleteSyntheticRows(admin, ids);
    for (const id of ids) {
      await admin.auth.admin.deleteUser(id);
    }
    rmSync(accountsPath, { force: true });
  };
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

  // -------------------------------------------------------------------------
  // Bootstrap: A/B mutual + Identity Reveal completed
  // -------------------------------------------------------------------------
  const { publicId: publicAB } = await openActiveMutualConversation(
    sessions.A,
    sessions.B,
  );
  await completeIdentityReveal(
    admin,
    sessions.A,
    sessions.B,
    publicAB,
    accounts.A.id,
    accounts.B.id,
  );
  log("IR_COMPLETE", "pair=A/B");

  const { publicId: publicAX } = await openActiveMutualConversation(
    sessions.A,
    sessions.X1,
  );
  await completeIdentityReveal(
    admin,
    sessions.A,
    sessions.X1,
    publicAX,
    accounts.A.id,
    accounts.X1.id,
  );
  log("IR_COMPLETE", "pair=A/X1");

  // Known synthetic handles (never written into report values)
  const HANDLE = {
    tgA: "AuditTgUserA",
    tgB: "AuditTgUserB",
    tgA2: "AuditTgUserA2",
    igA: "audit.ig.a",
    igB: "audit.ig.b",
    liA: "https://www.linkedin.com/in/audit-contact-a",
    liB: "https://www.linkedin.com/in/audit-contact-b",
  };

  {
    const section = "deploymentSanity";
    try {
      const keyConfigured = isContactRevealKeyConfigured(
        env[CONTACT_KEY_ENV],
      );
      results.deploymentSanity = {
        verificationDisabled: env.STUDENT_VERIFICATION_ENABLED !== "true",
        processEnvNotTrue:
          process.env.STUDENT_VERIFICATION_ENABLED !== "true",
        contactKeyConfigured: keyConfigured,
        projectRefOk: true,
      };
      assert.equal(results.deploymentSanity.verificationDisabled, true);
      assert.equal(results.deploymentSanity.processEnvNotTrue, true);
      assert.equal(results.deploymentSanity.contactKeyConfigured, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "schemaObjects";
    try {
      const { error: adminVersionsError, count: adminVersionsCount } =
        await admin
          .from("conversation_contact_versions")
          .select("*", { count: "exact", head: true });

      const { error: authVersionsError } = await sessions.A.from(
        "conversation_contact_versions",
      )
        .select("id")
        .limit(1);
      const { error: authConsentsError } = await sessions.A.from(
        "conversation_contact_reveal_consents",
      )
        .select("conversation_id")
        .limit(1);
      const { error: authRevealsError } = await sessions.A.from(
        "conversation_contact_reveals",
      )
        .select("conversation_id")
        .limit(1);

      const stateProbe = await getContactState(sessions.A, publicAB);
      const shape = safeStateKeys(stateProbe.rows);

      const { error: missingColError } = await admin
        .from("conversation_shells")
        .select("all_contacts_revealed")
        .limit(1);

      const noGlobalColumn =
        Boolean(missingColError) ||
        errorCategory(missingColError) === "column_missing" ||
        /column|all_contacts/i.test(String(missingColError?.message ?? ""));

      // Confirm shell row keys never include global open-all
      const meta = await shellMeta(admin, publicAB);
      const { data: shellRow } = await admin
        .from("conversation_shells")
        .select("*")
        .eq("id", meta.id)
        .maybeSingle();
      const shellKeys = shellRow ? Object.keys(shellRow) : [];

      results.schemaObjects = {
        adminSelectOk: !adminVersionsError,
        adminCountAvailable: typeof adminVersionsCount === "number",
        authVersionsDenied: Boolean(authVersionsError),
        authConsentsDenied: Boolean(authConsentsError),
        authRevealsDenied: Boolean(authRevealsError),
        stateRpcOk: !stateProbe.error,
        stateSafeKeys: shape.keys,
        sensitiveLeak: shape.sensitiveLeak,
        noAllContactsRevealedColumn:
          noGlobalColumn && !shellKeys.includes("all_contacts_revealed"),
        fieldNamesChecked: [
          "conversation_contact_versions",
          "conversation_contact_reveal_consents",
          "conversation_contact_reveals",
          "get_contact_reveal_state",
        ],
      };

      assert.equal(results.schemaObjects.adminSelectOk, true);
      assert.equal(results.schemaObjects.authVersionsDenied, true);
      assert.equal(results.schemaObjects.authConsentsDenied, true);
      assert.equal(results.schemaObjects.authRevealsDenied, true);
      assert.equal(results.schemaObjects.stateRpcOk, true);
      assert.equal(results.schemaObjects.sensitiveLeak, false);
      assert.equal(results.schemaObjects.noAllContactsRevealedColumn, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "encryption";
    try {
      const sample = "AuditEncryptSample";
      const enc1 = encryptContact(sample);
      const enc2 = encryptContact(sample);
      const differentCiphertext = enc1.ciphertext !== enc2.ciphertext;
      const roundtripOk = decryptContact(enc1) === sample;

      let missingKeyThrew = false;
      let missingKeyCategory = null;
      try {
        encryptContactWithKey(sample, null);
      } catch (error) {
        missingKeyThrew = true;
        missingKeyCategory = errorCategory(error);
      }

      let wrongKeyFailed = false;
      try {
        decryptContact(enc1, randomBytes(32));
      } catch {
        wrongKeyFailed = true;
      }

      const { error: authRegisterError } = await sessions.A.rpc(
        "register_contact_reveal_version",
        {
          p_public_id: publicAB,
          p_owner_user_id: accounts.A.id,
          p_channel: "telegram",
          p_contact_ciphertext: enc1.ciphertext,
          p_contact_iv: enc1.iv,
          p_contact_auth_tag: enc1.authTag,
          p_encryption_key_version: 1,
        },
      );

      const { error: authCipherError } = await sessions.A.rpc(
        "get_completed_contact_reveal_cipher",
        {
          p_public_id: publicAB,
          p_viewer_user_id: accounts.A.id,
          p_channel: "telegram",
        },
      );

      const { error: invalidCipherError } = await admin.rpc(
        "register_contact_reveal_version",
        {
          p_public_id: publicAB,
          p_owner_user_id: accounts.A.id,
          p_channel: "telegram",
          p_contact_ciphertext: "\\x00",
          p_contact_iv: bytea(randomBytes(4)),
          p_contact_auth_tag: bytea(randomBytes(16)),
          p_encryption_key_version: 1,
        },
      );

      // Auth user attempting register with garbage also fails closed
      const { error: authInvalidError } = await sessions.A.rpc(
        "register_contact_reveal_version",
        {
          p_public_id: publicAB,
          p_owner_user_id: accounts.A.id,
          p_channel: "telegram",
          p_contact_ciphertext: "\\x00",
          p_contact_iv: bytea(randomBytes(12)),
          p_contact_auth_tag: bytea(randomBytes(16)),
          p_encryption_key_version: 1,
        },
      );

      results.encryption = {
        differentCiphertext,
        roundtripOk,
        missingKeyThrew,
        missingKeyCategory,
        wrongKeyFailed,
        authCannotRegister: Boolean(authRegisterError),
        authRegisterCategory: errorCategory(authRegisterError),
        authCannotGetCipher: Boolean(authCipherError),
        authCipherCategory: errorCategory(authCipherError),
        adminInvalidCipherRejected: Boolean(invalidCipherError),
        adminInvalidCategory: errorCategory(invalidCipherError),
        authInvalidRejected: Boolean(authInvalidError),
        authInvalidCategory: errorCategory(authInvalidError),
      };

      assert.equal(results.encryption.differentCiphertext, true);
      assert.equal(results.encryption.roundtripOk, true);
      assert.equal(results.encryption.missingKeyThrew, true);
      assert.equal(results.encryption.wrongKeyFailed, true);
      assert.equal(results.encryption.authCannotRegister, true);
      assert.equal(results.encryption.authCannotGetCipher, true);
      assert.equal(results.encryption.adminInvalidCipherRejected, true);
      assert.equal(results.encryption.authInvalidRejected, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "eligibility";
    try {
      const { publicId: publicY } = await openActiveMutualConversation(
        sessions.Y1,
        sessions.Y2,
      );
      const beforeY1 = await getContactState(sessions.Y1, publicY);
      const beforeY2 = await getContactState(sessions.Y2, publicY);
      const tgBefore = channelRow(beforeY1, "telegram");

      const stateA = await getContactState(sessions.A, publicAB);
      const stateB = await getContactState(sessions.B, publicAB);
      const stateC = await getContactState(sessions.C, publicAB);
      const shapeA = safeStateKeys(stateA.rows);
      const shapeB = safeStateKeys(stateB.rows);
      const shapeC = safeStateKeys(stateC.rows);

      const channels = ["telegram", "instagram", "linkedin"];
      const aEligibleAll = channels.every(
        (ch) => channelRow(stateA, ch)?.eligible === true,
      );
      const bEligibleAll = channels.every(
        (ch) => channelRow(stateB, ch)?.eligible === true,
      );
      const cEligibleAny = channels.some(
        (ch) => channelRow(stateC, ch)?.eligible === true,
      );
      const beforeIrEligible = channels.some(
        (ch) =>
          channelRow(beforeY1, ch)?.eligible === true ||
          channelRow(beforeY2, ch)?.eligible === true,
      );

      results.eligibility = {
        aEligibleAll,
        bEligibleAll,
        cEligibleFalse: !cEligibleAny,
        beforeIrEligibleFalse: !beforeIrEligible,
        beforeIrTelegramEligible: tgBefore?.eligible === true,
        aKeys: shapeA.keys,
        bKeys: shapeB.keys,
        cKeys: shapeC.keys,
        sensitiveLeak:
          shapeA.sensitiveLeak || shapeB.sensitiveLeak || shapeC.sensitiveLeak,
      };

      assert.equal(results.eligibility.aEligibleAll, true);
      assert.equal(results.eligibility.bEligibleAll, true);
      assert.equal(results.eligibility.cEligibleFalse, true);
      assert.equal(results.eligibility.beforeIrEligibleFalse, true);
      assert.equal(results.eligibility.sensitiveLeak, false);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // 5–7. local validation matrices
  // -------------------------------------------------------------------------
  {
    const section = "telegramValidation";
    try {
      const cases = [
        ["valid_username", () => normalizeTelegramLocal("StudyDate_User"), true],
        ["leading_at", () => normalizeTelegramLocal("@StudyDate_User"), true],
        ["too_short", () => normalizeTelegramLocal("abcd"), false],
        ["too_long", () => normalizeTelegramLocal("a".repeat(33)), false],
        ["url_rejected", () => normalizeTelegramLocal("https://t.me/x"), false],
        ["spaces", () => normalizeTelegramLocal("bad user"), false],
      ];
      const caseResults = {};
      for (const [label, fn, expectOk] of cases) {
        const outcome = tryNormalize(fn, label);
        caseResults[label] = {
          accepted: outcome.accepted,
          matchesExpectation: outcome.accepted === expectOk,
        };
        assert.equal(caseResults[label].matchesExpectation, true);
      }
      results.telegramValidation = {
        cases: caseResults,
        allPassed: Object.values(caseResults).every((r) => r.matchesExpectation),
      };
      assert.equal(results.telegramValidation.allPassed, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "instagramValidation";
    try {
      const cases = [
        ["valid_username", () => normalizeInstagramLocal("campus.user"), true],
        ["leading_at", () => normalizeInstagramLocal("@campus.user"), true],
        ["double_dot", () => normalizeInstagramLocal("bad..user"), false],
        ["too_long", () => normalizeInstagramLocal("a".repeat(31)), false],
        ["invalid_char", () => normalizeInstagramLocal("bad user!"), false],
      ];
      const caseResults = {};
      for (const [label, fn, expectOk] of cases) {
        const outcome = tryNormalize(fn, label);
        caseResults[label] = {
          accepted: outcome.accepted,
          matchesExpectation: outcome.accepted === expectOk,
        };
        assert.equal(caseResults[label].matchesExpectation, true);
      }
      results.instagramValidation = {
        cases: caseResults,
        allPassed: Object.values(caseResults).every((r) => r.matchesExpectation),
      };
      assert.equal(results.instagramValidation.allPassed, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "linkedinValidation";
    try {
      const cases = [
        [
          "valid_https_in",
          () =>
            normalizeLinkedInLocal(
              "https://www.linkedin.com/in/andi-campus/?trk=x",
            ),
          true,
        ],
        [
          "http_rejected",
          () => normalizeLinkedInLocal("http://www.linkedin.com/in/andi"),
          false,
        ],
        [
          "company_path",
          () => normalizeLinkedInLocal("https://linkedin.com/company/x"),
          false,
        ],
        [
          "wrong_host",
          () => normalizeLinkedInLocal("https://evil.example/in/andi"),
          false,
        ],
      ];
      const caseResults = {};
      for (const [label, fn, expectOk] of cases) {
        const outcome = tryNormalize(fn, label);
        caseResults[label] = {
          accepted: outcome.accepted,
          matchesExpectation: outcome.accepted === expectOk,
        };
        assert.equal(caseResults[label].matchesExpectation, true);
      }
      results.linkedinValidation = {
        cases: caseResults,
        allPassed: Object.values(caseResults).every((r) => r.matchesExpectation),
      };
      assert.equal(results.linkedinValidation.allPassed, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  let versionTgA = null;
  {
    const section = "preparedPrivacy";
    try {
      const baselineB = await getContactState(sessions.B, publicAB);
      const baselineSnap = channelSnapshot(baselineB.rows);

      const reg = await registerContact(admin, {
        publicId: publicAB,
        ownerUserId: accounts.A.id,
        channel: "telegram",
        value: HANDLE.tgA,
      });
      assert.ok(reg.versionId);
      versionTgA = reg.versionId;

      const afterB = await getContactState(sessions.B, publicAB);
      const afterA = await getContactState(sessions.A, publicAB);
      const previewA = await sessions.A.rpc("get_contact_reveal_preview", {
        p_public_id: publicAB,
        p_channel: "telegram",
      });
      const previewB = await sessions.B.rpc("get_contact_reveal_preview", {
        p_public_id: publicAB,
        p_channel: "telegram",
      });
      const previewC = await sessions.C.rpc("get_contact_reveal_preview", {
        p_public_id: publicAB,
        p_channel: "telegram",
      });

      const aPreviewRow = firstState(previewA.data);
      const bIndistinguishable =
        channelSnapshot(afterB.rows) === baselineSnap;

      // Instagram lightly
      const baselineBIg = channelSnapshot(
        (await getContactState(sessions.B, publicAB)).rows,
      );
      const regIg = await registerContact(admin, {
        publicId: publicAB,
        ownerUserId: accounts.A.id,
        channel: "instagram",
        value: HANDLE.igA,
      });
      assert.ok(regIg.versionId);
      const afterBIg = channelSnapshot(
        (await getContactState(sessions.B, publicAB)).rows,
      );

      results.preparedPrivacy = {
        aHasContact: channelRow(afterA, "telegram")?.has_contact === true,
        aPreviewOk: !previewA.error && Boolean(aPreviewRow?.contact_version_id),
        aPreviewFieldNames: aPreviewRow
          ? Object.keys(aPreviewRow).sort()
          : [],
        bPreviewEmpty:
          Boolean(previewB.error) ||
          !firstState(previewB.data)?.contact_version_id,
        cPreviewEmpty:
          Boolean(previewC.error) ||
          !firstState(previewC.data)?.contact_version_id,
        bIndistinguishable,
        bIgIndistinguishable: afterBIg === baselineBIg,
        bSafe: !safeStateKeys(afterB.rows).sensitiveLeak,
      };

      assert.equal(results.preparedPrivacy.aHasContact, true);
      assert.equal(results.preparedPrivacy.aPreviewOk, true);
      assert.equal(results.preparedPrivacy.bPreviewEmpty, true);
      assert.equal(results.preparedPrivacy.cPreviewEmpty, true);
      assert.equal(results.preparedPrivacy.bIndistinguishable, true);
      assert.equal(results.preparedPrivacy.bIgIndistinguishable, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  let versionTgA2 = null;
  {
    const section = "replacement";
    try {
      const baselineB = channelSnapshot(
        (await getContactState(sessions.B, publicAB)).rows,
      );

      assert.ifError(
        (await selectContact(sessions.A, publicAB, "telegram", versionTgA))
          .error,
      );
      assert.equal(
        channelRow(await getContactState(sessions.A, publicAB), "telegram")
          ?.selected_by_me,
        true,
      );

      const reg2 = await registerContact(admin, {
        publicId: publicAB,
        ownerUserId: accounts.A.id,
        channel: "telegram",
        value: HANDLE.tgA2,
      });
      assert.ok(reg2.versionId);
      versionTgA2 = reg2.versionId;

      const afterReplaceA = await getContactState(sessions.A, publicAB);
      const afterReplaceB = channelSnapshot(
        (await getContactState(sessions.B, publicAB)).rows,
      );

      // Cross-channel: telegram version on instagram select
      const crossChannel = await selectContact(
        sessions.A,
        publicAB,
        "instagram",
        versionTgA2,
      );

      // Cross-conversation: version from A/X1 used on A/B
      const regAX = await registerContact(admin, {
        publicId: publicAX,
        ownerUserId: accounts.A.id,
        channel: "telegram",
        value: HANDLE.tgA,
      });
      assert.ok(regAX.versionId);
      const crossConv = await selectContact(
        sessions.A,
        publicAB,
        "telegram",
        regAX.versionId,
      );

      // Ownership: B cannot select A's version
      const ownership = await selectContact(
        sessions.B,
        publicAB,
        "telegram",
        versionTgA2,
      );

      results.replacement = {
        selectedClearedAfterReplace:
          channelRow(afterReplaceA, "telegram")?.selected_by_me === false,
        hasContactAfterReplace:
          channelRow(afterReplaceA, "telegram")?.has_contact === true,
        bUnchanged: afterReplaceB === baselineB,
        crossChannelRejected: Boolean(crossChannel.error),
        crossChannelCategory: errorCategory(crossChannel.error),
        crossConversationRejected: Boolean(crossConv.error),
        crossConversationCategory: errorCategory(crossConv.error),
        ownershipRejected: Boolean(ownership.error),
        ownershipCategory: errorCategory(ownership.error),
      };

      assert.equal(results.replacement.selectedClearedAfterReplace, true);
      assert.equal(results.replacement.bUnchanged, true);
      assert.equal(results.replacement.crossChannelRejected, true);
      assert.equal(results.replacement.crossConversationRejected, true);
      assert.equal(results.replacement.ownershipRejected, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "oneSided";
    try {
      const baselineB = channelSnapshot(
        (await getContactState(sessions.B, publicAB)).rows,
      );

      assert.ifError(
        (await selectContact(sessions.A, publicAB, "telegram", versionTgA2))
          .error,
      );

      const stateA = await getContactState(sessions.A, publicAB);
      const stateB = await getContactState(sessions.B, publicAB);
      const meta = await shellMeta(admin, publicAB);
      const { count: eventCount } = await admin
        .from("conversation_events")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", meta.id)
        .eq("event_type", "contact_revealed")
        .eq("event_channel", "telegram");

      results.oneSided = {
        aSelected: channelRow(stateA, "telegram")?.selected_by_me === true,
        bUnchanged: channelSnapshot(stateB.rows) === baselineB,
        noContactRevealedEvent: (eventCount ?? 0) === 0,
        bCompleted: channelRow(stateB, "telegram")?.completed === true,
        sensitiveLeak: safeStateKeys(stateB.rows).sensitiveLeak,
      };

      assert.equal(results.oneSided.aSelected, true);
      assert.equal(results.oneSided.bUnchanged, true);
      assert.equal(results.oneSided.noContactRevealedEvent, true);
      assert.equal(results.oneSided.bCompleted, false);
      assert.equal(results.oneSided.sensitiveLeak, false);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "withdraw";
    try {
      const baselineB = channelSnapshot(
        (await getContactState(sessions.B, publicAB)).rows,
      );

      assert.ifError(
        (await withdrawContact(sessions.A, publicAB, "telegram")).error,
      );
      const again = await withdrawContact(sessions.A, publicAB, "telegram");

      const stateA = await getContactState(sessions.A, publicAB);
      const stateB = await getContactState(sessions.B, publicAB);

      results.withdraw = {
        withdrawn: channelRow(stateA, "telegram")?.selected_by_me === false,
        canWithdrawFalse:
          channelRow(stateA, "telegram")?.can_withdraw === false,
        idempotentOk: !again.error,
        bUnchanged: channelSnapshot(stateB.rows) === baselineB,
      };

      assert.equal(results.withdraw.withdrawn, true);
      assert.equal(results.withdraw.idempotentOk, true);
      assert.equal(results.withdraw.bUnchanged, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  let completedTgVersions = null;
  {
    const section = "telegramCompletion";
    try {
      completedTgVersions = await completeContactChannel(
        admin,
        sessions.A,
        sessions.B,
        publicAB,
        accounts.A.id,
        accounts.B.id,
        "telegram",
        HANDLE.tgA,
        HANDLE.tgB,
      );

      const meta = await shellMeta(admin, publicAB);
      const { count: snapshotCount } = await admin
        .from("conversation_contact_reveals")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", meta.id)
        .eq("channel", "telegram");
      const { count: eventCount } = await admin
        .from("conversation_events")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", meta.id)
        .eq("event_type", "contact_revealed")
        .eq("event_channel", "telegram");

      const cipherA = await getCompletedCipher(
        admin,
        publicAB,
        accounts.A.id,
        "telegram",
      );
      const cipherB = await getCompletedCipher(
        admin,
        publicAB,
        accounts.B.id,
        "telegram",
      );
      const cipherC = await getCompletedCipher(
        admin,
        publicAB,
        accounts.C.id,
        "telegram",
      );

      const dup = await selectContact(
        sessions.A,
        publicAB,
        "telegram",
        completedTgVersions.versionA,
      );
      const { count: eventAfter } = await admin
        .from("conversation_events")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", meta.id)
        .eq("event_type", "contact_revealed")
        .eq("event_channel", "telegram");

      const stateA = await getContactState(sessions.A, publicAB);

      results.telegramCompletion = {
        snapshotCount: snapshotCount ?? 0,
        eventCount: eventCount ?? 0,
        eventChannelTelegram: true,
        aCompleted: cipherA.completed && cipherA.minePresent && cipherA.counterpartPresent,
        bCompleted: cipherB.completed && cipherB.minePresent && cipherB.counterpartPresent,
        cCannotGetCipher: !cipherC.completed && !cipherC.minePresent,
        duplicateSelectOk: !dup.error,
        noSecondEvent: (eventAfter ?? 0) === (eventCount ?? 0),
        igIncomplete: channelRow(stateA, "instagram")?.completed !== true,
        liIncomplete: channelRow(stateA, "linkedin")?.completed !== true,
        cipherFieldNames: cipherA.fieldNames,
      };

      assert.equal(results.telegramCompletion.snapshotCount, 1);
      assert.equal(results.telegramCompletion.eventCount, 1);
      assert.equal(results.telegramCompletion.aCompleted, true);
      assert.equal(results.telegramCompletion.bCompleted, true);
      assert.equal(results.telegramCompletion.cCannotGetCipher, true);
      assert.equal(results.telegramCompletion.noSecondEvent, true);
      assert.equal(results.telegramCompletion.igIncomplete, true);
      assert.equal(results.telegramCompletion.liIncomplete, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "crossChannel";
    try {
      const tgBefore = await getCompletedCipher(
        admin,
        publicAB,
        accounts.A.id,
        "telegram",
      );

      await completeContactChannel(
        admin,
        sessions.A,
        sessions.B,
        publicAB,
        accounts.A.id,
        accounts.B.id,
        "instagram",
        HANDLE.igA,
        HANDLE.igB,
      );
      await completeContactChannel(
        admin,
        sessions.A,
        sessions.B,
        publicAB,
        accounts.A.id,
        accounts.B.id,
        "linkedin",
        HANDLE.liA,
        HANDLE.liB,
      );

      const meta = await shellMeta(admin, publicAB);
      const { count: igSnap } = await admin
        .from("conversation_contact_reveals")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", meta.id)
        .eq("channel", "instagram");
      const { count: liSnap } = await admin
        .from("conversation_contact_reveals")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", meta.id)
        .eq("channel", "linkedin");
      const { count: tgEvents } = await admin
        .from("conversation_events")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", meta.id)
        .eq("event_type", "contact_revealed")
        .eq("event_channel", "telegram");

      const tgAfter = await getCompletedCipher(
        admin,
        publicAB,
        accounts.A.id,
        "telegram",
      );
      const igCipher = await getCompletedCipher(
        admin,
        publicAB,
        accounts.A.id,
        "instagram",
      );
      const liCipher = await getCompletedCipher(
        admin,
        publicAB,
        accounts.A.id,
        "linkedin",
      );

      results.crossChannel = {
        igSnapshotCount: igSnap ?? 0,
        liSnapshotCount: liSnap ?? 0,
        igCompleted: igCipher.completed && igCipher.counterpartPresent,
        liCompleted: liCipher.completed && liCipher.counterpartPresent,
        telegramSnapshotUnchanged:
          tgBefore.completed === true &&
          tgAfter.completed === true &&
          tgBefore.minePresent === tgAfter.minePresent &&
          tgBefore.counterpartPresent === tgAfter.counterpartPresent,
        telegramEventStillOne: (tgEvents ?? 0) === 1,
      };

      assert.equal(results.crossChannel.igSnapshotCount, 1);
      assert.equal(results.crossChannel.liSnapshotCount, 1);
      assert.equal(results.crossChannel.igCompleted, true);
      assert.equal(results.crossChannel.liCompleted, true);
      assert.equal(results.crossChannel.telegramSnapshotUnchanged, true);
      assert.equal(results.crossChannel.telegramEventStillOne, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "linkSecurity";
    try {
      const tg = await getCompletedCipher(
        admin,
        publicAB,
        accounts.A.id,
        "telegram",
      );
      const ig = await getCompletedCipher(
        admin,
        publicAB,
        accounts.A.id,
        "instagram",
      );
      const li = await getCompletedCipher(
        admin,
        publicAB,
        accounts.A.id,
        "linkedin",
      );

      const tgPlain = decryptContact({
        ciphertext: tg.row.counterpart_ciphertext,
        iv: tg.row.counterpart_iv,
        authTag: tg.row.counterpart_auth_tag,
      });
      const igPlain = decryptContact({
        ciphertext: ig.row.counterpart_ciphertext,
        iv: ig.row.counterpart_iv,
        authTag: ig.row.counterpart_auth_tag,
      });
      const liPlain = decryptContact({
        ciphertext: li.row.counterpart_ciphertext,
        iv: li.row.counterpart_iv,
        authTag: li.row.counterpart_auth_tag,
      });

      const tgHref = formatContactHref("telegram", tgPlain);
      const igHref = formatContactHref("instagram", igPlain);
      const liHref = formatContactHref("linkedin", liPlain);

      results.linkSecurity = {
        tgDecryptMatchesExpected: tgPlain === HANDLE.tgB,
        igDecryptMatchesExpected: igPlain === HANDLE.igB,
        liDecryptMatchesExpected: liPlain === HANDLE.liB,
        tgDomainOk: new URL(tgHref).hostname === "t.me",
        igDomainOk: new URL(igHref).hostname === "instagram.com",
        liDomainOk:
          new URL(liHref).hostname === "www.linkedin.com" &&
          new URL(liHref).pathname.startsWith("/in/"),
      };

      assert.equal(results.linkSecurity.tgDecryptMatchesExpected, true);
      assert.equal(results.linkSecurity.igDecryptMatchesExpected, true);
      assert.equal(results.linkSecurity.liDecryptMatchesExpected, true);
      assert.equal(results.linkSecurity.tgDomainOk, true);
      assert.equal(results.linkSecurity.igDomainOk, true);
      assert.equal(results.linkSecurity.liDomainOk, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "endBefore";
    try {
      const { publicId } = await openActiveMutualConversation(
        sessions.E1,
        sessions.E2,
      );
      await completeIdentityReveal(
        admin,
        sessions.E1,
        sessions.E2,
        publicId,
        accounts.E1.id,
        accounts.E2.id,
      );
      const prepared = await registerContact(admin, {
        publicId,
        ownerUserId: accounts.E1.id,
        channel: "telegram",
        value: HANDLE.tgA,
      });
      assert.ok(prepared.versionId);

      assert.ifError(
        (await sessions.E1.rpc("end_conversation", { p_public_id: publicId }))
          .error,
      );

      const regFail = await registerContact(admin, {
        publicId,
        ownerUserId: accounts.E1.id,
        channel: "instagram",
        value: HANDLE.igA,
      });
      const selFail = await selectContact(
        sessions.E1,
        publicId,
        "telegram",
        prepared.versionId,
      );
      const meta = await shellMeta(admin, publicId);

      results.endBefore = {
        registerFailed: Boolean(regFail.error),
        registerCategory: errorCategory(regFail.error),
        selectFailed: Boolean(selFail.error),
        selectCategory: errorCategory(selFail.error),
        shellStatus: meta?.status ?? null,
      };

      assert.equal(results.endBefore.registerFailed, true);
      assert.equal(results.endBefore.selectFailed, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "blockBefore";
    try {
      const { publicId } = await openActiveMutualConversation(
        sessions.B1,
        sessions.B2,
      );
      await completeIdentityReveal(
        admin,
        sessions.B1,
        sessions.B2,
        publicId,
        accounts.B1.id,
        accounts.B2.id,
      );
      const prepared = await registerContact(admin, {
        publicId,
        ownerUserId: accounts.B1.id,
        channel: "telegram",
        value: HANDLE.tgA,
      });
      assert.ok(prepared.versionId);

      assert.ifError(
        (
          await sessions.B1.rpc("block_student_by_alias", {
            p_alias: aliases.B2,
          })
        ).error,
      );

      const regFail = await registerContact(admin, {
        publicId,
        ownerUserId: accounts.B1.id,
        channel: "instagram",
        value: HANDLE.igA,
      });
      const selFail = await selectContact(
        sessions.B1,
        publicId,
        "telegram",
        prepared.versionId,
      );
      const meta = await shellMeta(admin, publicId);

      results.blockBefore = {
        registerFailed: Boolean(regFail.error),
        registerCategory: errorCategory(regFail.error),
        selectFailed: Boolean(selFail.error),
        selectCategory: errorCategory(selFail.error),
        shellStatus: meta?.status ?? null,
      };

      assert.equal(results.blockBefore.registerFailed, true);
      assert.equal(results.blockBefore.selectFailed, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "endAfter";
    try {
      const { publicId } = await openActiveMutualConversation(
        sessions.R1,
        sessions.R2,
      );
      await completeIdentityReveal(
        admin,
        sessions.R1,
        sessions.R2,
        publicId,
        accounts.R1.id,
        accounts.R2.id,
      );
      await completeContactChannel(
        admin,
        sessions.R1,
        sessions.R2,
        publicId,
        accounts.R1.id,
        accounts.R2.id,
        "telegram",
        HANDLE.tgA,
        HANDLE.tgB,
      );

      assert.ifError(
        (await sessions.R1.rpc("end_conversation", { p_public_id: publicId }))
          .error,
      );

      const cipherR1 = await getCompletedCipher(
        admin,
        publicId,
        accounts.R1.id,
        "telegram",
      );
      const cipherR2 = await getCompletedCipher(
        admin,
        publicId,
        accounts.R2.id,
        "telegram",
      );
      const regFail = await registerContact(admin, {
        publicId,
        ownerUserId: accounts.R1.id,
        channel: "instagram",
        value: HANDLE.igA,
      });

      results.endAfter = {
        r1CounterpartPresent: cipherR1.counterpartPresent,
        r2CounterpartPresent: cipherR2.counterpartPresent,
        r1MinePresent: cipherR1.minePresent,
        r2MinePresent: cipherR2.minePresent,
        newChannelRegisterFailed: Boolean(regFail.error),
        newChannelCategory: errorCategory(regFail.error),
      };

      assert.equal(results.endAfter.r1CounterpartPresent, true);
      assert.equal(results.endAfter.r2CounterpartPresent, true);
      assert.equal(results.endAfter.newChannelRegisterFailed, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "blockAfter";
    try {
      const { publicId } = await openActiveMutualConversation(
        sessions.K1,
        sessions.K2,
      );
      await completeIdentityReveal(
        admin,
        sessions.K1,
        sessions.K2,
        publicId,
        accounts.K1.id,
        accounts.K2.id,
      );
      await completeContactChannel(
        admin,
        sessions.K1,
        sessions.K2,
        publicId,
        accounts.K1.id,
        accounts.K2.id,
        "telegram",
        HANDLE.tgA,
        HANDLE.tgB,
      );

      assert.ifError(
        (
          await sessions.K1.rpc("block_student_by_alias", {
            p_alias: aliases.K2,
          })
        ).error,
      );

      const cipherK1 = await getCompletedCipher(
        admin,
        publicId,
        accounts.K1.id,
        "telegram",
      );

      results.blockAfter = {
        completedStillTrue: cipherK1.completed === true,
        minePresent: cipherK1.minePresent === true,
        counterpartNull: cipherK1.counterpartPresent === false,
      };

      assert.equal(results.blockAfter.completedStillTrue, true);
      assert.equal(results.blockAfter.minePresent, true);
      assert.equal(results.blockAfter.counterpartNull, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "staffIsolation";
    try {
      const enc = encryptContact(HANDLE.tgA);
      const { error: authRegisterError } = await sessions.A.rpc(
        "register_contact_reveal_version",
        {
          p_public_id: publicAB,
          p_owner_user_id: accounts.A.id,
          p_channel: "telegram",
          p_contact_ciphertext: enc.ciphertext,
          p_contact_iv: enc.iv,
          p_contact_auth_tag: enc.authTag,
          p_encryption_key_version: 1,
        },
      );

      const cSelect = await selectContact(
        sessions.C,
        publicAB,
        "telegram",
        completedTgVersions.versionA,
      );
      const cCipher = await getCompletedCipher(
        admin,
        publicAB,
        accounts.C.id,
        "telegram",
      );
      const cState = await getContactState(sessions.C, publicAB);

      results.staffIsolation = {
        authCannotRegister: Boolean(authRegisterError),
        authRegisterCategory: errorCategory(authRegisterError),
        cCannotSelect: Boolean(cSelect.error),
        cSelectCategory: errorCategory(cSelect.error),
        cCannotComplete: !cCipher.completed,
        cNotEligible:
          channelRow(cState, "telegram")?.eligible !== true,
        note: "Temp staff skipped; service_role-only register + outsider isolation asserted",
      };

      assert.equal(results.staffIsolation.authCannotRegister, true);
      assert.equal(results.staffIsolation.cCannotSelect, true);
      assert.equal(results.staffIsolation.cCannotComplete, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "encryptionAtRest";
    try {
      const meta = await shellMeta(admin, publicAB);
      const { data: versionRows, error } = await admin
        .from("conversation_contact_versions")
        .select("id,channel,contact_ciphertext,owner_user_id")
        .eq("conversation_id", meta.id)
        .eq("channel", "telegram")
        .eq("owner_user_id", accounts.A.id)
        .limit(5);
      assert.ifError(error);
      assert.ok((versionRows ?? []).length >= 1);

      let plaintextLeaked = false;
      const known = [HANDLE.tgA, HANDLE.tgA2, HANDLE.tgB];
      for (const row of versionRows ?? []) {
        const raw = row.contact_ciphertext;
        let buf;
        try {
          buf = fromBytea(raw);
        } catch {
          buf = Buffer.from(String(raw ?? ""), "utf8");
        }
        const asUtf8 = buf.toString("utf8");
        for (const plain of known) {
          if (asUtf8.includes(plain)) plaintextLeaked = true;
        }
        // ASCII-looking handle would be printable; binary ciphertext should not equal plain
        if (asUtf8 === HANDLE.tgA || asUtf8 === HANDLE.tgA2) {
          plaintextLeaked = true;
        }
      }

      const enc1 = encryptContact(HANDLE.tgA);
      const enc2 = encryptContact(HANDLE.tgA);

      results.encryptionAtRest = {
        rowsInspected: (versionRows ?? []).length,
        plaintextNotInCipherUtf8: !plaintextLeaked,
        sameValueDifferentCipher: enc1.ciphertext !== enc2.ciphertext,
        note: "Ciphertext values intentionally omitted from report",
      };

      assert.equal(results.encryptionAtRest.plaintextNotInCipherUtf8, true);
      assert.equal(results.encryptionAtRest.sameValueDifferentCipher, true);
      pass(section);
    } catch (error) {
      fail(section, errorCategory(error));
      throw error;
    }
  }

  {
    const section = "sideChannel";
    try {
      const { publicId } = await openActiveMutualConversation(
        sessions.X1,
        sessions.X2,
      );
      await completeIdentityReveal(
        admin,
        sessions.X1,
        sessions.X2,
        publicId,
        accounts.X1.id,
        accounts.X2.id,
      );

      const snap = async () =>
        channelSnapshot((await getContactState(sessions.X2, publicId)).rows);

      const baseline = await snap();

      const reg1 = await registerContact(admin, {
        publicId,
        ownerUserId: accounts.X1.id,
        channel: "telegram",
        value: HANDLE.tgA,
      });
      assert.ok(reg1.versionId);
      const afterPrepare = await snap();

      assert.ifError(
        (await selectContact(sessions.X1, publicId, "telegram", reg1.versionId))
          .error,
      );
      const afterConsent = await snap();

      assert.ifError(
        (await withdrawContact(sessions.X1, publicId, "telegram")).error,
      );
      const afterWithdraw = await snap();

      const reg2 = await registerContact(admin, {
        publicId,
        ownerUserId: accounts.X1.id,
        channel: "telegram",
        value: HANDLE.tgA2,
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

  {
    const section = "cleanup";
    try {
      const stats = await deleteSyntheticRows(admin, ids);
      results.cleanup = {
        shellsTouched: stats.shellsTouched,
        introsRemoved: stats.introsRemoved,
        storageKeysRemoved: stats.storageKeysRemoved,
        accountsDeleted: false,
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
  await failureCleanup();
  failureCleanup = null;
  results.cleanup.accountsDeleted = true;

  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  log("REPORT_WRITTEN", "audit-artifacts/contact-reveal-live-report.json");
  log("CONTACT_REVEAL_LIVE_AUDIT_COMPLETE");
  process.exitCode = 0;
}

main().catch(async (error) => {
  console.error("CONTACT_REVEAL_LIVE_AUDIT_FAILED", errorCategory(error));
  if (failureCleanup) {
    await failureCleanup().catch(() => undefined);
    failureCleanup = null;
  }
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
