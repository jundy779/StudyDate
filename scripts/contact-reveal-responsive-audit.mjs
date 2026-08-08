/**
 * Responsive screenshots + browser checks for Contact Reveal.
 * Artifacts under audit-artifacts/ (gitignored). Chrome CDP (no Playwright).
 *
 * HARD RULES: never log emails, UUIDs, tokens, contact values, ciphertext,
 * IVs, auth tags, or encryption keys.
 *
 *   node scripts/contact-reveal-responsive-audit.mjs
 */
import assert from "node:assert/strict";
import { randomBytes, randomInt } from "node:crypto";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const projectRoot = process.cwd();
const accountsPath = join(
  projectRoot,
  "audit-artifacts",
  "contact-reveal-audit-accounts.json",
);
const shotDir = join(projectRoot, "audit-artifacts", "contact-reveal-responsive");
const reportPath = join(
  projectRoot,
  "audit-artifacts",
  "contact-reveal-responsive-report.json",
);
const chromePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = process.env.AUDIT_BASE_URL ?? "http://localhost:3010";
const EXPECTED_PROJECT_REF = "ctbqudtvrfezuoqcecyj";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "identity-reveal-photos";
const PANEL_HEADING = "Bagikan kontak secara bertahap";

mkdirSync(shotDir, { recursive: true });
mkdirSync(join(projectRoot, "audit-artifacts"), { recursive: true });

const uploadedKeys = [];
let nextChild = null;
let createdAccountsThisRun = false;

const report = {
  screenshots: false,
  panelVisible: false,
  noHorizontalOverflow: false,
  consoleClean: false,
  networkClean: false,
  messagesApiNoCipher: false,
  preflightIrCompleted: false,
  preflightChannelEligibleOrCompleted: false,
  cleanup: false,
};

function loadEnvLocal() {
  const env = {};
  for (const line of readFileSync(join(projectRoot, ".env.local"), "utf8").split(
    /\r?\n/,
  )) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    env[line.slice(0, i)] = line.slice(i + 1);
  }
  return env;
}

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
  if ((host.split(".")[0] ?? "") !== EXPECTED_PROJECT_REF) {
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
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.ok(publishable);
  return {
    env,
    publishable,
    admin: createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

function randomHex(n) {
  return randomBytes(n).toString("hex");
}

function isKnownConsoleNoise(text) {
  const v = String(text ?? "").toLowerCase();
  return (
    !v ||
    /react devtools|fast refresh|\[hmr\]|hot-update|favicon\.ico|cursor|net::err_aborted|resizeobserver loop|third-party cookie/.test(
      v,
    )
  );
}

function looksSensitivePayload(text) {
  const v = String(text ?? "");
  if (!v) return false;
  if (/service_role|CONTACT_REVEAL_ENCRYPTION_KEY/i.test(v)) return true;
  if (/identity-reveal-photos|\/object\/sign\/|X-Amz-Signature|token=/i.test(v)) {
    return true;
  }
  if (/"contact_ciphertext"|"contact_iv"|"contact_auth_tag"|"ciphertext"|"auth_tag"/i.test(v)) {
    return true;
  }
  if (
    /storage\/v1/i.test(v) &&
    /[0-9a-f]{16,}\/[0-9a-f]{16,}\.(jpg|jpeg|png|webp)/i.test(v)
  ) {
    return true;
  }
  return false;
}

function messagesBodyHasCipherFields(text) {
  return /contact_ciphertext|contact_iv|contact_auth_tag|"ciphertext"|"iv"/i.test(
    String(text ?? ""),
  );
}

async function processRevealPhoto(input) {
  if (!input.length || input.byteLength > 5 * 1024 * 1024) throw new Error("photo_rejected");
  const image = sharp(input, { failOn: "error", animated: false, pages: 1 });
  const metadata = await image.metadata();
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
    throw new Error("photo_rejected");
  }
  if ((metadata.pages ?? 1) > 1) throw new Error("photo_rejected");
  const w = metadata.width ?? 0;
  const h = metadata.height ?? 0;
  if (w < 64 || h < 64 || w > 4096 || h > 4096) throw new Error("photo_rejected");
  const buffer = await image
    .rotate()
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  const out = await sharp(buffer).metadata();
  if ((out.width ?? 0) < 64 || (out.height ?? 0) < 64 || buffer.byteLength > 5 * 1024 * 1024) {
    throw new Error("photo_rejected");
  }
  return {
    buffer,
    contentType: "image/jpeg",
    byteSize: buffer.byteLength,
    width: out.width,
    height: out.height,
    objectKey: `${randomHex(16)}/${randomHex(16)}.jpg`,
  };
}

async function makeRaster(size = 256) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 70, g: 110, b: 150 },
    },
  })
    .jpeg()
    .toBuffer();
}

async function ensureAccount(kind, accounts, admin) {
  if (accounts[kind]?.id) {
    const { data } = await admin.auth.admin.getUserById(accounts[kind].id);
    if (data?.user && !data.user.app_metadata?.role) return accounts[kind];
  }
  createdAccountsThisRun = true;
  const stamp = `${Date.now()}.${randomInt(1000, 9999)}`;
  const email = `studydate.contact.resp.${kind.toLowerCase()}.${stamp}@audit.ac.id`;
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
    suffix: String(data.user.id).slice(-8),
  };
  writeFileSync(accountsPath, JSON.stringify(accounts, null, 2));
  console.log(`ACCOUNT_READY kind=${kind} suffix=${accounts[kind].suffix}`);
  return accounts[kind];
}

async function loadOrCreateAccounts(admin) {
  const accounts = existsSync(accountsPath)
    ? JSON.parse(readFileSync(accountsPath, "utf8"))
    : {};
  accounts.A = await ensureAccount("A", accounts, admin);
  accounts.B = await ensureAccount("B", accounts, admin);
  assert.ok(accounts.A?.email && accounts.A?.id);
  assert.ok(accounts.B?.email && accounts.B?.id);
  return accounts;
}

async function sessionFor(email) {
  const { env, admin, publishable } = adminBundle();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${baseUrl}/auth/callback?next=/app` },
  });
  if (error || !data?.properties?.hashed_token) throw new Error("generateLink failed");
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
    .select("public_alias,onboarding_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing?.onboarding_completed_at) return existing.public_alias;
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
    p_campus: "Universitas Audit Contact Resp",
    p_study_program: "Informatika",
    p_degree_level: "sarjana",
    p_semester: 4,
    p_city_region: "Bandung",
    p_short_intro: "Profil sintetik untuk audit responsif Contact Reveal.",
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
  if (error) throw new Error("onboarding failed");
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
    if (socialError) throw new Error("social setup failed");
  }
  const { error } = await client.rpc("set_people_discovery_visibility", {
    p_is_discoverable: value,
  });
  if (error) throw new Error("visibility failed");
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

async function magicCallbackUrl(email, nextPath) {
  const { admin } = adminBundle();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${baseUrl}/auth/callback?next=${nextPath}` },
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error("generateLink for browser failed");
  }
  const tokenHash = data.properties.hashed_token;
  return `${baseUrl}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink&next=${encodeURIComponent(nextPath)}`;
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
  if (sendError) throw new Error("intro send failed");
  const { error: acceptError } = await recipientClient.rpc(
    "accept_introduction_request",
    { p_request_id: requestId },
  );
  if (acceptError) throw new Error("intro accept failed");
  const { data: publicId, error: pidError } = await senderClient.rpc(
    "get_conversation_public_id_for_introduction",
    { p_request_id: requestId },
  );
  if (pidError || typeof publicId !== "string") throw new Error("public id resolve failed");
  assert.match(publicId, /^[0-9a-f]{32}$/);
  for (const [client, body] of [
    [senderClient, "Pesan pertama dari pengirim untuk mengaktifkan percakapan audit."],
    [recipientClient, "Pesan balasan dari penerima agar mutual interest tersedia."],
  ]) {
    const { error } = await client.rpc("send_anonymous_message", {
      p_public_id: publicId,
      p_body: body,
    });
    if (error) throw new Error("message failed");
  }
  for (const client of [senderClient, recipientClient]) {
    const { error } = await client.rpc("select_mutual_interest", {
      p_public_id: publicId,
    });
    if (error) throw new Error("mutual failed");
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
  if (uploadError) throw new Error("storage upload failed");
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
    await admin.storage.from(BUCKET).remove([processed.objectKey]).catch(() => undefined);
    throw new Error("register profile failed");
  }
  return String(versionId);
}

async function completeIdentityReveal(admin, clientA, clientB, publicId, ownerA, ownerB) {
  const versionA = await uploadAndRegisterIdentity(admin, {
    publicId,
    ownerUserId: ownerA,
    firstName: "AuditAlpha",
    photoBytes: await makeRaster(),
  });
  const versionB = await uploadAndRegisterIdentity(admin, {
    publicId,
    ownerUserId: ownerB,
    firstName: "AuditBeta",
    photoBytes: await makeRaster(),
  });
  const { error: selA } = await clientA.rpc("select_identity_reveal", {
    p_public_id: publicId,
    p_profile_version_id: versionA,
  });
  if (selA) throw new Error("IR select A failed");
  const { error: selB } = await clientB.rpc("select_identity_reveal", {
    p_public_id: publicId,
    p_profile_version_id: versionB,
  });
  if (selB) throw new Error("IR select B failed");
}

/** Cleanup: allowlisted synthetic IDs only. Includes contact reveal tables. */
async function deleteSyntheticRows(admin, allowlistedIds) {
  const ids = [...new Set((allowlistedIds ?? []).filter(Boolean))];
  if (ids.length === 0) {
    throw new Error(
      "REFUSING cleanup: empty allowlist — only delete ensureAccount synthetic IDs",
    );
  }
  for (const id of ids) {
    if (!UUID_RE.test(id)) throw new Error("REFUSING cleanup: allowlist entry is not a UUID");
  }
  const idList = ids.join(",");

  const { data: ownedVersions } = await admin
    .from("identity_reveal_profile_versions")
    .select("photo_object_key")
    .in("owner_user_id", ids);
  const keysFromDb = (ownedVersions ?? []).map((r) => r.photo_object_key).filter(Boolean);

  const { data: shells } = await admin
    .from("conversation_shells")
    .select("id,introduction_request_id")
    .or(
      `participant_sender_id.in.(${idList}),participant_recipient_id.in.(${idList})`,
    );
  const shellIds = (shells ?? []).map((r) => r.id);
  const introFromShells = (shells ?? []).map((r) => r.introduction_request_id).filter(Boolean);

  if (shellIds.length) {
    for (const table of [
      "conversation_contact_reveals",
      "conversation_contact_reveal_consents",
      "conversation_contact_versions",
      "conversation_identity_reveals",
      "conversation_identity_reveal_consents",
      "identity_reveal_profile_versions",
      "conversation_events",
      "anonymous_messages",
      "conversation_mutual_interests",
    ]) {
      await admin.from(table).delete().in("conversation_id", shellIds);
    }
  }

  await admin.from("conversation_contact_versions").delete().in("owner_user_id", ids);
  await admin.from("identity_reveal_profile_versions").delete().in("owner_user_id", ids);
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
    ...new Set([...(introRows ?? []).map((r) => r.id), ...introFromShells]),
  ];
  if (introIds.length) {
    await admin.from("introduction_events").delete().in("request_id", introIds);
    await admin.from("conversation_shells").delete().in("introduction_request_id", introIds);
    await admin.from("introduction_requests").delete().in("id", introIds);
  }
  if (shellIds.length) {
    await admin.from("conversation_shells").delete().in("id", shellIds);
  }

  const allKeys = [...new Set([...keysFromDb, ...uploadedKeys])];
  for (let i = 0; i < allKeys.length; i += 50) {
    await admin.storage
      .from(BUCKET)
      .remove(allKeys.slice(i, i + 50))
      .catch(() => undefined);
  }
  return {
    shellsTouched: shellIds.length,
    introsRemoved: introIds.length,
    storageKeysRemoved: allKeys.length,
  };
}

async function isNextUp() {
  try {
    const response = await fetch(baseUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(4000),
    });
    return response.status > 0;
  } catch {
    return false;
  }
}

async function ensureNextServer() {
  if (await isNextUp()) {
    console.log("NEXT_READY reused");
    return;
  }
  const port = new URL(baseUrl).port || "3010";
  nextChild = spawn("npm", ["run", "start"], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    windowsHide: true,
    env: { ...process.env, PORT: port },
  });
  let ready = false;
  const onChunk = (chunk) => {
    if (/Ready in|started server|Local:/i.test(String(chunk))) ready = true;
  };
  nextChild.stdout?.on("data", onChunk);
  nextChild.stderr?.on("data", onChunk);
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (ready || (await isNextUp())) {
      console.log("NEXT_READY spawned");
      return;
    }
    await delay(1000);
  }
  throw new Error("Next server failed to become ready");
}

async function runChrome(accounts, publicId) {
  const profilePath = join(
    projectRoot,
    ".next",
    `contact-reveal-responsive-profile-${process.pid}`,
  );
  mkdirSync(profilePath, { recursive: true });

  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--remote-debugging-pipe",
      `--user-data-dir=${profilePath}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "inherit", "pipe", "pipe"], windowsHide: true },
  );

  const commandPipe = chrome.stdio[3];
  const responsePipe = chrome.stdio[4];
  let messageId = 0;
  let responseBuffer = Buffer.alloc(0);
  const pending = new Map();
  const eventWaiters = [];
  const consoleErrors = [];
  const networkHits = [];
  const responseBodies = [];
  const requestIdsForBody = new Set();
  const messagesRequestIds = new Set();

  responsePipe.on("data", (chunk) => {
    responseBuffer = Buffer.concat([responseBuffer, chunk]);
    let separator = responseBuffer.indexOf(0);
    while (separator !== -1) {
      const raw = responseBuffer.subarray(0, separator).toString("utf8");
      responseBuffer = responseBuffer.subarray(separator + 1);
      if (raw) {
        const message = JSON.parse(raw);
        if (message.id && pending.has(message.id)) {
          const { resolve, reject } = pending.get(message.id);
          pending.delete(message.id);
          if (message.error) reject(new Error(message.error.message));
          else resolve(message.result);
        } else if (message.method) {
          if (
            message.method === "Runtime.consoleAPICalled" &&
            message.params?.type === "error"
          ) {
            const text = (message.params.args ?? [])
              .map((a) => a.value ?? a.description ?? "")
              .join(" ");
            if (!isKnownConsoleNoise(text)) {
              consoleErrors.push(looksSensitivePayload(text) ? "secret" : "console");
            }
          }
          if (message.method === "Runtime.exceptionThrown") {
            const text =
              message.params?.exceptionDetails?.text ??
              message.params?.exceptionDetails?.exception?.description ??
              "";
            if (!isKnownConsoleNoise(text)) {
              consoleErrors.push(looksSensitivePayload(text) ? "secret" : "exception");
            }
          }
          if (
            message.method === "Network.requestWillBeSent" ||
            message.method === "Network.responseReceived"
          ) {
            const url =
              message.params?.request?.url ?? message.params?.response?.url ?? "";
            networkHits.push(url);
            if (looksSensitivePayload(url)) responseBodies.push("sensitive-url");
          }
          if (message.method === "Network.responseReceived") {
            const url = message.params?.response?.url ?? "";
            const mime = message.params?.response?.mimeType ?? "";
            const requestId = message.params?.requestId;
            if (
              requestId &&
              /javascript|json|text|html/.test(mime)
            ) {
              requestIdsForBody.add(requestId);
              if (/\/api\/messages\b/i.test(url)) messagesRequestIds.add(requestId);
            }
          }
          for (const waiter of [...eventWaiters]) {
            if (
              waiter.method === message.method &&
              (!waiter.sessionId || waiter.sessionId === message.sessionId)
            ) {
              eventWaiters.splice(eventWaiters.indexOf(waiter), 1);
              waiter.resolve(message.params);
            }
          }
        }
      }
      separator = responseBuffer.indexOf(0);
    }
  });

  function send(method, params = {}, sessionId) {
    const id = (messageId += 1);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 30_000);
      pending.set(id, {
        resolve: (r) => {
          clearTimeout(timeout);
          resolve(r);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });
      commandPipe.write(
        `${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`,
      );
    });
  }

  function waitForEvent(method, sessionId) {
    return new Promise((resolve, reject) => {
      const waiter = { method, sessionId, resolve };
      eventWaiters.push(waiter);
      setTimeout(() => {
        const i = eventWaiters.indexOf(waiter);
        if (i !== -1) {
          eventWaiters.splice(i, 1);
          reject(new Error(`CDP event timeout: ${method}`));
        }
      }, 30_000);
    });
  }

  async function evaluate(expression, sessionId) {
    const result = await send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (result.exceptionDetails) throw new Error("evaluate failed");
    return result.result.value;
  }

  try {
    const { targetInfos } = await send("Target.getTargets");
    const pageTarget = targetInfos.find((t) => t.type === "page");
    assert.ok(pageTarget);
    const { sessionId } = await send("Target.attachToTarget", {
      targetId: pageTarget.targetId,
      flatten: true,
    });
    await send("Page.enable", {}, sessionId);
    await send("Runtime.enable", {}, sessionId);
    await send("Network.enable", {}, sessionId);

    const roomPath = `/app/messages/${publicId}`;
    const loginUrl = await magicCallbackUrl(accounts.A.email, roomPath);
    {
      const loaded = waitForEvent("Page.loadEventFired", sessionId);
      await send("Page.navigate", { url: loginUrl }, sessionId);
      await loaded;
      await delay(1500);
    }

    const viewports = [[375, 812], [768, 1024], [1024, 768], [1440, 900]];
    let overflowOk = true;
    let panelOk = false;

    for (const [width, height] of viewports) {
      await send(
        "Emulation.setDeviceMetricsOverride",
        { width, height, deviceScaleFactor: 1, mobile: width <= 768 },
        sessionId,
      );
      const loaded = waitForEvent("Page.loadEventFired", sessionId);
      await send("Page.navigate", { url: `${baseUrl}${roomPath}` }, sessionId);
      await loaded;

      let metrics = null;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await delay(500);
        metrics = await evaluate(
          `(() => {
            const panel = document.querySelector('[aria-label="${PANEL_HEADING}"]');
            if (panel) panel.scrollIntoView({ block: "center" });
            const body = document.body?.innerText ?? "";
            const html = document.documentElement?.innerHTML ?? "";
            return {
              overflowX:
                document.documentElement.scrollWidth >
                document.documentElement.clientWidth + 1,
              bodyOverflow:
                document.body.scrollWidth >
                document.documentElement.clientWidth + 1,
              panelVisible:
                Boolean(panel) ||
                /Bagikan kontak secara bertahap/.test(body) ||
                /Bagikan kontak secara bertahap/.test(html),
            };
          })()`,
          sessionId,
        );
        if (metrics?.panelVisible) break;
      }

      if (metrics?.overflowX || metrics?.bodyOverflow) overflowOk = false;
      if (metrics?.panelVisible) panelOk = true;
      if (!metrics?.panelVisible) console.log(`PANEL_MISS viewport=${width}x${height}`);

      const screenshot = await send(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: false, fromSurface: true },
        sessionId,
      );
      const file = `messages-room-cr-${width}x${height}.png`;
      writeFileSync(join(shotDir, file), screenshot.data, "base64");
      console.log(`SHOT_OK ${file}`);
    }

    report.screenshots = true;
    report.panelVisible = panelOk;
    report.noHorizontalOverflow = overflowOk;
    assert.equal(panelOk, true, "Contact Reveal panel heading missing");
    assert.equal(overflowOk, true, "horizontal overflow detected");

    await evaluate(
      `(() => fetch(${JSON.stringify(`/api/messages/${publicId}`)}, { credentials: "include" }).then((r) => r.status))()`,
      sessionId,
    );
    await delay(800);

    let messagesCipherLeak = false;
    for (const requestId of messagesRequestIds) {
      try {
        const body = await send("Network.getResponseBody", { requestId }, sessionId);
        const text = String(body?.body ?? "");
        if (messagesBodyHasCipherFields(text) || looksSensitivePayload(text)) {
          messagesCipherLeak = true;
          responseBodies.push("messages-cipher");
        }
      } catch {
        // body unavailable
      }
    }
    for (const requestId of [...requestIdsForBody].slice(0, 40)) {
      try {
        const body = await send("Network.getResponseBody", { requestId }, sessionId);
        if (looksSensitivePayload(String(body?.body ?? ""))) {
          responseBodies.push("sensitive-body");
        }
      } catch {
        // ignore
      }
    }

    const clientScriptLeak = await evaluate(
      `(() => {
        const scripts = [...document.querySelectorAll("script")]
          .map((node) => node.textContent || "")
          .join("\\n");
        return /service_role|CONTACT_REVEAL_ENCRYPTION_KEY|contact_ciphertext/i.test(scripts);
      })()`,
      sessionId,
    );

    const networkClean =
      responseBodies.length === 0 &&
      !networkHits.some((url) => looksSensitivePayload(url)) &&
      clientScriptLeak !== true;
    const consoleClean = consoleErrors.length === 0;
    report.messagesApiNoCipher = !messagesCipherLeak;
    report.networkClean = networkClean;
    report.consoleClean = consoleClean;
    assert.equal(report.messagesApiNoCipher, true, "messages API leaked cipher fields");
    assert.equal(networkClean, true, "sensitive network/client payload");
    assert.equal(consoleClean, true, "unexpected console errors or secrets");
    console.log("BROWSER_CHECKS_OK");
  } finally {
    chrome.kill();
  }
}

async function main() {
  assert.notEqual(
    process.env.STUDENT_VERIFICATION_ENABLED,
    "true",
    "Student Verification must stay disabled for this audit",
  );
  const envCheck = loadEnvLocal();
  assertLinkedProjectRef(envCheck);
  assert.notEqual(
    envCheck.STUDENT_VERIFICATION_ENABLED,
    "true",
    "STUDENT_VERIFICATION_ENABLED must not be true in .env.local",
  );

  const { admin } = adminBundle();
  const accounts = await loadOrCreateAccounts(admin);
  const cleanupIds = [accounts.A.id, accounts.B.id];
  console.log(
    createdAccountsThisRun ? "ACCOUNTS_SOURCE created_minimal_AB" : "ACCOUNTS_SOURCE reused_file",
  );

  try {
    await deleteSyntheticRows(admin, cleanupIds);
    console.log("PRECLEAN_OK");

    const sessionA = await sessionFor(accounts.A.email);
    const sessionB = await sessionFor(accounts.B.email);
    await onboard(sessionA, "AuditA");
    await onboard(sessionB, "AuditB");
    await setDiscoverable(sessionA, true);
    await setDiscoverable(sessionB, true);

    const { publicId } = await openActiveMutualConversation(sessionA, sessionB);
    console.log("SEED_OK mutual_conversation");
    await completeIdentityReveal(
      admin,
      sessionA,
      sessionB,
      publicId,
      accounts.A.id,
      accounts.B.id,
    );
    console.log("IR_COMPLETE");

    {
      const state = await sessionA.rpc("get_contact_reveal_state", {
        p_public_id: publicId,
      });
      const rows = Array.isArray(state.data) ? state.data : [];
      const anyOk = rows.some((r) => r?.eligible === true || r?.completed === true);
      report.preflightIrCompleted = true;
      report.preflightChannelEligibleOrCompleted = anyOk === true;
      assert.equal(anyOk, true, "contact channel not eligible after IR");
      console.log("PREFLIGHT_OK channel eligible_or_completed");
    }

    await sessionA.auth.signOut().catch(() => undefined);
    await sessionB.auth.signOut().catch(() => undefined);

    await ensureNextServer();
    await runChrome(accounts, publicId);

    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log("REPORT_WRITTEN");
    console.log("CONTACT_REVEAL_RESPONSIVE_AUDIT_COMPLETE");
  } finally {
    const stats = await deleteSyntheticRows(admin, cleanupIds);
    for (const id of cleanupIds) {
      await admin.auth.admin.deleteUser(id);
    }
    rmSync(accountsPath, { force: true });
    report.cleanup = true;
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(
      `CLEANUP_OK shells=${stats.shellsTouched} intros=${stats.introsRemoved}`,
    );
  }
}

main()
  .catch((error) => {
    const reason =
      error?.code === "ERR_ASSERTION"
        ? "assert"
        : error?.message
          ? "error"
          : "unknown";
    console.error("CONTACT_REVEAL_RESPONSIVE_AUDIT_FAILED", reason);
    try {
      writeFileSync(
        reportPath,
        JSON.stringify({ ...report, failed: true, failReason: reason }, null, 2),
      );
    } catch {
      // ignore
    }
    process.exitCode = 1;
  })
  .finally(() => {
    if (nextChild && !nextChild.killed) nextChild.kill();
  });
