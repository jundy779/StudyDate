import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomInt } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const root = process.cwd();
const baseUrl = process.env.AUDIT_BASE_URL ?? "http://localhost:3010";
const expectedProjectRef = "ctbqudtvrfezuoqcecyj";
const artifactDir = join(root, "audit-artifacts", "account-privacy-v1");
const reportPath = join(artifactDir, "live-report.json");
const storageStatePath = join(artifactDir, "storage-state.json");
const chromePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const publishable =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

mkdirSync(artifactDir, { recursive: true });
assert.ok(url && serviceKey && publishable, "missing audit environment");
assert.equal(new URL(url).hostname.split(".")[0], expectedProjectRef);
assert.notEqual(
  String(env.STUDENT_VERIFICATION_ENABLED ?? "").toLowerCase(),
  "true",
);

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, publishable, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const users = [];
const accounts = new Map();
const storageKeys = [];
const introductionIds = [];
const conversationPublicIds = [];
const circleSlugs = [];
const eventSlugs = [];
const reportIds = [];
const deletionRequestIds = [];
const completedDeletionRequestIds = [];
const report = {
  projectVerified: true,
  verificationDisabled: true,
  settingsProjection: false,
  profileUpdate: false,
  discoverability: false,
  blockList: false,
  unblock: false,
  twoActorRls: false,
  workerAuthorization: false,
  deletionRequest: false,
  privacyLock: false,
  deletionPending: false,
  identityDeletion: false,
  contactDeletion: false,
  sharedHistoryTombstone: false,
  circlePolicy: false,
  eventPolicy: false,
  storageCleanup: false,
  moderationRetention: false,
  workerFinalization: false,
  browserStorageState: false,
  browserSettings: false,
  cleanup: false,
};
let stage = "initial";

function loadEnv() {
  const parsed = { ...process.env };
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(
    /\r?\n/,
  )) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separator = line.indexOf("=");
    parsed[line.slice(0, separator).trim()] = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return parsed;
}

function studentClient() {
  return createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function provisionStudent(kind) {
  stage = `provision_${kind}`;
  const stamp = `${Date.now()}.${randomInt(1000, 9999)}`;
  const email = `studydate.accountprivacy.${kind.toLowerCase()}.${stamp}@audit.ac.id`;
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {},
    app_metadata: {},
  });
  assert.ifError(created.error);
  assert.ok(created.data.user);
  assert.equal(created.data.user.app_metadata?.role, undefined);
  const id = created.data.user.id;
  users.push(id);

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  assert.ifError(link.error);
  assert.ok(link.data.properties?.hashed_token);
  const client = studentClient();
  const verified = await client.auth.verifyOtp({
    type: "email",
    token_hash: link.data.properties.hashed_token,
  });
  assert.ifError(verified.error);
  await delay(10_000);

  const alias = `Partner #${randomInt(100000, 999999)}`;
  const onboarded = await retryClockSkew(() =>
    client.rpc("complete_student_onboarding_v2", {
    p_public_alias: alias,
    p_first_name: `Audit${kind}`,
    p_last_name: "Sintetik",
    p_nim_ciphertext: null,
    p_nim_iv: null,
    p_nim_auth_tag: null,
    p_nim_last_four: null,
    p_nim_fingerprint: null,
    p_campus: "Universitas Indonesia",
    p_study_program: "Ilmu Komputer",
    p_degree_level: "sarjana",
    p_semester: 4,
    p_city_region: "Jakarta",
    p_short_intro: "Profil sintetis untuk audit Account dan Privacy.",
    p_interests: ["technology"],
    p_connection_goals: ["study"],
    p_online_first: true,
    p_group_first: true,
    p_verified_users_only: false,
    p_same_campus_preferred: false,
    p_cross_campus_allowed: true,
    p_policy_version: "2026-07-30",
    p_terms_accepted: true,
    p_privacy_accepted: true,
    p_community_guidelines_accepted: true,
    }),
  );
  assert.ifError(onboarded.error);
  const social = await client.rpc("upsert_my_student_social_contacts", {
    p_linkedin_url: `https://www.linkedin.com/in/studydate-accountprivacy-${kind.toLowerCase()}-${stamp.replaceAll(".", "-")}`,
    p_instagram_username: null,
  });
  assert.ifError(social.error);
  assert.ifError(
    (
      await client.rpc("set_people_discovery_visibility", {
        p_is_discoverable: true,
      })
    ).error,
  );
  const account = { kind, id, email, alias, client };
  accounts.set(id, account);
  return account;
}

function allowedKeys(rows, keys) {
  const allowed = new Set(keys);
  assert.equal(
    rows.every((row) => Object.keys(row).every((key) => allowed.has(key))),
    true,
  );
}

function noPrivateProjection(value, ids = users) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /nim|legal|first_name|last_name|email|cipher|auth_tag|key_version|storage|object_key|retry_count|failure_code|lease_token|blocked_id|blocker_id/i,
  );
  for (const id of ids) assert.equal(serialized.includes(id), false);
  assert.doesNotMatch(
    serialized,
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  );
}

async function expectDenied(resultPromise) {
  const result = await resultPromise;
  assert.ok(result.error);
}

async function retryClockSkew(operation) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await operation();
    if (!result.error || result.error.message !== "JWT issued at future") {
      return result;
    }
    await delay(5_000);
  }
  return operation();
}

async function completedIdentity(adminClient, a, b, publicId) {
  const image = await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 3,
      background: { r: 1, g: 79, b: 231 },
    },
  })
    .jpeg()
    .toBuffer();
  for (const account of [a, b]) {
    const key = `${randomBytes(16).toString("hex")}/${randomBytes(16).toString("hex")}.jpg`;
    storageKeys.push(key);
    assert.ifError(
      (
        await adminClient.storage
          .from("identity-reveal-photos")
          .upload(key, image, {
            contentType: "image/jpeg",
            upsert: false,
          })
      ).error,
    );
    const version = await adminClient.rpc(
      "register_identity_reveal_profile_version",
      {
        p_public_id: publicId,
        p_owner_user_id: account.id,
        p_first_name: `Reveal${account.kind}`,
        p_photo_object_key: key,
        p_photo_content_type: "image/jpeg",
        p_photo_byte_size: image.byteLength,
        p_photo_width: 128,
        p_photo_height: 128,
      },
    );
    assert.ifError(version.error);
    assert.ifError(
      (
        await account.client.rpc("select_identity_reveal", {
          p_public_id: publicId,
          p_profile_version_id: version.data,
        })
      ).error,
    );
  }
}

async function completedContacts(adminClient, a, b, publicId) {
  for (const channel of ["telegram", "instagram", "linkedin"]) {
    for (const account of [a, b]) {
      const version = await adminClient.rpc("register_contact_reveal_version", {
        p_public_id: publicId,
        p_owner_user_id: account.id,
        p_channel: channel,
        p_contact_ciphertext: `\\x${randomBytes(32).toString("hex")}`,
        p_contact_iv: `\\x${randomBytes(12).toString("hex")}`,
        p_contact_auth_tag: `\\x${randomBytes(16).toString("hex")}`,
        p_encryption_key_version: 1,
      });
      assert.ifError(version.error);
      assert.ifError(
        (
          await account.client.rpc("select_contact_reveal", {
            p_public_id: publicId,
            p_channel: channel,
            p_contact_version_id: version.data,
          })
        ).error,
      );
    }
  }
}

function localParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

async function createFixtureBrowserState(account, nextPath = "/app/settings") {
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--remote-debugging-pipe",
      `--user-data-dir=${join(root, ".next", `account-privacy-live-${process.pid}`)}`,
      "about:blank",
    ],
    {
      stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const input = chrome.stdio[3];
  const output = chrome.stdio[4];
  const pending = new Map();
  let sequence = 0;
  let buffer = Buffer.alloc(0);
  output.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    let separator = buffer.indexOf(0);
    while (separator >= 0) {
      const raw = buffer.subarray(0, separator).toString("utf8");
      buffer = buffer.subarray(separator + 1);
      if (raw) {
        const message = JSON.parse(raw);
        const waiter = pending.get(message.id);
        if (waiter) {
          pending.delete(message.id);
          if (message.error) {
            waiter.reject(new Error("browser command failed"));
          } else {
            waiter.resolve(message.result);
          }
        }
      }
      separator = buffer.indexOf(0);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      input.write(
        `${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`,
      );
    });
  try {
    const targets = await send("Target.getTargets");
    const page = targets.targetInfos.find((candidate) => candidate.type === "page");
    assert.ok(page);
    const attached = await send("Target.attachToTarget", {
      targetId: page.targetId,
      flatten: true,
    });
    const sessionId = attached.sessionId;
    await send("Page.enable", {}, sessionId);
    await send("Network.enable", {}, sessionId);
    const session = await account.client.auth.getSession();
    assert.ifError(session.error);
    assert.ok(session.data.session);
    const sessionCookie = `base64-${Buffer.from(
      JSON.stringify(session.data.session),
    ).toString("base64url")}`;
    await send(
      "Network.setCookie",
      {
        name: `sb-${expectedProjectRef}-auth-token`,
        value: sessionCookie,
        url: baseUrl,
        secure: baseUrl.startsWith("https:"),
        httpOnly: false,
        sameSite: "Lax",
      },
      sessionId,
    );
    await send("Page.navigate", { url: `${baseUrl}${nextPath}` }, sessionId);
    await delay(2500);
    const cookies = await send("Network.getAllCookies", {}, sessionId);
    const origin = new URL(baseUrl);
    const safeCookies = cookies.cookies
      .filter((cookie) => cookie.domain.replace(/^\./, "") === origin.hostname)
      .map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
      }));
    assert.ok(safeCookies.length > 0);
    writeFileSync(
      storageStatePath,
      JSON.stringify({ cookies: safeCookies }),
      "utf8",
    );
    return true;
  } finally {
    chrome.kill();
  }
}

async function checkDeletionPendingBrowser(account) {
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--remote-debugging-pipe",
      `--user-data-dir=${join(root, ".next", `account-privacy-pending-${process.pid}`)}`,
      "about:blank",
    ],
    {
      stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const input = chrome.stdio[3];
  const output = chrome.stdio[4];
  const pending = new Map();
  let sequence = 0;
  let buffer = Buffer.alloc(0);
  output.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    let separator = buffer.indexOf(0);
    while (separator >= 0) {
      const raw = buffer.subarray(0, separator).toString("utf8");
      buffer = buffer.subarray(separator + 1);
      if (raw) {
        const message = JSON.parse(raw);
        const waiter = pending.get(message.id);
        if (waiter) {
          pending.delete(message.id);
          if (message.error) {
            waiter.reject(new Error("browser command failed"));
          } else {
            waiter.resolve(message.result);
          }
        }
      }
      separator = buffer.indexOf(0);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      input.write(
        `${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`,
      );
    });
  try {
    const targets = await send("Target.getTargets");
    const page = targets.targetInfos.find((candidate) => candidate.type === "page");
    assert.ok(page);
    const attached = await send("Target.attachToTarget", {
      targetId: page.targetId,
      flatten: true,
    });
    const sessionId = attached.sessionId;
    await send("Page.enable", {}, sessionId);
    await send("Runtime.enable", {}, sessionId);
    await send("Network.enable", {}, sessionId);
    const session = await account.client.auth.getSession();
    assert.ifError(session.error);
    assert.ok(session.data.session);
    await send(
      "Network.setCookie",
      {
        name: `sb-${expectedProjectRef}-auth-token`,
        value: `base64-${Buffer.from(
          JSON.stringify(session.data.session),
        ).toString("base64url")}`,
        url: baseUrl,
        secure: baseUrl.startsWith("https:"),
        httpOnly: false,
        sameSite: "Lax",
      },
      sessionId,
    );
    await send("Page.navigate", { url: `${baseUrl}/app` }, sessionId);
    let pageState = null;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await delay(500);
      const evaluated = await send(
        "Runtime.evaluate",
        {
          returnByValue: true,
          expression: `(() => ({
            path: location.pathname,
            text: document.body?.innerText ?? "",
            html: document.documentElement?.innerHTML ?? "",
          }))()`,
        },
        sessionId,
      );
      pageState = evaluated.result.value;
      if (
        pageState.path === "/account/deletion-pending" &&
        pageState.text.includes("Permintaan penghapusan diterima")
      ) {
        break;
      }
    }
    assert.equal(pageState?.path, "/account/deletion-pending");
    assert.match(
      pageState.text,
      /Permintaan penghapusan diterima/,
    );
    assert.doesNotMatch(
      pageState.html,
      /retry_count|failure_code|lease_token|object_key|storage_cleanup|sb_secret_|access_token|refresh_token/i,
    );
    return true;
  } finally {
    chrome.kill();
  }
}

async function runResponsiveSettingsAudit() {
  const storageState = readFileSync(storageStatePath, "utf8");
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/account-privacy-responsive-audit.mjs"],
      {
        cwd: root,
        stdio: ["ignore", "inherit", "inherit"],
        windowsHide: true,
        env: {
          ...process.env,
          AUDIT_BASE_URL: baseUrl,
          ACCOUNT_PRIVACY_AUDIT_URL: `${baseUrl}/app/settings`,
          ACCOUNT_PRIVACY_AUDIT_STORAGE_STATE: storageState,
        },
      },
    );
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("responsive audit failed")),
    );
  });
  return true;
}

async function createBrowserOnlyFixture() {
  const account = await provisionStudent("Browser");
  report.browserStorageState = await createFixtureBrowserState(account);
  report.browserSettings = await runResponsiveSettingsAudit();
  report.cleanup = await cleanupExactIds([account.id]);
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  process.stdout.write(
    report.browserStorageState && report.browserSettings && report.cleanup
      ? "ACCOUNT_PRIVACY_BROWSER_AUDIT_COMPLETE\n"
      : "ACCOUNT_PRIVACY_BROWSER_AUDIT_FAILED\n",
  );
  process.exit(
    report.browserStorageState && report.browserSettings && report.cleanup
      ? 0
      : 1,
  );
}

async function finalizeSyntheticDeletion(id) {
  const request = await admin
    .from("account_deletion_requests")
    .select("id,status,lease_token,lease_expires_at,database_cleanup_at")
    .eq("user_id", id)
    .maybeSingle();
  if (request.error || !request.data) return !request.error;
  if (request.data.status === "completed") return true;

  let job = null;
  if (
    request.data.status === "processing" &&
    request.data.lease_token &&
    new Date(request.data.lease_expires_at).getTime() > Date.now()
  ) {
    job = {
      request_id: request.data.id,
      user_id: id,
      lease_token: request.data.lease_token,
    };
  } else {
    const claim = await admin.rpc("claim_account_deletion_job_by_id", {
      p_request_id: request.data.id,
    });
    if (claim.error || !claim.data?.[0]) return false;
    job = claim.data[0];
  }

  if (!request.data.database_cleanup_at) {
    const inventory = await admin.rpc("list_account_deletion_storage_objects", {
      p_request_id: job.request_id,
      p_lease_token: job.lease_token,
    });
    if (inventory.error) return false;
    const grouped = new Map();
    for (const object of inventory.data ?? []) {
      const values = grouped.get(object.bucket_name) ?? [];
      values.push(object.object_key);
      grouped.set(object.bucket_name, values);
    }
    for (const [bucket, objects] of grouped) {
      if ((await admin.storage.from(bucket).remove(objects)).error) return false;
    }
    const cleanup = await admin.rpc("cleanup_account_deletion_database", {
      p_request_id: job.request_id,
      p_lease_token: job.lease_token,
    });
    if (cleanup.error) return false;
  }

  const deleted = await admin.auth.admin.deleteUser(id);
  if (deleted.error && !/not found/i.test(deleted.error.message)) return false;
  const completed = await admin.rpc("complete_account_deletion_job", {
    p_request_id: job.request_id,
    p_lease_token: job.lease_token,
  });
  if (!completed.error) completedDeletionRequestIds.push(job.request_id);
  return !completed.error;
}

async function cleanupExactIds(ids) {
  let ok = true;
  for (const id of ids) {
    ok = (await finalizeSyntheticDeletion(id)) && ok;
  }
  if (reportIds.length) {
    ok =
      !(
        await admin.from("user_reports").delete().in("id", reportIds)
      ).error && ok;
  }
  for (const slug of circleSlugs) {
    ok =
      !(
        await admin.from("study_circles").delete().eq("public_slug", slug)
      ).error && ok;
  }
  for (const slug of eventSlugs) {
    ok =
      !(
        await admin.from("campus_events").delete().eq("public_slug", slug)
      ).error && ok;
  }
  for (const publicId of conversationPublicIds) {
    ok =
      !(
        await admin
          .from("conversation_shells")
          .delete()
          .eq("public_id", publicId)
      ).error && ok;
  }
  if (introductionIds.length) {
    ok =
      !(
        await admin
          .from("introduction_requests")
          .delete()
          .in("id", introductionIds)
      ).error && ok;
  }
  if (deletionRequestIds.length) {
    ok =
      !(
        await admin
          .from("account_deletion_requests")
          .delete()
          .in("id", deletionRequestIds)
      ).error && ok;
  }
  if (completedDeletionRequestIds.length) {
    ok =
      !(
        await admin
          .from("account_deletion_requests")
          .delete()
          .in("id", completedDeletionRequestIds)
      ).error && ok;
  }
  for (const id of ids) {
    const profile = await admin
      .from("profiles")
      .select("user_id")
      .eq("user_id", id)
      .maybeSingle();
    const user = await admin.auth.admin.getUserById(id);
    if (!user.data.user) continue;
    if (profile.data) {
      const requested = await accounts
        .get(id)
        ?.client.rpc("request_my_student_account_deletion");
      if (requested && !requested.error) {
        ok = (await finalizeSyntheticDeletion(id)) && ok;
        continue;
      }
    }
    const deleted = await admin.auth.admin.deleteUser(id);
    ok = ok && !deleted.error;
  }
  if (storageKeys.length) {
    const removed = await admin.storage
      .from("identity-reveal-photos")
      .remove(storageKeys);
    ok = ok && !removed.error;
  }
  return ok;
}

if (process.argv.includes("--browser-only")) {
  await createBrowserOnlyFixture();
}

try {
  const [a, b, d] = await Promise.all([
    provisionStudent("A"),
    provisionStudent("B"),
    provisionStudent("D"),
  ]);

  stage = "settings_projection";
  const selfProjection = await a.client
    .from("profiles")
    .select(
      "public_alias,campus,study_program,degree_level,semester,city_region,short_intro,interests,connection_goals,avatar_mascot,is_discoverable,verification_status",
    )
    .eq("user_id", a.id)
    .single();
  assert.ifError(selfProjection.error);
  allowedKeys([selfProjection.data], [
    "public_alias",
    "campus",
    "study_program",
    "degree_level",
    "semester",
    "city_region",
    "short_intro",
    "interests",
    "connection_goals",
    "avatar_mascot",
    "is_discoverable",
    "verification_status",
  ]);
  noPrivateProjection(selfProjection.data, [b.id, d.id]);
  const bReadsA = await b.client
    .from("profiles")
    .select("public_alias")
    .eq("user_id", a.id);
  assert.equal(bReadsA.data?.length ?? 0, 0);
  report.settingsProjection = true;

  stage = "profile_update";
  const originalAlias = selfProjection.data.public_alias;
  const update = await a.client.rpc("update_my_student_profile_settings", {
    p_campus: "Universitas Indonesia",
    p_study_program: "Ilmu Komputer",
    p_degree_level: "sarjana",
    p_semester: 5,
    p_city_region: "Depok",
    p_short_intro: "Profil sintetis yang diperbarui untuk audit.",
    p_interests: ["technology", "research"],
    p_connection_goals: ["study", "collaboration"],
    p_avatar_mascot: "study",
    p_is_discoverable: true,
  });
  assert.ifError(update.error);
  await expectDenied(
    a.client.rpc("update_my_student_profile_settings", {
      p_campus: "Kampus Tidak Disetujui",
      p_study_program: "Ilmu Komputer",
      p_degree_level: "sarjana",
      p_semester: 5,
      p_city_region: "Depok",
      p_short_intro: "Invalid campus audit.",
      p_interests: ["technology"],
      p_connection_goals: ["study"],
      p_avatar_mascot: "study",
      p_is_discoverable: true,
    }),
  );
  await expectDenied(
    a.client.rpc("update_my_student_profile_settings", {
      p_campus: "Universitas Indonesia",
      p_study_program: "Ilmu Komputer",
      p_degree_level: "sarjana",
      p_semester: 17,
      p_city_region: "Depok",
      p_short_intro: "Invalid semester audit.",
      p_interests: ["technology"],
      p_connection_goals: ["study"],
      p_avatar_mascot: "study",
      p_is_discoverable: true,
    }),
  );
  const forged = await a.client
    .from("profiles")
    .update({
      public_alias: b.alias,
      verification_status: "verified",
      first_name: "Forged",
    })
    .eq("user_id", b.id);
  assert.ok(forged.error);
  const aAfter = await admin
    .from("profiles")
    .select("public_alias,semester")
    .eq("user_id", a.id)
    .single();
  assert.equal(aAfter.data.public_alias, originalAlias);
  assert.equal(aAfter.data.semester, 5);
  report.profileUpdate = true;

  stage = "discoverability";
  const visibleBefore = await b.client.rpc("get_people_discovery_profile", {
    p_public_alias: a.alias,
  });
  assert.equal(visibleBefore.data?.length, 1);
  const intro = await a.client.rpc("send_introduction_request", {
    p_recipient_alias: b.alias,
    p_opening_message:
      "Halo, ini perkenalan sintetis untuk audit Account dan Privacy.",
  });
  assert.ifError(intro.error);
  introductionIds.push(intro.data);
  assert.ifError(
    (
      await b.client.rpc("accept_introduction_request", {
        p_request_id: intro.data,
      })
    ).error,
  );
  const shell = await a.client.rpc(
    "get_conversation_public_id_for_introduction",
    { p_request_id: intro.data },
  );
  assert.ifError(shell.error);
  conversationPublicIds.push(shell.data);
  assert.ifError(
    (
      await a.client.rpc("send_anonymous_message", {
        p_public_id: shell.data,
        p_body: "Pesan sintetis dari A.",
        p_idempotency_key: "accountprivacy-a-0001",
      })
    ).error,
  );
  assert.ifError(
    (
      await b.client.rpc("send_anonymous_message", {
        p_public_id: shell.data,
        p_body: "Pesan sintetis dari B.",
        p_idempotency_key: "accountprivacy-b-0001",
      })
    ).error,
  );
  assert.ifError(
    (
      await a.client.rpc("set_people_discovery_visibility", {
        p_is_discoverable: false,
      })
    ).error,
  );
  const hiddenList = await b.client.rpc("list_people_discovery_profiles", {
    p_limit: 13,
  });
  const hiddenDetail = await b.client.rpc("get_people_discovery_profile", {
    p_public_alias: a.alias,
  });
  assert.equal(
    hiddenList.data.some((row) => row.public_alias === a.alias),
    false,
  );
  assert.equal(hiddenDetail.data.length, 0);
  assert.equal(
    (
      await admin
        .from("conversation_shells")
        .select("*", { count: "exact", head: true })
        .or(
          `participant_sender_id.eq.${a.id},participant_recipient_id.eq.${a.id}`,
        )
    ).count,
    1,
  );
  assert.ifError(
    (
      await a.client.rpc("set_people_discovery_visibility", {
        p_is_discoverable: true,
      })
    ).error,
  );
  report.discoverability = true;

  stage = "block_list";
  assert.ifError(
    (
      await a.client.rpc("block_student_by_alias", {
        p_alias: b.alias,
      })
    ).error,
  );
  const blocksA = await a.client.rpc("list_my_blocked_students");
  const blocksB = await b.client.rpc("list_my_blocked_students");
  assert.ifError(blocksA.error);
  assert.ifError(blocksB.error);
  assert.equal(blocksA.data.length, 1);
  assert.equal(blocksB.data.length, 0);
  allowedKeys(blocksA.data, [
    "public_alias",
    "campus",
    "study_program",
    "semester",
    "avatar_mascot",
    "blocked_at",
  ]);
  noPrivateProjection(blocksA.data);
  report.blockList = true;

  stage = "browser_state";
  report.browserStorageState = await createFixtureBrowserState(a);
  try {
    report.browserSettings = await runResponsiveSettingsAudit();
  } catch {
    report.browserSettings = false;
  }

  stage = "unblock";
  try {
    const beforeUnblock = await admin
      .from("conversation_shells")
      .select("*", { count: "exact", head: true })
      .or(
        `participant_sender_id.eq.${a.id},participant_recipient_id.eq.${a.id}`,
      );
    assert.equal(
      (
        await a.client.rpc("unblock_my_blocked_student", {
          p_public_alias: b.alias,
        })
      ).data,
      true,
    );
    assert.equal(
      (
        await a.client.rpc("unblock_my_blocked_student", {
          p_public_alias: b.alias,
        })
      ).data,
      false,
    );
    assert.equal(
      (
        await admin
          .from("conversation_shells")
          .select("*", { count: "exact", head: true })
          .or(
            `participant_sender_id.eq.${a.id},participant_recipient_id.eq.${a.id}`,
          )
      ).count,
      beforeUnblock.count,
    );
    report.unblock = true;
  } catch {
    report.unblock = false;
  }

  stage = "full_reveal_fixture";
  const revealIntro = await d.client.rpc("send_introduction_request", {
    p_recipient_alias: b.alias,
    p_opening_message:
      "Halo, ini relasi sintetis khusus audit lifecycle penghapusan.",
  });
  assert.ifError(revealIntro.error);
  introductionIds.push(revealIntro.data);
  assert.ifError(
    (
      await b.client.rpc("accept_introduction_request", {
        p_request_id: revealIntro.data,
      })
    ).error,
  );
  const revealShell = await d.client.rpc(
    "get_conversation_public_id_for_introduction",
    { p_request_id: revealIntro.data },
  );
  assert.ifError(revealShell.error);
  conversationPublicIds.push(revealShell.data);
  for (const [account, body, key] of [
    [d, "Pesan sintetis D untuk aktivasi.", "accountprivacy-d-0001"],
    [b, "Pesan sintetis B untuk aktivasi.", "accountprivacy-b-0002"],
  ]) {
    assert.ifError(
      (
        await account.client.rpc("send_anonymous_message", {
          p_public_id: revealShell.data,
          p_body: body,
          p_idempotency_key: key,
        })
      ).error,
    );
  }
  for (const account of [d, b]) {
    assert.ifError(
      (
        await account.client.rpc("select_mutual_interest", {
          p_public_id: revealShell.data,
        })
      ).error,
    );
  }
  await completedIdentity(admin, d, b, revealShell.data);
  await completedContacts(admin, d, b, revealShell.data);

  const circle = await d.client.rpc("create_study_circle", {
    p_name: "Audit Privacy Circle",
    p_description:
      "Circle sintetis untuk audit tombstone dan lifecycle penghapusan akun.",
    p_topic: "coding",
    p_scope: "open",
    p_member_limit: 8,
  });
  assert.ifError(circle.error);
  circleSlugs.push(circle.data);
  assert.ifError(
    (
      await b.client.rpc("join_study_circle", {
        p_public_slug: circle.data,
      })
    ).error,
  );
  assert.ifError(
    (
      await d.client.rpc("send_study_circle_message", {
        p_public_slug: circle.data,
        p_body: "Pesan historis dari owner yang akan dihapus.",
        p_idempotency_key: "accountprivacy-circle-d-0001",
      })
    ).error,
  );

  const start = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const event = await d.client.rpc("create_campus_event", {
    p_title: "Audit Privacy Event",
    p_description:
      "Event sintetis untuk audit pembatalan dan tombstone organizer.",
    p_category: "study_together",
    p_scope: "open",
    p_starts_at_local: localParts(start),
    p_ends_at_local: localParts(end),
    p_timezone_name: "Asia/Jakarta",
    p_venue_category: "campus_public_area",
    p_venue_name: "Plaza Kampus",
    p_venue_area: "Area terbuka dekat perpustakaan utama",
    p_city: "Jakarta",
    p_capacity: 8,
    p_confirms_public_place: true,
    p_confirms_expected_operating: true,
    p_confirms_not_private_residence: true,
    p_confirms_no_private_location_disclosure: true,
  });
  assert.ifError(event.error);
  eventSlugs.push(event.data);
  assert.ifError(
    (
      await b.client.rpc("rsvp_campus_event", {
        p_public_slug: event.data,
      })
    ).error,
  );
  assert.ifError(
    (
      await b.client.rpc("report_campus_event_organizer", {
        p_public_slug: event.data,
        p_reason_code: "other",
        p_details: "Laporan sintetis aktif untuk audit retensi.",
      })
    ).error,
  );
  const eventInternalForReport = await admin
    .from("campus_events")
    .select("id")
    .eq("public_slug", event.data)
    .single();
  assert.ifError(eventInternalForReport.error);
  const createdReport = await admin
    .from("user_reports")
    .select("id")
    .eq("reporter_id", b.id)
    .eq("subject_user_id", d.id)
    .eq("campus_event_id", eventInternalForReport.data.id)
    .eq("campus_event_target_kind", "event_organizer")
    .single();
  assert.ifError(createdReport.error);
  reportIds.push(createdReport.data.id);

  stage = "two_actor_rls";
  for (const operation of [
    b.client.from("profiles").update({ semester: 9 }).eq("user_id", d.id),
    b.client.from("account_deletion_requests").select("*"),
    b.client.from("account_deletion_requests").insert({ user_id: d.id }),
    b.client
      .from("account_deletion_requests")
      .update({ status: "completed", retry_count: 99 })
      .eq("user_id", d.id),
    b.client.rpc("claim_account_deletion_job"),
    b.client.rpc("claim_account_deletion_job_by_id", {
      p_request_id: d.id,
    }),
    anon.rpc("get_my_account_deletion_status"),
    anon.rpc("request_my_student_account_deletion"),
  ]) {
    await expectDenied(operation);
  }
  report.twoActorRls = true;
  report.workerAuthorization = true;

  stage = "deletion_request";
  const deletion = await d.client.rpc("request_my_student_account_deletion");
  assert.ifError(deletion.error);
  assert.equal(deletion.data[0].status, "pending");
  const retry = await d.client.rpc("request_my_student_account_deletion");
  assert.ifError(retry.error);
  assert.equal(retry.data[0].requested_at, deletion.data[0].requested_at);
  const internalProfile = await admin
    .from("profiles")
    .select("is_discoverable,deactivated_at")
    .eq("user_id", d.id)
    .single();
  assert.equal(internalProfile.data.is_discoverable, false);
  assert.ok(internalProfile.data.deactivated_at);
  report.deletionRequest = true;

  stage = "privacy_lock";
  const deniedMutations = [
    d.client.rpc("set_people_discovery_visibility", {
      p_is_discoverable: true,
    }),
    d.client.rpc("update_my_student_profile_settings", {
      p_campus: "Universitas Indonesia",
      p_study_program: "Ilmu Komputer",
      p_degree_level: "sarjana",
      p_semester: 6,
      p_city_region: "Jakarta",
      p_short_intro: "Harus ditolak.",
      p_interests: ["technology"],
      p_connection_goals: ["study"],
      p_avatar_mascot: "front",
      p_is_discoverable: false,
    }),
    d.client.rpc("upsert_my_student_social_contacts", {
      p_linkedin_url: "https://www.linkedin.com/in/should-be-denied",
      p_instagram_username: null,
    }),
    d.client.rpc("complete_student_onboarding_v2", {
      p_public_alias: d.alias,
      p_first_name: "Race",
      p_last_name: "Denied",
      p_nim_ciphertext: null,
      p_nim_iv: null,
      p_nim_auth_tag: null,
      p_nim_last_four: null,
      p_nim_fingerprint: null,
      p_campus: "Universitas Indonesia",
      p_study_program: "Ilmu Komputer",
      p_degree_level: "sarjana",
      p_semester: 4,
      p_city_region: "Jakarta",
      p_short_intro: "Race harus ditolak.",
      p_interests: ["technology"],
      p_connection_goals: ["study"],
      p_online_first: true,
      p_group_first: true,
      p_verified_users_only: false,
      p_same_campus_preferred: false,
      p_cross_campus_allowed: true,
      p_policy_version: "2026-07-30",
      p_terms_accepted: true,
      p_privacy_accepted: true,
      p_community_guidelines_accepted: true,
    }),
    d.client.rpc("send_anonymous_message", {
      p_public_id: revealShell.data,
      p_body: "Harus ditolak.",
      p_idempotency_key: "accountprivacy-d-denied",
    }),
    d.client.rpc("select_mutual_interest", {
      p_public_id: revealShell.data,
    }),
    d.client.rpc("create_study_circle", {
      p_name: "Harus Ditolak",
      p_description: "Circle baru setelah deletion lock harus ditolak.",
      p_topic: "general",
      p_scope: "open",
      p_member_limit: 5,
    }),
    d.client.rpc("send_study_circle_message", {
      p_public_slug: circle.data,
      p_body: "Harus ditolak.",
      p_idempotency_key: "accountprivacy-circle-denied",
    }),
    d.client.rpc("create_campus_event", {
      p_title: "Harus Ditolak",
      p_description: "Event baru setelah deletion lock harus ditolak.",
      p_category: "study_together",
      p_scope: "open",
      p_starts_at_local: localParts(start),
      p_ends_at_local: localParts(end),
      p_timezone_name: "Asia/Jakarta",
      p_venue_category: "campus_public_area",
      p_venue_name: "Plaza Kampus",
      p_venue_area: "Area terbuka dekat perpustakaan utama",
      p_city: "Jakarta",
      p_capacity: 8,
      p_confirms_public_place: true,
      p_confirms_expected_operating: true,
      p_confirms_not_private_residence: true,
      p_confirms_no_private_location_disclosure: true,
    }),
  ];
  for (const operation of deniedMutations) await expectDenied(operation);
  const bNewIntro = await b.client.rpc("send_introduction_request", {
    p_recipient_alias: d.alias,
    p_opening_message: "Target deletion lock harus ditolak.",
  });
  assert.ok(bNewIntro.error);
  report.privacyLock = true;

  stage = "suppression";
  const identityLocked = await b.client.rpc("get_completed_identity_reveal", {
    p_public_id: revealShell.data,
  });
  assert.ifError(identityLocked.error);
  assert.equal(identityLocked.data[0].completed, false);
  assert.equal(identityLocked.data[0].counterpart_first_name, null);
  const mediaLocked = await admin.rpc("resolve_identity_reveal_photo_key", {
    p_public_id: revealShell.data,
    p_viewer_user_id: b.id,
    p_which: "counterpart",
  });
  assert.ifError(mediaLocked.error);
  assert.equal(mediaLocked.data.length, 0);
  report.identityDeletion = true;
  for (const channel of ["telegram", "instagram", "linkedin"]) {
    const contactLocked = await admin.rpc(
      "get_completed_contact_reveal_cipher",
      {
        p_public_id: revealShell.data,
        p_viewer_user_id: b.id,
        p_channel: channel,
      },
    );
    assert.ifError(contactLocked.error);
    assert.equal(contactLocked.data[0].completed, false);
    assert.equal(contactLocked.data[0].counterpart_ciphertext, null);
  }
  report.contactDeletion = true;

  stage = "deletion_pending_browser";
  report.deletionPending = await checkDeletionPendingBrowser(d);

  stage = "claim_exact_job";
  const request = await admin
    .from("account_deletion_requests")
    .select("id")
    .eq("user_id", d.id)
    .single();
  assert.ifError(request.error);
  deletionRequestIds.push(request.data.id);
  const claim = await admin.rpc("claim_account_deletion_job_by_id", {
    p_request_id: request.data.id,
  });
  assert.ifError(claim.error);
  assert.equal(claim.data.length, 1);
  const job = claim.data[0];

  const inventory = await admin.rpc("list_account_deletion_storage_objects", {
    p_request_id: job.request_id,
    p_lease_token: job.lease_token,
  });
  assert.ifError(inventory.error);
  assert.equal(
    inventory.data.every((item) =>
      ["identity-reveal-photos", "student-verification-evidence"].includes(
        item.bucket_name,
      ),
    ),
    true,
  );
  const dStorageKeys = new Set(
    inventory.data
      .filter((item) => item.bucket_name === "identity-reveal-photos")
      .map((item) => item.object_key),
  );
  assert.ok(dStorageKeys.size > 0);
  assert.equal(storageKeys.some((key) => !dStorageKeys.has(key)), true);
  const grouped = new Map();
  for (const object of inventory.data) {
    const values = grouped.get(object.bucket_name) ?? [];
    values.push(object.object_key);
    grouped.set(object.bucket_name, values);
  }
  for (const [bucket, objects] of grouped) {
    assert.ifError((await admin.storage.from(bucket).remove(objects)).error);
  }
  const retainedCounterpart = storageKeys.find((key) => !dStorageKeys.has(key));
  assert.ok(retainedCounterpart);
  assert.ifError(
    (
      await admin.storage
        .from("identity-reveal-photos")
        .download(retainedCounterpart)
    ).error,
  );
  report.storageCleanup = true;

  stage = "database_cleanup";
  assert.ifError(
    (
      await admin.rpc("cleanup_account_deletion_database", {
        p_request_id: job.request_id,
        p_lease_token: job.lease_token,
      })
    ).error,
  );
  const circleInternal = await admin
    .from("study_circles")
    .select("status,owner_user_id")
    .eq("public_slug", circle.data)
    .single();
  const eventInternal = await admin
    .from("campus_events")
    .select("status,organizer_user_id")
    .eq("public_slug", event.data)
    .single();
  assert.equal(circleInternal.data.status, "archived");
  assert.equal(circleInternal.data.owner_user_id, d.id);
  assert.equal(eventInternal.data.status, "cancelled");
  assert.equal(eventInternal.data.organizer_user_id, d.id);
  report.circlePolicy = true;
  report.eventPolicy = true;

  const activeReport = await admin
    .from("user_reports")
    .select("moderation_status,account_deletion_request_id")
    .eq("subject_user_id", d.id)
    .eq("moderation_status", "submitted")
    .single();
  assert.ifError(activeReport.error);
  assert.equal(activeReport.data.account_deletion_request_id, request.data.id);
  const policy = await admin
    .from("account_privacy_policy")
    .select("moderation_retention_days,security_audit_retention_days")
    .single();
  assert.deepEqual(policy.data, {
    moderation_retention_days: 180,
    security_audit_retention_days: 180,
  });
  report.moderationRetention = true;

  stage = "auth_last";
  assert.ifError((await admin.auth.admin.deleteUser(d.id)).error);
  assert.ifError(
    (
      await admin.rpc("complete_account_deletion_job", {
        p_request_id: job.request_id,
        p_lease_token: job.lease_token,
      })
    ).error,
  );
  completedDeletionRequestIds.push(request.data.id);
  report.workerFinalization = true;

  stage = "tombstones";
  const conversations = await b.client.rpc("list_my_conversations", {
    p_limit: 30,
  });
  assert.ifError(conversations.error);
  assert.equal(
    conversations.data.some(
      (row) =>
        row.public_id === revealShell.data &&
        row.counterpart_alias === "Akun dihapus",
    ),
    true,
  );
  const circleMessages = await b.client.rpc("list_study_circle_messages", {
    p_public_slug: circle.data,
    p_limit: 51,
  });
  assert.ifError(circleMessages.error);
  assert.equal(
    circleMessages.data.some(
      (row) =>
        row.author_alias === "Akun dihapus" &&
        row.body === "Pesan historis dari owner yang akan dihapus.",
    ),
    true,
  );
  const members = await b.client.rpc("list_study_circle_members", {
    p_public_slug: circle.data,
  });
  assert.ifError(members.error);
  assert.equal(
    members.data.some((row) => row.public_alias === "Akun dihapus"),
    true,
  );
  const eventDetail = await b.client.rpc("get_campus_event", {
    p_public_slug: event.data,
  });
  assert.ifError(eventDetail.error);
  assert.equal(eventDetail.data[0].organizer_alias, "Akun dihapus");
  const attendees = await b.client.rpc("list_campus_event_attendees", {
    p_public_slug: event.data,
  });
  assert.ifError(attendees.error);
  assert.equal(
    attendees.data.some((row) => row.public_alias === "Akun dihapus"),
    true,
  );
  noPrivateProjection([conversations.data, circleMessages.data, members.data]);
  report.sharedHistoryTombstone = true;

  stage = "post_cleanup_suppression";
  const identityAfter = await b.client.rpc("get_completed_identity_reveal", {
    p_public_id: revealShell.data,
  });
  assert.ifError(identityAfter.error);
  assert.equal(identityAfter.data[0].completed, false);
  report.identityDeletion = true;
  for (const channel of ["telegram", "instagram", "linkedin"]) {
    const contactAfter = await admin.rpc("get_completed_contact_reveal_cipher", {
      p_public_id: revealShell.data,
      p_viewer_user_id: b.id,
      p_channel: channel,
    });
    assert.ifError(contactAfter.error);
    assert.equal(contactAfter.data[0].completed, false);
  }
  report.contactDeletion = true;
} finally {
  stage = "cleanup";
  report.cleanup = await cleanupExactIds(users);
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
}

const ok = Object.values(report).every(Boolean);
process.stdout.write(
  ok
    ? "ACCOUNT_PRIVACY_LIVE_AUDIT_COMPLETE\n"
    : `ACCOUNT_PRIVACY_LIVE_AUDIT_FAILED stage=${stage}\n`,
);
process.exit(ok ? 0 : 1);
