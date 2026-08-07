import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type ContactEncryptedValue = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

export const KEY_ENV = "CONTACT_REVEAL_ENCRYPTION_KEY";
export const KEY_VERSION_ENV = "CONTACT_REVEAL_KEY_VERSION";
/** Default current writing version when CONTACT_REVEAL_KEY_VERSION is unset. */
export const CONTACT_REVEAL_DEFAULT_KEY_VERSION = 1;

function fromBytea(value: string) {
  if (!value.startsWith("\\x")) {
    throw new Error("Contact cryptography is unavailable.");
  }
  return Buffer.from(value.slice(2), "hex");
}

function decodeKey(value: string) {
  if (/^[a-f0-9]{64}$/i.test(value)) {
    return Buffer.from(value, "hex");
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return null;
  }
  const decoded = Buffer.from(value, "base64");
  const canonical = decoded.toString("base64").replace(/=+$/, "");
  if (canonical !== value.replace(/=+$/, "")) {
    return null;
  }
  return decoded;
}

function parsePositiveVersion(raw: string | undefined, fallback: number) {
  if (raw === undefined || raw.trim() === "") return fallback;
  if (!/^[1-9][0-9]{0,4}$/.test(raw.trim())) {
    throw new Error("Contact cryptography is unavailable.");
  }
  return Number.parseInt(raw.trim(), 10);
}

/** Current version used for new Contact Reveal ciphertext writes. */
export function getContactRevealCurrentKeyVersion(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return parsePositiveVersion(
    env[KEY_VERSION_ENV],
    CONTACT_REVEAL_DEFAULT_KEY_VERSION,
  );
}

/**
 * Resolve the 32-byte key material for an explicit key version.
 * Current version → CONTACT_REVEAL_ENCRYPTION_KEY.
 * Prior versions → CONTACT_REVEAL_ENCRYPTION_KEY_V{n} only (never inferred from ciphertext).
 */
export function resolveContactRevealKeyMaterial(
  keyVersion: number,
  env: NodeJS.ProcessEnv = process.env,
): Buffer {
  if (!Number.isInteger(keyVersion) || keyVersion < 1) {
    throw new Error("Contact cryptography is unavailable.");
  }

  const currentVersion = getContactRevealCurrentKeyVersion(env);
  const envName =
    keyVersion === currentVersion ? KEY_ENV : `${KEY_ENV}_V${keyVersion}`;

  const value = env[envName];
  if (!value) {
    throw new Error("Contact cryptography is unavailable.");
  }
  const decoded = decodeKey(value);
  if (!decoded || decoded.length !== 32) {
    throw new Error("Contact cryptography is unavailable.");
  }
  return decoded;
}

export function isContactRevealKeyConfigured(
  env: NodeJS.ProcessEnv = process.env,
) {
  try {
    resolveContactRevealKeyMaterial(getContactRevealCurrentKeyVersion(env), env);
    return true;
  } catch {
    return false;
  }
}

/**
 * True when a specific historical version can be decrypted
 * (current key or CONTACT_REVEAL_ENCRYPTION_KEY_V{n}).
 */
export function isContactRevealKeyVersionConfigured(
  keyVersion: number,
  env: NodeJS.ProcessEnv = process.env,
) {
  try {
    resolveContactRevealKeyMaterial(keyVersion, env);
    return true;
  } catch {
    return false;
  }
}

function bytea(value: Buffer) {
  return `\\x${value.toString("hex")}`;
}

export function encryptContactValue(
  plaintext: string,
  env: NodeJS.ProcessEnv = process.env,
): ContactEncryptedValue {
  const keyVersion = getContactRevealCurrentKeyVersion(env);
  const key = resolveContactRevealKeyMaterial(keyVersion, env);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: bytea(ciphertext),
    iv: bytea(iv),
    authTag: bytea(cipher.getAuthTag()),
    keyVersion,
  };
}

export function decryptContactValue(
  value: {
    ciphertext: string;
    iv: string;
    authTag: string;
    keyVersion: number;
  },
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!Number.isInteger(value.keyVersion) || value.keyVersion < 1) {
    throw new Error("Contact cryptography is unavailable.");
  }
  const key = resolveContactRevealKeyMaterial(value.keyVersion, env);
  const decipher = createDecipheriv("aes-256-gcm", key, fromBytea(value.iv));
  decipher.setAuthTag(fromBytea(value.authTag));
  return Buffer.concat([
    decipher.update(fromBytea(value.ciphertext)),
    decipher.final(),
  ]).toString("utf8");
}

/** Convert Postgres bytea Buffer / hex / \\x hex into \\x hex for decrypt. */
export function normalizeByteaInput(value: unknown): string {
  if (typeof value === "string") {
    if (value.startsWith("\\x")) return value;
    if (/^[a-f0-9]+$/i.test(value)) return `\\x${value}`;
  }
  if (value instanceof Uint8Array) {
    return bytea(Buffer.from(value));
  }
  throw new Error("Contact cryptography is unavailable.");
}
