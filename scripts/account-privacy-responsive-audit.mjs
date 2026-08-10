import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const baseUrl = process.env.AUDIT_BASE_URL ?? "http://localhost:3010";
const targetUrl =
  process.env.ACCOUNT_PRIVACY_AUDIT_URL ?? `${baseUrl}/app/settings`;
const storageState = process.env.ACCOUNT_PRIVACY_AUDIT_STORAGE_STATE?.trim();
const artifactDir = join(
  process.cwd(),
  "audit-artifacts",
  "account-privacy-v1",
);
const viewports = [
  [320, 568],
  [375, 812],
  [768, 1024],
  [1024, 768],
  [1440, 900],
];

mkdirSync(artifactDir, { recursive: true });

async function main() {
  const chromePath =
    process.env.CHROME_PATH ??
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const profilePath = join(
    process.cwd(),
    ".next",
    `account-privacy-audit-${process.pid}`,
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
  let id = 0;
  let responseBuffer = Buffer.alloc(0);
  const pending = new Map();
  const eventWaiters = [];
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
    new Promise((resolve) => eventWaiters.push({ method, sessionId, resolve }));

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
  if (!storageState) {
    throw new Error(
      "ACCOUNT_PRIVACY_AUDIT_STORAGE_STATE is required; this audit must exercise authenticated settings.",
    );
  }
  await send(
    "Network.enable",
    {},
    sessionId,
  );
  const cookies = JSON.parse(storageState).cookies;
  assert.ok(Array.isArray(cookies), "storage-state cookies required");
  for (const cookie of cookies) {
    await send(
      "Network.setCookie",
      {
        name: cookie.name,
        value: cookie.value,
        url: new URL(cookie.path ?? "/", baseUrl).href,
        secure: cookie.secure ?? baseUrl.startsWith("https:"),
        httpOnly: cookie.httpOnly ?? false,
        ...(cookie.sameSite ? { sameSite: cookie.sameSite } : {}),
      },
      sessionId,
    );
  }

  for (const [width, height] of viewports) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    }, sessionId);
    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    }, sessionId);
    const loaded = waitForEvent("Page.loadEventFired", sessionId);
    await send("Page.navigate", { url: targetUrl }, sessionId);
    await loaded;

    const evaluated = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => ({
        href: location.href,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        settings: Boolean(document.querySelector('h1')?.textContent?.includes('Pengaturan')),
        labelsWithoutControls: [...document.querySelectorAll('label')].filter(label => !label.control && !label.querySelector('input,select,textarea')).length,
      }))()`,
    }, sessionId);
    const state = evaluated.result.value;
    assert.equal(state.overflow, false, `${width}x${height}: horizontal overflow`);
    assert.equal(state.settings, true, `${width}x${height}: settings heading`);
    assert.equal(state.labelsWithoutControls, 0, `${width}x${height}: orphan label`);

    const dialogState = await send("Runtime.evaluate", {
      returnByValue: true,
      awaitPromise: true,
      expression: `(async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        let trigger = document.querySelector('#delete-account-trigger');
        trigger?.click();
        let dialog = null;
        for (let attempt = 0; attempt < 20 && !dialog; attempt += 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
          dialog = document.querySelector('[role="dialog"]');
        }
        const cancel = [...(dialog?.querySelectorAll('button') ?? [])].find(
          button => button.textContent?.trim() === 'Batal'
        );
        const submit = [...(dialog?.querySelectorAll('button') ?? [])].find(
          button => button.textContent?.trim() === 'Kirim permintaan'
        );
        const opened = {
          triggerFound: Boolean(trigger),
          dialogFound: Boolean(dialog),
          labelled: Boolean(dialog?.getAttribute('aria-labelledby')),
          described: Boolean(dialog?.getAttribute('aria-describedby')),
          cancelFocused: document.activeElement === cancel,
          submitDisabled: Boolean(submit?.disabled),
        };
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await new Promise(resolve => requestAnimationFrame(
            () => setTimeout(resolve, 50)
          ));
          trigger = document.querySelector('#delete-account-trigger');
          if (
            !document.querySelector('[role="dialog"]') &&
            document.activeElement === trigger
          ) break;
        }
        return {
          ...opened,
          closedWithEscape: !document.querySelector('[role="dialog"]'),
          focusRestored: document.activeElement === trigger,
          activeText: document.activeElement?.textContent?.trim() ?? "",
          activeTag: document.activeElement?.tagName ?? "",
          triggerConnected: Boolean(trigger?.isConnected),
        };
      })()`,
    }, sessionId);
    for (const check of [
      "triggerFound",
      "dialogFound",
      "labelled",
      "described",
      "cancelFocused",
      "submitDisabled",
      "closedWithEscape",
      "focusRestored",
      "triggerConnected",
    ]) {
      assert.equal(
        dialogState.result.value[check],
        true,
        `${width}x${height}: dialog ${check}; active=${dialogState.result.value.activeTag}:${dialogState.result.value.activeText}`,
      );
    }

    const screenshot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    }, sessionId);
    const path = join(artifactDir, `settings-${width}x${height}.png`);
    await writeFile(path, Buffer.from(screenshot.data, "base64"));
    console.log(
      JSON.stringify({ viewport: `${width}x${height}`, ...state }),
    );
  }

  chrome.kill();
}

await main();
