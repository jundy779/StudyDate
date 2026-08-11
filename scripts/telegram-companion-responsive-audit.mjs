import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.env.AUDIT_BASE_URL ?? "http://localhost:3010";
const viewports = [
  [320, 568],
  [375, 812],
  [768, 1024],
  [1024, 768],
  [1440, 900],
];
const states = [
  "unavailable",
  "not_connected",
  "link_created",
  "telegram_pending",
  "connected",
  "switch_required",
];

const profilePath = join(
  process.cwd(),
  ".next",
  `telegram-companion-audit-${process.pid}`,
);
mkdirSync(profilePath, { recursive: true });

const chromePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
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
let id = 0;
let responseBuffer = Buffer.alloc(0);
const pending = new Map();
const events = [];

responsePipe.on("data", (chunk) => {
  responseBuffer = Buffer.concat([responseBuffer, chunk]);
  let separator = responseBuffer.indexOf(0);
  while (separator !== -1) {
    const raw = responseBuffer.subarray(0, separator).toString("utf8");
    responseBuffer = responseBuffer.subarray(separator + 1);
    if (raw) {
      const message = JSON.parse(raw);
      if (message.id && pending.has(message.id)) {
        const waiter = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message));
        else waiter.resolve(message.result);
      } else if (message.method) {
        for (const waiter of [...events]) {
          if (
            waiter.method === message.method &&
            (!waiter.sessionId || waiter.sessionId === message.sessionId)
          ) {
            events.splice(events.indexOf(waiter), 1);
            waiter.resolve(message.params);
          }
        }
      }
    }
    separator = responseBuffer.indexOf(0);
  }
});

const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    commandPipe.write(
      `${JSON.stringify({
        id: requestId,
        method,
        params,
        ...(sessionId ? { sessionId } : {}),
      })}\0`,
    );
  });
const waitForEvent = (method, sessionId) =>
  new Promise((resolve) => events.push({ method, sessionId, resolve }));

try {
  const { targetInfos } = await send("Target.getTargets");
  const page = targetInfos.find((target) => target.type === "page");
  assert.ok(page, "Chrome page target required");
  const attached = await send("Target.attachToTarget", {
    targetId: page.targetId,
    flatten: true,
  });
  const sessionId = attached.sessionId;
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);

  for (const [width, height] of viewports) {
    await send(
      "Emulation.setDeviceMetricsOverride",
      { width, height, deviceScaleFactor: 1, mobile: width < 768 },
      sessionId,
    );
    await send(
      "Emulation.setEmulatedMedia",
      {
        features: [
          { name: "prefers-reduced-motion", value: "reduce" },
        ],
      },
      sessionId,
    );

    for (const state of states) {
      const loaded = waitForEvent("Page.loadEventFired", sessionId);
      await send(
        "Page.navigate",
        {
          url: `${baseUrl}/telegram-companion-audit?state=${state}`,
        },
        sessionId,
      );
      await loaded;
      const evaluated = await send(
        "Runtime.evaluate",
        {
          returnByValue: true,
          expression: `(() => ({
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            heading: Boolean([...document.querySelectorAll('h3')].find(node => node.textContent?.includes('Telegram Companion'))),
            tinyButtons: [...document.querySelectorAll('button,a')].filter(node => {
              const rect = node.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && rect.height < 40;
            }).length,
            sensitive: /telegramUserId|chatId|username|ciphertext|auth_tag|UUID|NIM|@gmail\\.com/i.test(document.body.innerText),
          }))()`,
        },
        sessionId,
      );
      const result = evaluated.result.value;
      assert.equal(result.overflow, false, `${width}x${height} ${state}: overflow`);
      assert.equal(result.heading, true, `${width}x${height} ${state}: heading`);
      assert.equal(result.tinyButtons, 0, `${width}x${height} ${state}: touch target`);
      assert.equal(result.sensitive, false, `${width}x${height} ${state}: sensitive copy`);
    }

    for (const state of ["connected", "switch_required"]) {
      const loaded = waitForEvent("Page.loadEventFired", sessionId);
      await send(
        "Page.navigate",
        {
          url: `${baseUrl}/telegram-companion-audit?state=${state}`,
        },
        sessionId,
      );
      await loaded;
      const dialog = await send(
        "Runtime.evaluate",
        {
          returnByValue: true,
          awaitPromise: true,
          expression: `(async () => {
            await new Promise(resolve => setTimeout(resolve, 250));
            const label = ${JSON.stringify(
              state === "connected"
                ? "Putuskan"
                : "Hubungkan ke percakapan ini",
            )};
            let trigger = null;
            for (let attempt = 0; attempt < 20 && !trigger; attempt += 1) {
              trigger = [...document.querySelectorAll('button')].find(
                button => button.textContent?.trim() === label
              );
              if (!trigger) {
                await new Promise(resolve => setTimeout(resolve, 50));
              }
            }
            trigger?.focus();
            trigger?.click();
            let dialog = null;
            for (let attempt = 0; attempt < 20 && !dialog; attempt += 1) {
              dialog = document.querySelector('dialog[open]');
              if (!dialog) {
                await new Promise(resolve => setTimeout(resolve, 50));
              }
            }
            const result = {
              open: Boolean(dialog),
              labelled: Boolean(dialog?.getAttribute('aria-labelledby')),
              described: Boolean(dialog?.getAttribute('aria-describedby')),
            };
            dialog?.dispatchEvent(new KeyboardEvent('cancel', {
              bubbles: true,
              cancelable: true,
            }));
            dialog?.close();
            await new Promise(resolve => setTimeout(resolve, 50));
            trigger = [...document.querySelectorAll('button')].find(
              button => button.textContent?.trim() === label
            );
            return {
              ...result,
              closed: !document.querySelector('dialog[open]'),
              restored: document.activeElement === trigger,
            };
          })()`,
        },
        sessionId,
      );
      for (const key of ["open", "labelled", "described", "closed", "restored"]) {
        assert.equal(
          dialog.result.value[key],
          true,
          `${width}x${height} ${state}: ${key}`,
        );
      }
    }
  }

  process.stdout.write("TELEGRAM_COMPANION_RESPONSIVE_AUDIT_COMPLETE\n");
} finally {
  chrome.kill();
}
