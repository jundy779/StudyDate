import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const chromePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const projectRoot = process.cwd();
const profilePath = join(
  projectRoot,
  ".next",
  `browser-audit-profile-${process.pid}`,
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
    }, 10_000);

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
    }, 10_000);
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

  // Focus order first, before viewport emulation — Emulation.setDeviceMetricsOverride
  // leaves CDP keyboard focus traversal unreliable on this Windows/Chrome setup.
  {
    const loaded = waitForEvent("Page.loadEventFired", sessionId);
    await send(
      "Page.navigate",
      { url: "http://localhost:3010/login" },
      sessionId,
    );
    await loaded;
    await new Promise((resolve) => setTimeout(resolve, 500));

    const focusOrder = await evaluate(
      `(() => {
        const nodes = [...document.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        )];
        return nodes
          .filter((element) => {
            const style = window.getComputedStyle(element);
            return style.visibility !== "hidden" && style.display !== "none";
          })
          .slice(0, 3)
          .map((element) =>
            element.getAttribute("aria-label") ??
            element.getAttribute("type") ??
            element.tagName.toLowerCase()
          );
      })()`,
      sessionId,
    );

    assert.deepEqual(focusOrder, [
      "Kembali ke halaman utama StudyDate",
      "email",
      "submit",
    ]);
    process.stdout.write(`Keyboard focus order: ${focusOrder.join(" -> ")}\n`);
  }

  const viewports = [
    [375, 1000],
    [768, 1100],
    [1024, 900],
    [1440, 900],
  ];

  for (const [width, height] of viewports) {
    await send(
      "Emulation.setDeviceMetricsOverride",
      { width, height, deviceScaleFactor: 1, mobile: false },
      sessionId,
    );
    const loaded = waitForEvent("Page.loadEventFired", sessionId);
    await send(
      "Page.navigate",
      { url: "http://localhost:3010/login" },
      sessionId,
    );
    await loaded;

    const metrics = await evaluate(
      `(() => ({
        innerWidth: window.innerWidth,
        rootClientWidth: document.documentElement.clientWidth,
        rootScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        title: document.querySelector("h1")?.textContent?.trim(),
        emailLabel: document.querySelector("label[for]")?.textContent?.trim(),
        submitLabel: document.querySelector('button[type="submit"]')?.textContent?.trim()
      }))()`,
      sessionId,
    );

    assert.equal(metrics.innerWidth, width);
    assert.equal(metrics.rootScrollWidth, metrics.rootClientWidth);
    assert.ok(metrics.bodyScrollWidth <= metrics.rootClientWidth);
    assert.equal(metrics.title, "Masuk ke StudyDate");
    assert.equal(metrics.emailLabel, "Email");
    assert.equal(metrics.submitLabel, "Kirim Tautan Masuk");

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
      join(projectRoot, ".next", `auth-audit-${width}.png`),
      screenshot.data,
      "base64",
    );

    process.stdout.write(
      `${width}px: ${metrics.rootScrollWidth}/${metrics.rootClientWidth}px, no horizontal overflow\n`,
    );
  }
} finally {
  chrome.kill();
}
