/**
 * Responsive screenshots + browser media-proxy checks for Identity Reveal.
 * Artifacts land under audit-artifacts/ (gitignored).
 *
 * HARD RULES: never print emails, UUIDs, tokens, first names, or storage paths.
 *
 *   node scripts/identity-reveal-responsive-audit.mjs
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
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
  "identity-reveal-audit-accounts.json",
);
const shotDir = join(
  projectRoot,
  "audit-artifacts",
  "identity-reveal-responsive",
);
const reportPath = join(
  projectRoot,
  "audit-artifacts",
  "identity-reveal-responsive-report.json",
);
const chromePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = process.env.AUDIT_BASE_URL ?? "http://localhost:3010";

/** Linked project ref only — fail closed if .env.local points elsewhere. */
const EXPECTED_PROJECT_REF = "ctbqudtvrfezuoqcecyj";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BUCKET = "identity-reveal-photos";
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_DIM = 64;
const MAX_DIM = 4096;
const OUTPUT_MAX_EDGE = 1280;

mkdirSync(shotDir, { recursive: true });
mkdirSync(join(projectRoot, "audit-artifacts"), { recursive: true });

const uploadedKeys = [];
let nextChild = null;

const report = {
  screenshots: false,
  panelVisible: false,
  noHorizontalOverflow: false,
  consoleClean: false,
  networkClean: false,
  mediaPreviewAsA: false,
  mediaUnauth401: false,
  mediaAsC404: false,
  cacheControlPrivateNoStore: false,
  preflightEligible: false,
  preflightHasProfile: false,
  preflightMutual: false,
  cleanup: false,
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

function randomHex(bytes) {
  return randomBytes(bytes).toString("hex");
}

function isKnownConsoleNoise(text) {
  const value = String(text ?? "").toLowerCase();
  if (!value) return true;
  return (
    value.includes("download the react devtools") ||
    value.includes("fast refresh") ||
    value.includes("[hmr]") ||
    value.includes("hot-update") ||
    value.includes("favicon.ico") ||
    value.includes("cursor") ||
    value.includes("net::err_aborted") ||
    value.includes("resizeobserver loop") ||
    value.includes("third-party cookie")
  );
}

function looksSensitiveNetworkPayload(text) {
  const value = String(text ?? "");
  if (!value) return false;
  if (/service_role/i.test(value)) return true;
  if (/identity-reveal-photos/i.test(value)) return true;
  if (/\/object\/sign\//i.test(value)) return true;
  if (/X-Amz-Signature|X-Amz-Credential|token=/i.test(value)) return true;
  if (/supabase\.co\/storage\/v1\/object\/sign/i.test(value)) return true;
  // Object-key shaped paths (hex/hex.ext) only when paired with storage hints.
  if (
    /storage\/v1/i.test(value) &&
    /[0-9a-f]{16,}\/[0-9a-f]{16,}\.(jpg|jpeg|png|webp)/i.test(value)
  ) {
    return true;
  }
  return false;
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
    byteSize: buffer.byteLength,
    width: outWidth,
    height: outHeight,
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

async function sessionFor(email) {
  const { env, admin, publishable } = adminBundle();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${baseUrl}/auth/callback?next=/app` },
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
  if (pidError || typeof publicId !== "string") {
    throw new Error("public id resolve failed");
  }
  assert.match(publicId, /^[0-9a-f]{32}$/);

  const { error: msgSender } = await senderClient.rpc("send_anonymous_message", {
    p_public_id: publicId,
    p_body: "Pesan pertama dari pengirim untuk mengaktifkan percakapan audit.",
  });
  if (msgSender) throw new Error("sender message failed");

  const { error: msgRecipient } = await recipientClient.rpc(
    "send_anonymous_message",
    {
      p_public_id: publicId,
      p_body: "Pesan balasan dari penerima agar mutual interest tersedia.",
    },
  );
  if (msgRecipient) throw new Error("recipient message failed");

  const { error: mutualSender } = await senderClient.rpc(
    "select_mutual_interest",
    { p_public_id: publicId },
  );
  if (mutualSender) throw new Error("mutual sender failed");

  const { error: mutualRecipient } = await recipientClient.rpc(
    "select_mutual_interest",
    { p_public_id: publicId },
  );
  if (mutualRecipient) throw new Error("mutual recipient failed");

  return { publicId };
}

async function uploadAndRegister(admin, { publicId, ownerUserId, firstName, photoBytes }) {
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
    await admin.storage
      .from(BUCKET)
      .remove([processed.objectKey])
      .catch(() => undefined);
    throw new Error("register profile failed");
  }
  return String(versionId);
}

/**
 * Cleanup safety (fail closed):
 * - ONLY deletes rows for explicitly allowlisted synthetic user IDs from
 *   identity-reveal-audit-accounts.json (created by live-identity-reveal-audit
 *   ensureAccount). Companion scripts must not invent IDs.
 * - Must NOT delete by date range alone.
 * - Must NOT empty the whole identity-reveal-photos bucket.
 * - Must NOT touch staff_members or migrations.
 * - Storage removes are limited to keys in `uploadedKeys` and/or owned by
 *   allowlisted users only.
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
    .select("photo_object_key")
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
  for (let i = 0; i < allKeys.length; i += 50) {
    const chunk = allKeys.slice(i, i + 50);
    await admin.storage
      .from(BUCKET)
      .remove(chunk)
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
  nextChild = spawn("npm", ["run", "dev", "--", "-p", port], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    windowsHide: true,
    env: { ...process.env },
  });

  let ready = false;
  const onChunk = (chunk) => {
    const text = String(chunk);
    if (/Ready in|Local:/i.test(text)) ready = true;
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
    `identity-reveal-responsive-profile-${process.pid}`,
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
    {
      stdio: ["ignore", "ignore", "inherit", "pipe", "pipe"],
      windowsHide: true,
    },
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

  responsePipe.on("data", (chunk) => {
    responseBuffer = Buffer.concat([responseBuffer, chunk]);
    let separator = responseBuffer.indexOf(0);
    while (separator !== -1) {
      const rawMessage = responseBuffer.subarray(0, separator).toString("utf8");
      responseBuffer = responseBuffer.subarray(separator + 1);
      if (rawMessage) {
        const message = JSON.parse(rawMessage);
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
              .map((arg) => arg.value ?? arg.description ?? "")
              .join(" ");
            if (!isKnownConsoleNoise(text)) consoleErrors.push("console");
          }
          if (message.method === "Runtime.exceptionThrown") {
            const text =
              message.params?.exceptionDetails?.text ??
              message.params?.exceptionDetails?.exception?.description ??
              "";
            if (!isKnownConsoleNoise(text)) consoleErrors.push("exception");
          }
          if (message.method === "Network.requestWillBeSent") {
            const url = message.params?.request?.url ?? "";
            networkHits.push(url);
            if (looksSensitiveNetworkPayload(url)) {
              responseBodies.push("sensitive-url");
            }
          }
          if (message.method === "Network.responseReceived") {
            const url = message.params?.response?.url ?? "";
            const mime = message.params?.response?.mimeType ?? "";
            const requestId = message.params?.requestId;
            networkHits.push(url);
            if (looksSensitiveNetworkPayload(url)) {
              responseBodies.push("sensitive-url");
            }
            if (
              requestId &&
              (mime.includes("javascript") ||
                mime.includes("json") ||
                mime.includes("text") ||
                mime.includes("html"))
            ) {
              requestIdsForBody.add(requestId);
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
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
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
        const index = eventWaiters.indexOf(waiter);
        if (index !== -1) {
          eventWaiters.splice(index, 1);
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
    if (result.exceptionDetails) {
      throw new Error("evaluate failed");
    }
    return result.result.value;
  }

  try {
    const { targetInfos } = await send("Target.getTargets");
    const pageTarget = targetInfos.find((target) => target.type === "page");
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

    const viewports = [
      [375, 812],
      [768, 1024],
      [1024, 768],
      [1440, 900],
    ];

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
            const panel = document.querySelector('[aria-label="Buka Identitas"]');
            if (panel) panel.scrollIntoView({ block: "center" });
            const body = document.body?.innerText ?? "";
            const html = document.documentElement?.innerHTML ?? "";
            const mutualSection = document.querySelector('[aria-label="Kenal lebih jauh"]');
            const panelVisible =
              Boolean(panel) ||
              /Buka identitas/.test(body) ||
              /Setujui Pembukaan/.test(body) ||
              /Siapkan identitas/.test(body) ||
              /Buka Identitas/.test(html);
            return {
              overflowX:
                document.documentElement.scrollWidth >
                document.documentElement.clientWidth + 1,
              bodyOverflow:
                document.body.scrollWidth >
                document.documentElement.clientWidth + 1,
              panelVisible,
              mutualVisible: /Mutual interest tercapai/.test(body),
              pathOk: /\\/app\\/messages\\/[0-9a-f]{32}/.test(location.pathname),
              mutualSiblingLabel:
                mutualSection?.nextElementSibling?.getAttribute("aria-label") ??
                null,
              mutualParentChildCount: mutualSection?.parentElement?.children?.length ?? 0,
            };
          })()`,
          sessionId,
        );
        if (metrics?.panelVisible) break;
      }

      if (metrics?.overflowX || metrics?.bodyOverflow) overflowOk = false;
      if (metrics?.panelVisible) panelOk = true;
      if (!metrics?.panelVisible) {
        console.log(
          `PANEL_MISS viewport=${width}x${height} mutual=${Boolean(metrics?.mutualVisible)}`,
        );
      }

      const screenshot = await send(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: false, fromSurface: true },
        sessionId,
      );
      const file = `messages-room-ir-${width}x${height}.png`;
      writeFileSync(join(shotDir, file), screenshot.data, "base64");
      console.log(`SHOT_OK ${file}`);
    }

    report.screenshots = true;
    report.panelVisible = panelOk;
    report.noHorizontalOverflow = overflowOk;
    assert.equal(panelOk, true, "Identity Reveal panel text missing");
    assert.equal(overflowOk, true, "horizontal overflow detected");

    // Media proxy checks while authenticated as A (preview after prepare).
    const mediaA = await evaluate(
      `(() => fetch(${JSON.stringify(`/api/identity-reveal/media?mode=preview&publicId=${publicId}`)}, { credentials: "include" }).then(async (response) => ({
        status: response.status,
        cacheControl: response.headers.get("cache-control"),
        contentType: response.headers.get("content-type"),
      })))()`,
      sessionId,
    );
    report.mediaPreviewAsA = mediaA?.status === 200;
    report.cacheControlPrivateNoStore =
      typeof mediaA?.cacheControl === "string" &&
      /private/i.test(mediaA.cacheControl) &&
      /no-store/i.test(mediaA.cacheControl);
    assert.equal(report.mediaPreviewAsA, true, "preview media as A failed");
    assert.equal(
      report.cacheControlPrivateNoStore,
      true,
      "Cache-Control missing private, no-store",
    );
    console.log("MEDIA_OK preview_as_A");

    {
      const unauth = await fetch(
        `${baseUrl}/api/identity-reveal/media?mode=preview&publicId=${publicId}`,
        { redirect: "manual" },
      );
      report.mediaUnauth401 = unauth.status === 401;
      assert.equal(report.mediaUnauth401, true, "unauth media should be 401");
      console.log("MEDIA_OK unauth_401");
    }

    const cLogin = await magicCallbackUrl(accounts.C.email, "/app");
    const loaded = waitForEvent("Page.loadEventFired", sessionId);
    await send("Page.navigate", { url: cLogin }, sessionId);
    await loaded;
    await delay(1200);

    const mediaC = await evaluate(
      `(() => fetch(${JSON.stringify(`/api/identity-reveal/media?mode=preview&publicId=${publicId}`)}, { credentials: "include" }).then(async (response) => ({
        status: response.status,
      })))()`,
      sessionId,
    );
    report.mediaAsC404 = mediaC?.status === 404;
    assert.equal(report.mediaAsC404, true, "outsider media should be 404");
    console.log("MEDIA_OK outsider_404");

    // Sample response bodies for sensitive leakage (status codes only logged).
    for (const requestId of [...requestIdsForBody].slice(0, 40)) {
      try {
        const body = await send(
          "Network.getResponseBody",
          { requestId },
          sessionId,
        );
        const text = String(body?.body ?? "");
        if (looksSensitiveNetworkPayload(text)) {
          responseBodies.push("sensitive-body");
        }
      } catch {
        // Body may be unavailable for some requests.
      }
    }

    const clientScriptLeak = await evaluate(
      `(() => {
        const scripts = [...document.querySelectorAll("script")]
          .map((node) => node.textContent || "")
          .join("\\n");
        return /service_role/i.test(scripts);
      })()`,
      sessionId,
    );

    const networkClean =
      responseBodies.length === 0 &&
      !networkHits.some((url) => looksSensitiveNetworkPayload(url)) &&
      clientScriptLeak !== true;
    const consoleClean = consoleErrors.length === 0;

    report.networkClean = networkClean;
    report.consoleClean = consoleClean;
    assert.equal(networkClean, true, "sensitive network/client payload");
    assert.equal(consoleClean, true, "unexpected console errors");
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

  assert.ok(existsSync(accountsPath), "Missing identity-reveal-audit-accounts.json");
  const accounts = JSON.parse(readFileSync(accountsPath, "utf8"));
  assert.ok(accounts.A?.email && accounts.A?.id);
  assert.ok(accounts.B?.email && accounts.B?.id);
  assert.ok(accounts.C?.email && accounts.C?.id);

  const { admin } = adminBundle();
  // Allowlist = only IDs from the accounts file created by live-identity-reveal-audit.
  const cleanupIds = [accounts.A.id, accounts.B.id, accounts.C.id];

  try {
    await deleteSyntheticRows(admin, cleanupIds);
    console.log("PRECLEAN_OK");

    const sessionA = await sessionFor(accounts.A.email);
    const sessionB = await sessionFor(accounts.B.email);
    const { publicId } = await openActiveMutualConversation(sessionA, sessionB);
    console.log("SEED_OK mutual_conversation");

    const photo = await makeRaster();
    await uploadAndRegister(admin, {
      publicId,
      ownerUserId: accounts.A.id,
      firstName: "AuditAlpha",
      photoBytes: photo,
    });
    console.log("PREPARE_OK profile_A");

    {
      const mutual = await sessionA.rpc("get_mutual_interest_state", {
        p_public_id: publicId,
      });
      const reveal = await sessionA.rpc("get_identity_reveal_state", {
        p_public_id: publicId,
      });
      const preview = await sessionA.rpc("get_identity_reveal_profile_preview", {
        p_public_id: publicId,
      });
      const mutualRow = Array.isArray(mutual.data) ? mutual.data[0] : mutual.data;
      const revealRow = Array.isArray(reveal.data) ? reveal.data[0] : reveal.data;
      const previewRow = Array.isArray(preview.data)
        ? preview.data[0]
        : preview.data;
      report.preflightMutual = mutualRow?.mutual === true;
      report.preflightEligible = revealRow?.eligible === true;
      report.preflightHasProfile =
        revealRow?.has_profile === true &&
        Boolean(previewRow?.profile_version_id) &&
        previewRow?.photo_ready === true;
      assert.equal(report.preflightMutual, true);
      assert.equal(report.preflightEligible, true);
      assert.equal(report.preflightHasProfile, true);
      console.log("PREFLIGHT_OK");
    }

    await sessionA.auth.signOut().catch(() => undefined);
    await sessionB.auth.signOut().catch(() => undefined);

    await ensureNextServer();
    await runChrome(accounts, publicId);

    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log("REPORT_WRITTEN");
    console.log("IDENTITY_REVEAL_RESPONSIVE_AUDIT_COMPLETE");
  } finally {
    const stats = await deleteSyntheticRows(admin, cleanupIds);
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
    console.error("IDENTITY_REVEAL_RESPONSIVE_AUDIT_FAILED", reason);
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
    if (nextChild && !nextChild.killed) {
      nextChild.kill();
    }
  });
