import { createDecipheriv } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separator = line.indexOf("=");
    const name = line.slice(0, separator).trim();
    process.env[name] ??= line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (
  process.env.TELEGRAM_COMPANION_ENABLED !== "true" ||
  !url ||
  !serviceRoleKey ||
  !botToken
) {
  throw new Error("Telegram Companion server environment is unavailable.");
}

const limitArgument = process.argv.find((argument) =>
  argument.startsWith("--limit="),
);
const limit = Number(limitArgument?.split("=")[1] ?? "25");
if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
  throw new Error("--limit must be an integer between 1 and 100.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function firstRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

function decodeKey(value) {
  if (/^[a-f0-9]{64}$/i.test(value ?? "")) return Buffer.from(value, "hex");
  const decoded = Buffer.from(value ?? "", "base64");
  if (
    decoded.length !== 32 ||
    decoded.toString("base64").replace(/=+$/, "") !==
      String(value ?? "").replace(/=+$/, "")
  ) {
    throw new Error("Telegram Companion cryptography is unavailable.");
  }
  return decoded;
}

function bytea(value) {
  if (typeof value === "string" && value.startsWith("\\x")) {
    return Buffer.from(value.slice(2), "hex");
  }
  if (typeof value === "string" && /^[a-f0-9]+$/i.test(value)) {
    return Buffer.from(value, "hex");
  }
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new Error("Telegram Companion cryptography is unavailable.");
}

function decryptRoute(job) {
  const currentVersion = Number(
    process.env.TELEGRAM_COMPANION_KEY_VERSION || "1",
  );
  const envName =
    job.encryption_key_version === currentVersion
      ? "TELEGRAM_COMPANION_ENCRYPTION_KEY"
      : `TELEGRAM_COMPANION_ENCRYPTION_KEY_V${job.encryption_key_version}`;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    decodeKey(process.env[envName]),
    bytea(job.route_iv),
  );
  decipher.setAAD(
    Buffer.from("studydate:telegram-companion:v1:route", "utf8"),
  );
  decipher.setAuthTag(bytea(job.route_auth_tag));
  return Buffer.concat([
    decipher.update(bytea(job.route_ciphertext)),
    decipher.final(),
  ]).toString("utf8");
}

async function send(chatId, body) {
  let response;
  try {
    response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Pesan baru\n\n${body}`,
          link_preview_options: { is_disabled: true },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    return {
      ok: false,
      category: "delivery_uncertain",
      permanent: false,
    };
  }
  const raw = await response.text().catch(() => "");
  let payload;
  try {
    payload = raw.length <= 32768 ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }
  if (response.ok && payload?.ok && Number.isInteger(payload.result?.message_id)) {
    return { ok: true, messageId: payload.result.message_id };
  }
  if (response.status === 429) {
    return {
      ok: false,
      category: "rate_limited",
      retryAfterSeconds: Number.isInteger(payload?.parameters?.retry_after)
        ? payload.parameters.retry_after
        : undefined,
      permanent: false,
    };
  }
  if (response.status >= 500) {
    return {
      ok: false,
      category: "telegram_unavailable",
      permanent: false,
    };
  }
  return { ok: false, category: "delivery_rejected", permanent: true };
}

let delivered = 0;
let failed = 0;

for (let index = 0; index < limit; index += 1) {
  const { data, error } = await admin.rpc("claim_telegram_delivery");
  const job = firstRow(data);
  if (error) {
    failed += 1;
    break;
  }
  if (!job) break;

  let result;
  try {
    result = await send(decryptRoute(job), job.message_body);
  } catch {
    result = {
      ok: false,
      category: "delivery_uncertain",
      permanent: false,
    };
  }

  if (result.ok) {
    const completion = await admin.rpc("complete_telegram_delivery", {
      p_outbox_id: job.outbox_id,
      p_lease_token: job.lease_token,
      p_telegram_message_id: result.messageId,
    });
    if (completion.error) failed += 1;
    else delivered += 1;
  } else {
    const failure = await admin.rpc("fail_telegram_delivery", {
      p_outbox_id: job.outbox_id,
      p_lease_token: job.lease_token,
      p_failure_code: result.category,
      p_retry_after_seconds: result.retryAfterSeconds ?? null,
      p_permanent: result.permanent,
    });
    failed += failure.error ? 1 : 0;
  }
}

const cleanup = await admin.rpc("cleanup_telegram_companion_runtime", {
  p_limit: 500,
});
if (cleanup.error || failed > 0) process.exitCode = 1;
process.stdout.write(
  `Telegram delivery jobs: ${delivered} delivered, ${failed} failed; runtime cleanup ${Number(cleanup.data ?? 0)}.\n`,
);
