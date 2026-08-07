/**
 * Identity Reveal media-proxy audit companion.
 *
 * Primary coverage: service-role resolve RPCs (same contract as live audit).
 * HTTP proxy: reuse/start Next, Chrome magic-callback session, then
 * page.evaluate fetch to /api/identity-reveal/media (SSR cookies).
 * Unauthenticated 401 is checked via Node fetch without cookies.
 *
 * Preview-mode browser checks also run in identity-reveal-responsive-audit.mjs.
 *
 * HARD RULES: never print emails, UUIDs, tokens, first names, or storage paths.
 *
 *   node scripts/identity-reveal-media-proxy-audit.mjs
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
const artifactDir = join(projectRoot, "audit-artifacts");
const accountsPath = join(artifactDir, "identity-reveal-audit-accounts.json");
const reportPath = join(artifactDir, "identity-reveal-media-proxy-report.json");
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

mkdirSync(artifactDir, { recursive: true });

const uploadedKeys = [];
let nextChild = null;

const report = {
  resolveAMine: false,
  resolveACounterpart: false,
  resolveBMine: false,
  resolveCNull: false,
  authResolveDenied: false,
  httpCompletedMineAsA: false,
  httpCompletedCounterpartAsA: false,
  httpUnauth401: false,
  httpAsC404: false,
  cacheControlPrivateNoStore: false,
  noSignedUrlInHttp: false,
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

function firstState(data) {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
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
  if ((outputMeta.width ?? 0) < MIN_DIM || (outputMeta.height ?? 0) < MIN_DIM) {
    throw new Error("photo_rejected");
  }
  if (buffer.byteLength > MAX_BYTES) throw new Error("photo_rejected");
  return {
    buffer,
    contentType: "image/jpeg",
    byteSize: buffer.byteLength,
    width: outputMeta.width ?? 0,
    height: outputMeta.height ?? 0,
    objectKey: `${randomHex(16)}/${randomHex(16)}.jpg`,
  };
}

async function makeRaster(size = 256) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 80, g: 120, b: 140 },
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

  assert.ifError(
    (
      await senderClient.rpc("send_anonymous_message", {
        p_public_id: publicId,
        p_body: "Pesan pertama dari pengirim untuk mengaktifkan percakapan audit.",
      })
    ).error,
  );
  assert.ifError(
    (
      await recipientClient.rpc("send_anonymous_message", {
        p_public_id: publicId,
        p_body: "Pesan balasan dari penerima agar mutual interest tersedia.",
      })
    ).error,
  );
  assert.ifError(
    (
      await senderClient.rpc("select_mutual_interest", {
        p_public_id: publicId,
      })
    ).error,
  );
  assert.ifError(
    (
      await recipientClient.rpc("select_mutual_interest", {
        p_public_id: publicId,
      })
    ).error,
  );

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
    await admin.storage
      .from(BUCKET)
      .remove(allKeys.slice(i, i + 50))
      .catch(() => undefined);
  }

  return { shellsTouched: shellIds.length, introsRemoved: introIds.length };
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
    if (/Ready in|Local:/i.test(String(chunk))) ready = true;
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

async function runHttpProxyChecks(accounts, publicId) {
  const profilePath = join(
    projectRoot,
    ".next",
    `identity-reveal-media-proxy-profile-${process.pid}`,
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
    if (result.exceptionDetails) throw new Error("evaluate failed");
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

    const loginUrl = await magicCallbackUrl(accounts.A.email, "/app");
    {
      const loaded = waitForEvent("Page.loadEventFired", sessionId);
      await send("Page.navigate", { url: loginUrl }, sessionId);
      await loaded;
      await delay(1200);
    }

    const mineUrl = `/api/identity-reveal/media?mode=completed&publicId=${publicId}&which=mine`;
    const otherUrl = `/api/identity-reveal/media?mode=completed&publicId=${publicId}&which=counterpart`;

    const mine = await evaluate(
      `(() => fetch(${JSON.stringify(mineUrl)}, { credentials: "include" }).then(async (response) => {
        const buffer = await response.arrayBuffer();
        return {
          status: response.status,
          cacheControl: response.headers.get("cache-control"),
          contentType: response.headers.get("content-type"),
          byteLength: buffer.byteLength,
        };
      }))()`,
      sessionId,
    );
    const counterpart = await evaluate(
      `(() => fetch(${JSON.stringify(otherUrl)}, { credentials: "include" }).then(async (response) => {
        const buffer = await response.arrayBuffer();
        return {
          status: response.status,
          cacheControl: response.headers.get("cache-control"),
          contentType: response.headers.get("content-type"),
          byteLength: buffer.byteLength,
        };
      }))()`,
      sessionId,
    );

    report.httpCompletedMineAsA =
      mine?.status === 200 && (mine?.byteLength ?? 0) > 0;
    report.httpCompletedCounterpartAsA =
      counterpart?.status === 200 && (counterpart?.byteLength ?? 0) > 0;
    report.cacheControlPrivateNoStore =
      typeof mine?.cacheControl === "string" &&
      /private/i.test(mine.cacheControl) &&
      /no-store/i.test(mine.cacheControl) &&
      typeof counterpart?.cacheControl === "string" &&
      /private/i.test(counterpart.cacheControl) &&
      /no-store/i.test(counterpart.cacheControl);
    report.noSignedUrlInHttp =
      typeof mine?.contentType === "string" &&
      /^image\//i.test(mine.contentType) &&
      typeof counterpart?.contentType === "string" &&
      /^image\//i.test(counterpart.contentType);

    assert.equal(report.httpCompletedMineAsA, true);
    assert.equal(report.httpCompletedCounterpartAsA, true);
    assert.equal(report.cacheControlPrivateNoStore, true);
    assert.equal(report.noSignedUrlInHttp, true);
    console.log("HTTP_OK completed_as_A");

    {
      const unauth = await fetch(`${baseUrl}${mineUrl}`, {
        redirect: "manual",
      });
      report.httpUnauth401 = unauth.status === 401;
      assert.equal(report.httpUnauth401, true);
      console.log("HTTP_OK unauth_401");
    }

    const cLogin = await magicCallbackUrl(accounts.C.email, "/app");
    const loaded = waitForEvent("Page.loadEventFired", sessionId);
    await send("Page.navigate", { url: cLogin }, sessionId);
    await loaded;
    await delay(1200);
    const asC = await evaluate(
      `(() => fetch(${JSON.stringify(mineUrl)}, { credentials: "include" }).then((response) => ({
        status: response.status,
      })))()`,
      sessionId,
    );
    report.httpAsC404 = asC?.status === 404;
    assert.equal(report.httpAsC404, true);
    console.log("HTTP_OK outsider_404");
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

  await deleteSyntheticRows(admin, cleanupIds);
  console.log("PRECLEAN_OK");

  const sessionA = await sessionFor(accounts.A.email);
  const sessionB = await sessionFor(accounts.B.email);
  const { publicId } = await openActiveMutualConversation(sessionA, sessionB);
  console.log("SEED_OK mutual_conversation");

  const photoA = await makeRaster();
  const photoB = await makeRaster();
  const versionA = await uploadAndRegister(admin, {
    publicId,
    ownerUserId: accounts.A.id,
    firstName: "AuditAlpha",
    photoBytes: photoA,
  });
  const versionB = await uploadAndRegister(admin, {
    publicId,
    ownerUserId: accounts.B.id,
    firstName: "AuditBeta",
    photoBytes: photoB,
  });

  assert.ifError(
    (
      await sessionA.rpc("select_identity_reveal", {
        p_public_id: publicId,
        p_profile_version_id: versionA,
      })
    ).error,
  );
  assert.ifError(
    (
      await sessionB.rpc("select_identity_reveal", {
        p_public_id: publicId,
        p_profile_version_id: versionB,
      })
    ).error,
  );
  console.log("SEED_OK completed_reveal");

  // Primary: resolve RPCs (service_role). Authenticated clients must fail.
  {
    const rowHasKey = (data) => Boolean(firstState(data)?.photo_object_key);
    const { data: resolveAMine, error: errAMine } = await admin.rpc(
      "resolve_identity_reveal_photo_key",
      {
        p_public_id: publicId,
        p_viewer_user_id: accounts.A.id,
        p_which: "mine",
      },
    );
    const { data: resolveAOther, error: errAOther } = await admin.rpc(
      "resolve_identity_reveal_photo_key",
      {
        p_public_id: publicId,
        p_viewer_user_id: accounts.A.id,
        p_which: "counterpart",
      },
    );
    const { data: resolveBMine, error: errBMine } = await admin.rpc(
      "resolve_identity_reveal_photo_key",
      {
        p_public_id: publicId,
        p_viewer_user_id: accounts.B.id,
        p_which: "mine",
      },
    );
    const { data: resolveC, error: errC } = await admin.rpc(
      "resolve_identity_reveal_photo_key",
      {
        p_public_id: publicId,
        p_viewer_user_id: accounts.C.id,
        p_which: "mine",
      },
    );
    const { error: authResolveError } = await sessionA.rpc(
      "resolve_identity_reveal_photo_key",
      {
        p_public_id: publicId,
        p_viewer_user_id: accounts.A.id,
        p_which: "mine",
      },
    );

    report.resolveAMine = !errAMine && rowHasKey(resolveAMine);
    report.resolveACounterpart = !errAOther && rowHasKey(resolveAOther);
    report.resolveBMine = !errBMine && rowHasKey(resolveBMine);
    report.resolveCNull = !errC && !rowHasKey(resolveC);
    report.authResolveDenied = Boolean(authResolveError);

    assert.equal(report.resolveAMine, true);
    assert.equal(report.resolveACounterpart, true);
    assert.equal(report.resolveBMine, true);
    assert.equal(report.resolveCNull, true);
    assert.equal(report.authResolveDenied, true);
    console.log("RESOLVE_OK");
  }

  await sessionA.auth.signOut().catch(() => undefined);
  await sessionB.auth.signOut().catch(() => undefined);

  await ensureNextServer();
  await runHttpProxyChecks(accounts, publicId);

  const stats = await deleteSyntheticRows(admin, cleanupIds);
  report.cleanup = true;
  console.log(
    `CLEANUP_OK shells=${stats.shellsTouched} intros=${stats.introsRemoved}`,
  );

  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("REPORT_WRITTEN");
  console.log("IDENTITY_REVEAL_MEDIA_PROXY_AUDIT_COMPLETE");
}

main()
  .catch(() => {
    console.error("IDENTITY_REVEAL_MEDIA_PROXY_AUDIT_FAILED");
    try {
      writeFileSync(reportPath, JSON.stringify({ ...report, failed: true }, null, 2));
    } catch {
      // ignore
    }
    process.exitCode = 1;
  })
  .finally(() => {
    if (nextChild && !nextChild.killed) nextChild.kill();
  });
