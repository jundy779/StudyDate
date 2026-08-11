import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

export const TELEGRAM_ENCRYPTION_KEY_ENV =
  "TELEGRAM_COMPANION_ENCRYPTION_KEY";
export const TELEGRAM_HMAC_KEY_ENV = "TELEGRAM_COMPANION_HMAC_KEY";
export const TELEGRAM_KEY_VERSION_ENV =
  "TELEGRAM_COMPANION_KEY_VERSION";
export const TELEGRAM_DEFAULT_KEY_VERSION = 1;

export type TelegramEncryptedRoute = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

function decodeKey(value: string | undefined) {
  if (!value) return null;
  if (/^[a-f0-9]{64}$/i.test(value)) return Buffer.from(value, "hex");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const decoded = Buffer.from(value, "base64");
  return decoded.toString("base64").replace(/=+$/, "") ===
    value.replace(/=+$/, "")
    ? decoded
    : null;
}

function readKey(name: string, env: NodeJS.ProcessEnv) {
  const key = decodeKey(env[name]);
  if (!key || key.length !== 32) {
    throw new Error("Telegram Companion cryptography is unavailable.");
  }
  return key;
}

function parseKeyVersion(env: NodeJS.ProcessEnv) {
  const raw = env[TELEGRAM_KEY_VERSION_ENV]?.trim();
  if (!raw) return TELEGRAM_DEFAULT_KEY_VERSION;
  if (!/^[1-9][0-9]{0,4}$/.test(raw)) {
    throw new Error("Telegram Companion cryptography is unavailable.");
  }
  return Number.parseInt(raw, 10);
}

function encryptionKey(version: number, env: NodeJS.ProcessEnv) {
  const current = parseKeyVersion(env);
  const name =
    version === current
      ? TELEGRAM_ENCRYPTION_KEY_ENV
      : `${TELEGRAM_ENCRYPTION_KEY_ENV}_V${version}`;
  return readKey(name, env);
}

function bytea(value: Buffer) {
  return `\\x${value.toString("hex")}`;
}

function fromBytea(value: string) {
  if (!/^\\x[0-9a-f]+$/i.test(value)) {
    throw new Error("Telegram Companion cryptography is unavailable.");
  }
  return Buffer.from(value.slice(2), "hex");
}

export function isTelegramCompanionCryptoConfigured(
  env: NodeJS.ProcessEnv = process.env,
) {
  try {
    const version = parseKeyVersion(env);
    encryptionKey(version, env);
    readKey(TELEGRAM_HMAC_KEY_ENV, env);
    return true;
  } catch {
    return false;
  }
}

export function createTelegramLinkToken() {
  return randomBytes(24).toString("base64url");
}

function hmac(
  domain: "identity" | "link-token",
  value: string,
  env: NodeJS.ProcessEnv,
) {
  return createHmac("sha256", readKey(TELEGRAM_HMAC_KEY_ENV, env))
    .update(`studydate:telegram-companion:v1:${domain}\0${value}`, "utf8")
    .digest("hex");
}

export function hashTelegramLinkToken(
  token: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) {
    throw new Error("Telegram Companion link is unavailable.");
  }
  return hmac("link-token", token, env);
}

export function fingerprintTelegramIdentity(
  telegramUserId: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!/^[1-9][0-9]{0,18}$/.test(telegramUserId)) {
    throw new Error("Telegram Companion identity is unavailable.");
  }
  return hmac("identity", telegramUserId, env);
}

export function encryptTelegramRoute(
  telegramChatId: string,
  env: NodeJS.ProcessEnv = process.env,
): TelegramEncryptedRoute {
  if (!/^-?[1-9][0-9]{0,18}$/.test(telegramChatId)) {
    throw new Error("Telegram Companion route is unavailable.");
  }
  const keyVersion = parseKeyVersion(env);
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    encryptionKey(keyVersion, env),
    iv,
  );
  cipher.setAAD(Buffer.from("studydate:telegram-companion:v1:route", "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(telegramChatId, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: bytea(ciphertext),
    iv: bytea(iv),
    authTag: bytea(cipher.getAuthTag()),
    keyVersion,
  };
}

export function decryptTelegramRoute(
  encrypted: TelegramEncryptedRoute,
  env: NodeJS.ProcessEnv = process.env,
) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(encrypted.keyVersion, env),
    fromBytea(encrypted.iv),
  );
  decipher.setAAD(Buffer.from("studydate:telegram-companion:v1:route", "utf8"));
  decipher.setAuthTag(fromBytea(encrypted.authTag));
  const route = Buffer.concat([
    decipher.update(fromBytea(encrypted.ciphertext)),
    decipher.final(),
  ]).toString("utf8");
  if (!/^-?[1-9][0-9]{0,18}$/.test(route)) {
    throw new Error("Telegram Companion route is unavailable.");
  }
  return route;
}

export function normalizeTelegramBytea(value: unknown) {
  if (typeof value === "string") {
    if (/^\\x[0-9a-f]+$/i.test(value)) return value;
    if (/^[0-9a-f]+$/i.test(value)) return `\\x${value}`;
  }
  if (value instanceof Uint8Array) return bytea(Buffer.from(value));
  throw new Error("Telegram Companion cryptography is unavailable.");
}
