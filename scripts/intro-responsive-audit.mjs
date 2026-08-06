/**
 * Responsive screenshots for Introduction pages (ignored under audit-artifacts/).
 * Uses retained synthetic accounts from .next/intro-audit-accounts.json.
 *
 *   node scripts/intro-responsive-audit.mjs
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const projectRoot = process.cwd();
const accountsPath = join(projectRoot, "audit-artifacts", "intro-audit-accounts.json");
const shotDir = join(projectRoot, "audit-artifacts", "intro-responsive");
const chromePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = process.env.AUDIT_BASE_URL ?? "http://localhost:3010";

mkdirSync(shotDir, { recursive: true });

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

function adminBundle() {
  const env = loadEnvLocal();
  const publishable =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return {
    env,
    publishable,
    admin: createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
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

async function seedStates(accounts) {
  const { admin } = adminBundle();
  const ids = Object.values(accounts).map((row) => row.id);
  await admin.from("user_reports").delete().in("reporter_id", ids);
  await admin
    .from("user_blocks")
    .delete()
    .or(`blocker_id.in.(${ids.join(",")}),blocked_id.in.(${ids.join(",")})`);
  const { data: introRows } = await admin
    .from("introduction_requests")
    .select("id")
    .or(`sender_id.in.(${ids.join(",")}),recipient_id.in.(${ids.join(",")})`);
  const introIds = (introRows ?? []).map((row) => row.id);
  if (introIds.length) {
    await admin.from("introduction_events").delete().in("request_id", introIds);
    await admin
      .from("conversation_shells")
      .delete()
      .in("introduction_request_id", introIds);
    await admin.from("introduction_requests").delete().in("id", introIds);
  }

  const a = await sessionFor(accounts.A.email);
  const b = await sessionFor(accounts.B.email);
  const d = await sessionFor(accounts.D.email);
  const e = await sessionFor(accounts.E.email);
  const r4 = await sessionFor(accounts.R4.email);
  const aliasB = await aliasOf(b);
  const aliasD = await aliasOf(d);
  const aliasE = await aliasOf(e);
  const aliasR4 = await aliasOf(r4);

  const { data: pendingId, error: pendingError } = await a.rpc(
    "send_introduction_request",
    {
      p_recipient_alias: aliasB,
      p_opening_message:
        "Hai, aku ingin berkenalan soal minat desain dan belajar bersama di kampus.",
    },
  );
  assert.ifError(pendingError);

  const { data: declineId, error: declineSendError } = await a.rpc(
    "send_introduction_request",
    {
      p_recipient_alias: aliasD,
      p_opening_message: "Perkenalan uji tampilan status ditolak di daftar terkirim.",
    },
  );
  assert.ifError(declineSendError);
  assert.ifError(
    (
      await d.rpc("decline_introduction_request", {
        p_request_id: declineId,
      })
    ).error,
  );

  const { data: cancelId, error: cancelSendError } = await a.rpc(
    "send_introduction_request",
    {
      p_recipient_alias: aliasE,
      p_opening_message: "Perkenalan uji tampilan status dibatalkan di daftar terkirim.",
    },
  );
  assert.ifError(cancelSendError);
  assert.ifError(
    (
      await a.rpc("cancel_introduction_request", {
        p_request_id: cancelId,
      })
    ).error,
  );

  await a.auth.signOut().catch(() => undefined);
  await b.auth.signOut().catch(() => undefined);
  await d.auth.signOut().catch(() => undefined);
  await e.auth.signOut().catch(() => undefined);
  await r4.auth.signOut().catch(() => undefined);

  return { pendingId, aliasB, aliasR4 };
}

async function runChrome(accounts, seed) {
  const profilePath = join(
    projectRoot,
    ".next",
    `intro-responsive-profile-${process.pid}`,
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
  const results = [];

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
      }, 20_000);
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
      commandPipe.write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
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
      }, 20_000);
    });
  }

  async function evaluate(expression, sessionId) {
    const result = await send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
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

    const loginUrl = await magicCallbackUrl(
      accounts.B.email,
      "/app/introductions?tab=masuk",
    );
    {
      const loaded = waitForEvent("Page.loadEventFired", sessionId);
      await send("Page.navigate", { url: loginUrl }, sessionId);
      await loaded;
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    const viewports = [
      [375, 812],
      [768, 1024],
      [1024, 768],
      [1440, 900],
    ];

    async function capture(label, path, width, height) {
      await send(
        "Emulation.setDeviceMetricsOverride",
        { width, height, deviceScaleFactor: 1, mobile: width <= 768 },
        sessionId,
      );
      const loaded = waitForEvent("Page.loadEventFired", sessionId);
      await send("Page.navigate", { url: `${baseUrl}${path}` }, sessionId);
      await loaded;
      await new Promise((resolve) => setTimeout(resolve, 700));

      const metrics = await evaluate(
        `(() => ({
          innerWidth: window.innerWidth,
          rootClientWidth: document.documentElement.clientWidth,
          rootScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          title: document.querySelector("h1")?.textContent?.trim() ?? "",
          hasDialog: Boolean(document.querySelector("dialog")),
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
        }))()`,
        sessionId,
      );

      assert.equal(metrics.overflowX, false, `${label} horizontal overflow`);
      assert.ok(
        metrics.bodyScrollWidth <= metrics.rootClientWidth + 1,
        `${label} body overflow`,
      );

      const screenshot = await send(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: false, fromSurface: true },
        sessionId,
      );
      const file = `${label}-${width}x${height}.png`;
      writeFileSync(join(shotDir, file), screenshot.data, "base64");
      results.push({ label, width, height, file, ...metrics });
      console.log(`SHOT_OK ${file} overflow=${metrics.overflowX}`);
    }

    for (const [width, height] of viewports) {
      await capture("intro-masuk-pending", "/app/introductions?tab=masuk", width, height);
      await capture(
        "intro-terkirim",
        "/app/introductions?tab=terkirim",
        width,
        height,
      );
    }

    // Accept pending as B, then capture accepted state.
    {
      const bClient = await sessionFor(accounts.B.email);
      assert.ifError(
        (
          await bClient.rpc("accept_introduction_request", {
            p_request_id: seed.pendingId,
          })
        ).error,
      );
      await bClient.auth.signOut().catch(() => undefined);
    }

    await capture(
      "intro-masuk-accepted",
      "/app/introductions?tab=masuk&state=accepted",
      1440,
      900,
    );

    // Dialog on People detail for A → R4 (eligible send target)
    {
      const aLogin = await magicCallbackUrl(accounts.A.email, "/app");
      const loaded = waitForEvent("Page.loadEventFired", sessionId);
      await send("Page.navigate", { url: aLogin }, sessionId);
      await loaded;
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await send(
        "Emulation.setDeviceMetricsOverride",
        { width: 375, height: 812, deviceScaleFactor: 1, mobile: true },
        sessionId,
      );
      const peoplePath = `/app/people/${seed.aliasR4.replace("Partner #", "Partner-")}`;
      const peopleLoaded = waitForEvent("Page.loadEventFired", sessionId);
      await send("Page.navigate", { url: `${baseUrl}${peoplePath}` }, sessionId);
      await peopleLoaded;
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const opened = await evaluate(
        `(() => {
          const button = [...document.querySelectorAll("button")].find((el) =>
            (el.textContent || "").trim() === "Kirim perkenalan"
          );
          if (button) button.click();
          return Boolean(button);
        })()`,
        sessionId,
      );
      await new Promise((resolve) => setTimeout(resolve, 600));
      const dialogOpen = await evaluate(
        `Boolean(document.querySelector("dialog[open]"))`,
        sessionId,
      );
      const screenshot = await send(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: false, fromSurface: true },
        sessionId,
      );
      writeFileSync(
        join(shotDir, "intro-dialog-375x812.png"),
        screenshot.data,
        "base64",
      );
      results.push({
        label: "intro-dialog",
        width: 375,
        height: 812,
        file: "intro-dialog-375x812.png",
        buttonFound: opened,
        dialogOpen,
        peoplePath,
      });
      console.log(
        `SHOT_OK intro-dialog-375x812.png buttonFound=${opened} dialogOpen=${dialogOpen}`,
      );
      assert.equal(dialogOpen, true, "send introduction dialog should open");
    }

    writeFileSync(
      join(shotDir, "summary.json"),
      JSON.stringify(results, null, 2),
    );
    console.log("INTRO_RESPONSIVE_AUDIT_COMPLETE");
  } finally {
    chrome.kill();
  }
}

async function main() {
  assert.ok(existsSync(accountsPath), "Missing intro-audit-accounts.json");
  const accounts = JSON.parse(readFileSync(accountsPath, "utf8"));
  assert.ok(accounts.A?.email && accounts.B?.email);
  const seed = await seedStates(accounts);
  console.log("SEED_OK pending+declined+cancelled");
  await runChrome(accounts, seed);

  // Cleanup seeded intro rows after screenshots.
  const { admin } = adminBundle();
  const ids = Object.values(accounts).map((row) => row.id);
  const { data: introRows } = await admin
    .from("introduction_requests")
    .select("id")
    .or(`sender_id.in.(${ids.join(",")}),recipient_id.in.(${ids.join(",")})`);
  const introIds = (introRows ?? []).map((row) => row.id);
  if (introIds.length) {
    await admin.from("introduction_events").delete().in("request_id", introIds);
    await admin
      .from("conversation_shells")
      .delete()
      .in("introduction_request_id", introIds);
    await admin.from("introduction_requests").delete().in("id", introIds);
  }
  console.log(`CLEANUP_OK intros=${introIds.length}`);
}

main().catch((error) => {
  console.error("INTRO_RESPONSIVE_AUDIT_FAILED", error.message);
  process.exitCode = 1;
});
