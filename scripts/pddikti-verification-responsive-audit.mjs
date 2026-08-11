import assert from "node:assert/strict";
import http from "node:http";

const WebSocket = globalThis.WebSocket;
const viewports = [
  [320, 568],
  [375, 812],
  [768, 1024],
  [1024, 768],
  [1440, 900],
];

function requestJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => resolve(JSON.parse(body)));
      })
      .on("error", reject);
  });
}

function createTarget(url) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method: "PUT" }, (response) => {
      let body = "";
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => resolve(JSON.parse(body)));
    });
    request.on("error", reject);
    request.end();
  });
}

async function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(message.error);
    else handler.resolve(message.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const requestId = ++id;
      pending.set(requestId, { resolve, reject });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
  return { socket, send };
}

const created = await createTarget(
  "http://localhost:9222/json/new?http://localhost:3010/verification-audit",
).catch(() => null);
const targets = await requestJson("http://localhost:9222/json");
const target =
  created ??
  targets.find((item) => item.url?.includes("/verification-audit")) ??
  targets.find((item) => item.type === "page");
assert.ok(target, "Chrome page target unavailable");
assert.ok(WebSocket, "WebSocket unavailable");
const { socket, send } = await connect(target.webSocketDebuggerUrl);
await send("Page.enable");
await send("Runtime.enable");

for (const [width, height] of viewports) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await send("Page.navigate", {
    url: "http://localhost:3010/verification-audit",
  });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const result = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const nim = document.querySelector('#verification-nim');
      const upload = document.querySelector('#pddikti-evidence');
      const buttons = [...document.querySelectorAll('button')];
      return {
        title: document.querySelector('h1')?.textContent,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        nimLabel: nim?.labels?.[0]?.textContent?.trim(),
        nimDescribed: Boolean(nim?.getAttribute('aria-describedby')),
        uploadHiddenUntilManual: !upload,
        touchTargets: buttons
          .filter((button) => getComputedStyle(button).visibility !== 'hidden')
          .filter((button) => button.getBoundingClientRect().width > 0)
          .filter((button) => button.textContent?.trim())
          .every((button) => button.getBoundingClientRect().height >= 44),
        smallButtons: buttons
          .filter((button) => getComputedStyle(button).visibility !== 'hidden')
          .filter((button) => button.getBoundingClientRect().width > 0)
          .filter((button) => button.textContent?.trim())
          .filter((button) => button.getBoundingClientRect().height < 44)
          .map((button) => [button.textContent?.trim(), button.getBoundingClientRect().height]),
        privateLeak: /pddikti_evidence_path|nim_ciphertext|aksesKey|synthetic-test-key/.test(document.body.innerHTML),
      };
    })()`,
  });
  const value = result.result.value;
  assert.match(value.title ?? "", /PDDIKTI lookup/);
  assert.equal(value.overflow, false, `${width}x${height}: overflow`);
  assert.equal(value.nimLabel, "NIM", `${width}x${height}: NIM label`);
  assert.equal(value.nimDescribed, true, `${width}x${height}: NIM helper`);
  assert.equal(
    value.uploadHiddenUntilManual,
    true,
    `${width}x${height}: upload state`,
  );
  assert.equal(
    value.touchTargets,
    true,
    `${width}x${height}: touch target ${JSON.stringify(value.smallButtons)}`,
  );
  assert.equal(value.privateLeak, false, `${width}x${height}: private leak`);
}

socket.close();
console.log("PDDIKTI verification responsive audit passed.");
