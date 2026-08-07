/**
 * Viewport audit for public legal/help pages.
 * Requires app listening on http://localhost:3010
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const chromePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = process.env.STUDYDATE_AUDIT_BASE_URL ?? "http://localhost:3010";
const projectRoot = process.cwd();
const profilePath = join(
  projectRoot,
  ".next",
  `public-docs-audit-profile-${process.pid}`,
);
mkdirSync(profilePath, { recursive: true });

const pages = [
  { path: "/privacy", h1: "Kebijakan Privasi" },
  { path: "/terms", h1: "Ketentuan Layanan" },
  { path: "/community-guidelines", h1: "Pedoman Komunitas" },
  { path: "/safety", h1: "Pusat Keamanan" },
  { path: "/help", h1: "Bantuan" },
];

const viewports = [
  [375, 812],
  [768, 1024],
  [1440, 900],
];

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
        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result);
        }
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
  const message = { id, method, params, ...(sessionId ? { sessionId } : {}) };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP command timed out: ${method}`));
    }, 15_000);

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
    commandPipe.write(`${JSON.stringify(message)}\0`);
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
        reject(new Error(`CDP event timed out: ${method}`));
      }
    }, 15_000);
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
  assert.ok(pageTarget, "Chrome did not create a page target");

  const { sessionId } = await send("Target.attachToTarget", {
    targetId: pageTarget.targetId,
    flatten: true,
  });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);

  for (const page of pages) {
    for (const [width, height] of viewports) {
      await send(
        "Emulation.setDeviceMetricsOverride",
        { width, height, deviceScaleFactor: 1, mobile: width < 768 },
        sessionId,
      );

      const loaded = waitForEvent("Page.loadEventFired", sessionId);
      await send("Page.navigate", { url: `${baseUrl}${page.path}` }, sessionId);
      await loaded;
      await new Promise((resolve) => setTimeout(resolve, 400));

      const metrics = await evaluate(
        `(() => {
          const h1 = document.querySelector("h1")?.textContent?.trim() ?? "";
          const footer = document.querySelector("footer");
          const focusables = [...document.querySelectorAll(
            'a[href], button:not([disabled])'
          )].filter((el) => {
            const style = window.getComputedStyle(el);
            return style.visibility !== "hidden" && style.display !== "none";
          });
          return {
            title: document.title,
            h1,
            innerWidth: window.innerWidth,
            rootClientWidth: document.documentElement.clientWidth,
            rootScrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
            hasFooter: Boolean(footer),
            footerLinkCount: footer
              ? footer.querySelectorAll('a[href]').length
              : 0,
            focusableCount: focusables.length,
            firstFocusable:
              focusables[0]?.getAttribute("aria-label") ??
              focusables[0]?.textContent?.trim()?.slice(0, 40) ??
              null,
          };
        })()`,
        sessionId,
      );

      assert.equal(metrics.innerWidth, width);
      assert.equal(metrics.h1, page.h1);
      assert.match(metrics.title, new RegExp(page.h1.split("—")[0].trim(), "i"));
      assert.ok(metrics.rootScrollWidth <= metrics.rootClientWidth + 1);
      assert.ok(metrics.bodyScrollWidth <= metrics.rootClientWidth + 1);
      assert.equal(metrics.hasFooter, true);
      assert.ok(metrics.footerLinkCount >= 5);
      assert.ok(metrics.focusableCount >= 6);
      assert.ok(metrics.firstFocusable);

      const screenshot = await send(
        "Page.captureScreenshot",
        {
          format: "png",
          captureBeyondViewport: false,
          fromSurface: true,
        },
        sessionId,
      );
      writeFileSync(
        join(
          projectRoot,
          ".next",
          `public-doc-${page.path.slice(1)}-${width}.png`,
        ),
        screenshot.data,
        "base64",
      );

      process.stdout.write(
        `${page.path} @ ${width}x${height}: ok (no overflow)\n`,
      );
    }
  }

  // Keyboard focus on privacy (no device metrics override reliability issues)
  await send("Emulation.clearDeviceMetricsOverride", {}, sessionId);
  const loaded = waitForEvent("Page.loadEventFired", sessionId);
  await send("Page.navigate", { url: `${baseUrl}/privacy` }, sessionId);
  await loaded;
  await new Promise((resolve) => setTimeout(resolve, 400));

  const focusOrder = await evaluate(
    `(() => {
      const nodes = [...document.querySelectorAll(
        'a[href], button:not([disabled])'
      )].filter((el) => {
        const style = window.getComputedStyle(el);
        return style.visibility !== "hidden" && style.display !== "none";
      });
      return nodes.slice(0, 3).map((el) =>
        el.getAttribute("aria-label") ?? el.textContent?.trim()?.slice(0, 48)
      );
    })()`,
    sessionId,
  );
  assert.equal(focusOrder[0], "Kembali ke halaman utama StudyDate");
  process.stdout.write(`Privacy focus start: ${focusOrder.join(" -> ")}\n`);
  process.stdout.write("PUBLIC_DOCS_VIEWPORT_OK\n");
} finally {
  chrome.kill();
}
