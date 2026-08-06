/**
 * Live authenticated owner audit via headed Chrome + CDP WebSocket.
 * Does not print emails, UUIDs, tokens, or magic links.
 *
 *   node scripts/live-auth-audit.mjs owner-login
 *   node scripts/live-auth-audit.mjs signal
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3010";
const USE_INBOX = process.env.AUDIT_USE_INBOX === "1";
const chromePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const projectRoot = process.cwd();
const artifactDir = join(projectRoot, "audit-artifacts");
const profilePath = join(artifactDir, "chrome-profile");
const emailPath = join(projectRoot, ".next", "owner-email.tmp");
const signalPath = join(artifactDir, "magic-link-opened.signal");
const statusPath = join(artifactDir, "audit-status.json");
const portPath = join(artifactDir, "cdp-port.json");

mkdirSync(artifactDir, { recursive: true });
mkdirSync(profilePath, { recursive: true });
mkdirSync(join(projectRoot, ".next"), { recursive: true });

const command = process.argv[2] ?? "owner-login";

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

async function createAdminMagicLink(email) {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Server environment is not configured for audit login.");
  }
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const redirectTo = new URL("/auth/callback", BASE);
  redirectTo.searchParams.set("next", "/staff");
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: redirectTo.toString() },
  });
  const hashedToken = data?.properties?.hashed_token;
  if (error || !hashedToken) {
    throw new Error("Admin magic-link generation failed.");
  }
  // Prefer the app callback + token_hash path so PKCE/email-link differences
  // in Supabase-hosted action_link redirects do not break local audits.
  const callback = new URL("/auth/callback", BASE);
  callback.searchParams.set("token_hash", hashedToken);
  callback.searchParams.set("type", "magiclink");
  callback.searchParams.set("next", "/staff");
  return callback.toString();
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.ws.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    });
  }

  send(method, params = {}) {
    const id = (this.nextId += 1);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 20_000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text ?? "evaluate failed");
    }
    return result.result?.value;
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

async function waitForDebugger(port) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const version = await fetch(`http://127.0.0.1:${port}/json/version`).then(
        (r) => r.json(),
      );
      if (version.webSocketDebuggerUrl) return version;
    } catch {
      /* retry */
    }
    await delay(250);
  }
  throw new Error("Chrome debugger not ready");
}

async function listPages(port) {
  return fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
}

async function attachToBestPage(port) {
  const pages = (await listPages(port)).filter((item) => item.type === "page");
  const preferred =
    pages.find((item) => /\/owner(\/|$|\?)/.test(item.url)) ??
    pages.find((item) => /\/admin(\/|$|\?)/.test(item.url)) ??
    pages.find((item) => /\/auth\/callback/.test(item.url)) ??
    pages.find((item) => item.url.includes("localhost:3010")) ??
    pages.find((item) => item.url !== "about:blank") ??
    pages[0];
  assert.ok(preferred?.webSocketDebuggerUrl, "No Chrome page target");
  const ws = new WebSocket(preferred.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  const client = new CdpClient(ws);
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Network.enable").catch(() => undefined);
  return { client, url: preferred.url, id: preferred.id };
}

async function launchChrome() {
  const port = await getFreePort();
  const runProfile = join(profilePath, `run-${process.pid}-${Date.now()}`);
  mkdirSync(runProfile, { recursive: true });
  const chrome = spawn(
    chromePath,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${runProfile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-sync",
      "--disable-extensions",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--new-window",
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: false, detached: true },
  );
  chrome.unref();
  await waitForDebugger(port);
  writeFileSync(
    portPath,
    JSON.stringify({ port, pid: chrome.pid, profile: runProfile }, null, 2),
  );
  return { port, pid: chrome.pid };
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  await delay(1500);
  return client.evaluate("location.href");
}

async function pageSummary(client) {
  return client.evaluate(`(() => {
    const heading = document.querySelector("h1")?.textContent?.trim() ?? "";
    const labels = [...document.querySelectorAll("p, span")]
      .map((el) => el.textContent?.trim() ?? "")
      .filter(Boolean);
    const area =
      labels.find((text) =>
        /Owner workspace|Admin verification|Ruang mahasiswa/i.test(text),
      ) ?? "";
    const nav = [...document.querySelectorAll('nav[aria-label="Navigasi utama"] a')]
      .map((a) =>
        (a.textContent || a.getAttribute("title") || a.getAttribute("aria-label") || "")
          .replace(/\\s+/g, " ")
          .trim(),
      )
      .filter(Boolean);
    return {
      href: location.href,
      path: location.pathname,
      heading,
      area,
      nav: [...new Set(nav)],
      overflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      hasDialog: Boolean(document.querySelector('[role="dialog"]')),
      menuButton: Boolean(
        document.querySelector('button[aria-label="Buka menu navigasi"]'),
      ),
    };
  })()`);
}

async function setViewport(client, width, height) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await delay(350);
}

async function screenshot(client, name) {
  const shot = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const path = join(artifactDir, name);
  writeFileSync(path, shot.data, "base64");
  return path;
}

async function ownerLoginAndPause() {
  if (!existsSync(emailPath)) {
    throw new Error("Owner email staging file missing");
  }
  const email = readFileSync(emailPath, "utf8").trim();
  if (existsSync(signalPath)) unlinkSync(signalPath);

  const { port, pid } = await launchChrome();
  let { client } = await attachToBestPage(port);
  writeFileSync(
    statusPath,
    JSON.stringify({ phase: "owner-login", pid, port }, null, 2),
  );

  if (!USE_INBOX) {
    // Local audit only: generate a one-time magic link via service role and
    // open it in the same Chrome session. Never print the link.
    console.log("AUTH_VIA_ADMIN_GENERATE_LINK");
    const actionLink = await createAdminMagicLink(email);
    try {
      unlinkSync(emailPath);
    } catch {
      /* ignore */
    }
    await navigate(client, actionLink);
    await delay(2500);

    for (let i = 0; i < 40; i += 1) {
      try {
        client.close();
        ({ client } = await attachToBestPage(port));
        const href = await client.evaluate("location.href");
        if (/\/owner(\/|$|\?)/.test(href) && !href.includes("/auth/")) {
          writeFileSync(signalPath, "admin-link\n");
          break;
        }
        if (/\/auth\/error/.test(href)) {
          throw new Error("Auth callback failed after admin magic link");
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("Auth callback failed")
        ) {
          throw error;
        }
      }
      await delay(500);
    }
    if (!existsSync(signalPath)) {
      throw new Error("Admin magic link did not complete owner redirect");
    }
    console.log("OWNER_LOGIN_COMPLETED_WITHOUT_INBOX");
  } else {
    await navigate(client, `${BASE}/staff/login`);
    await delay(800);

    const filled = await client.evaluate(`(async () => {
      const email = ${JSON.stringify(email)};
      const input = document.querySelector('input[type="email"]');
      const form = document.querySelector("form");
      if (!input || !form) return { ok: false, reason: "form-missing" };
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(input, email);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      form.requestSubmit();
      for (let i = 0; i < 24; i += 1) {
        await new Promise((r) => setTimeout(r, 250));
        const heading = document.querySelector("h1")?.textContent?.trim() ?? "";
        const alert = document.querySelector('[role="alert"]')?.textContent?.trim() ?? "";
        if (/Periksa email/i.test(heading)) {
          return { ok: true, heading, alert };
        }
        if (alert) return { ok: false, heading, alert, reason: "form-error" };
      }
      return {
        ok: false,
        heading: document.querySelector("h1")?.textContent?.trim() ?? "",
        reason: "sent-state-timeout",
      };
    })()`);

    try {
      unlinkSync(emailPath);
    } catch {
      /* ignore */
    }

    if (!filled.ok) {
      console.log(`LOGIN_FILL_FAILED reason=${filled.reason}`);
      console.log(`STAFF_HEADING=${filled.heading}`);
      throw new Error("Owner login form did not reach sent state");
    }

    console.log("OWNER_LOGIN_SUBMITTED");
    console.log(`STAFF_HEADING=${filled.heading}`);
    console.log("PAUSE_FOR_MAGIC_LINK");
    writeFileSync(
      statusPath,
      JSON.stringify(
        { phase: "waiting-magic-link", pid, port, heading: filled.heading },
        null,
        2,
      ),
    );

    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      if (existsSync(signalPath)) {
        console.log("SIGNAL_RECEIVED");
        break;
      }
      try {
        client.close();
        ({ client } = await attachToBestPage(port));
        const href = await client.evaluate("location.href");
        if (
          /\/owner(\/|$|\?)/.test(href) ||
          /\/admin(\/|$|\?)/.test(href) ||
          /\/auth\/callback/.test(href)
        ) {
          console.log("AUTH_REDIRECT_DETECTED");
          writeFileSync(signalPath, "auto\n");
          break;
        }
      } catch {
        /* retry */
      }
      await delay(2000);
    }

    if (!existsSync(signalPath)) {
      throw new Error("Timed out waiting for magic link authentication");
    }
  }

  await delay(1000);
  client.close();
  ({ client } = await attachToBestPage(port));

  for (let i = 0; i < 40; i += 1) {
    const href = await client.evaluate("location.href");
    if (/\/owner(\/|$|\?)/.test(href) && !href.includes("/auth/")) break;
    await delay(500);
    try {
      client.close();
      ({ client } = await attachToBestPage(port));
    } catch {
      /* retry */
    }
  }

  const summary = await pageSummary(client);
  console.log(`FINAL_PATH=${summary.path}`);
  console.log(`HEADING=${summary.heading}`);
  console.log(`AREA=${summary.area}`);
  console.log(`NAV=${summary.nav.join("|")}`);
  const ownerOk =
    summary.path.startsWith("/owner") &&
    (/Owner workspace/i.test(summary.area) ||
      /Kontrol yang terbatas/i.test(summary.heading));
  console.log(`OWNER_SESSION_OK=${ownerOk}`);

  const routeResults = [];
  for (const route of [
    "/owner",
    "/owner/staff",
    "/admin/verifications",
    "/admin",
    "/app",
    "/app/people",
  ]) {
    await navigate(client, `${BASE}${route}`);
    const page = await pageSummary(client);
    routeResults.push({
      requested: route,
      finalPath: page.path,
      heading: page.heading,
      area: page.area,
      nav: page.nav,
    });
    console.log(`ROUTE ${route} -> ${page.path} | ${page.heading}`);
  }
  writeFileSync(
    join(artifactDir, "owner-routes.json"),
    JSON.stringify(routeResults, null, 2),
  );

  await navigate(client, `${BASE}/owner`);
  const viewports = [
    [375, 812, "mobile"],
    [768, 1024, "tablet"],
    [1024, 768, "laptop"],
    [1440, 900, "desktop"],
  ];
  const responsive = [];

  for (const [width, height, label] of viewports) {
    await setViewport(client, width, height);
    const metrics = await client.evaluate(`(() => {
      const menu = document.querySelector('button[aria-label="Buka menu navigasi"]');
      const asides = [...document.querySelectorAll("aside")].filter((el) => {
        const style = getComputedStyle(el);
        return style.display !== "none" && el.offsetWidth > 0;
      });
      const rail = asides.find((el) => el.offsetWidth > 0 && el.offsetWidth < 120);
      const desktop = asides.find((el) => el.offsetWidth >= 240);
      return {
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        menuVisible: Boolean(menu && menu.offsetParent !== null),
        railWidth: rail?.offsetWidth ?? 0,
        desktopWidth: desktop?.offsetWidth ?? 0,
      };
    })()`);

    let mobile = null;
    if (label === "mobile") {
      await client.evaluate(
        `document.querySelector('button[aria-label="Buka menu navigasi"]')?.click()`,
      );
      await delay(350);
      const openState = await client.evaluate(`(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return {
          hasDialog: Boolean(dialog),
          focusInDialog: Boolean(dialog?.contains(document.activeElement)),
          bodyOverflow: document.body.style.overflow,
        };
      })()`);
      await client.send("Input.dispatchKeyEvent", {
        type: "rawKeyDown",
        key: "Escape",
        code: "Escape",
        windowsVirtualKeyCode: 27,
      });
      await client.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "Escape",
        code: "Escape",
        windowsVirtualKeyCode: 27,
      });
      await delay(250);
      const afterEscape = await client.evaluate(`(() => ({
        dialog: Boolean(document.querySelector('[role="dialog"]')),
        activeLabel: document.activeElement?.getAttribute("aria-label") || "",
      }))()`);
      await client.evaluate(
        `document.querySelector('button[aria-label="Buka menu navigasi"]')?.click()`,
      );
      await delay(250);
      await client.evaluate(
        `document.querySelector('button[aria-label="Tutup menu navigasi"]')?.click()`,
      );
      await delay(250);
      const afterBackdrop = await client.evaluate(
        `Boolean(document.querySelector('[role="dialog"]'))`,
      );
      mobile = {
        ...openState,
        escapeClosed: !afterEscape.dialog,
        focusRestore: afterEscape.activeLabel,
        backdropClosed: !afterBackdrop,
      };
    }

    const shot = await screenshot(client, `owner-${label}-${width}x${height}.png`);
    responsive.push({ label, width, height, ...metrics, mobile, shot });
    console.log(
      `VIEWPORT ${label} ${width}x${height} overflow=${metrics.overflow} menu=${metrics.menuVisible} rail=${metrics.railWidth} desktop=${metrics.desktopWidth}`,
    );
    if (mobile) {
      console.log(
        `MOBILE_DRAWER dialog=${mobile.hasDialog} focusIn=${mobile.focusInDialog} escape=${mobile.escapeClosed} restore=${mobile.focusRestore} backdrop=${mobile.backdropClosed}`,
      );
    }
  }

  writeFileSync(
    join(artifactDir, "owner-responsive.json"),
    JSON.stringify(responsive, null, 2),
  );
  writeFileSync(
    statusPath,
    JSON.stringify(
      { phase: "owner-audit-complete", finalPath: summary.path, ownerOk },
      null,
      2,
    ),
  );
  console.log("OWNER_AUDIT_COMPLETE");
  console.log("Leave the Chrome window open for follow-up admin/student audits.");
}

async function writeSignal() {
  writeFileSync(signalPath, `opened-at-${Date.now()}\n`);
  console.log("SIGNAL_WRITTEN");
}

if (command === "owner-login") {
  await ownerLoginAndPause();
} else if (command === "signal") {
  await writeSignal();
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
