import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type ContactEncryptedValue = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

const KEY_ENV = "CONTACT_REVEAL_ENCRYPTION_KEY";
export const CONTACT_REVEAL_KEY_VERSION = 1;

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

export function isContactRevealKeyConfigured() {
  const value = process.env[KEY_ENV];
  if (!value) return false;
  const decoded = decodeKey(value);
  return decoded?.length === 32;
}

function readKey() {
  const value = process.env[KEY_ENV];
  if (!value) {
    throw new Error("Contact cryptography is unavailable.");
  }
  const decoded = decodeKey(value);
  if (!decoded || decoded.length !== 32) {
    throw new Error("Contact cryptography is unavailable.");
  }
  return decoded;
}

function bytea(value: Buffer) {
  return `\\x${value.toString("hex")}`;
}

export function encryptContactValue(plaintext: string): ContactEncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", readKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: bytea(ciphertext),
    iv: bytea(iv),
    authTag: bytea(cipher.getAuthTag()),
    keyVersion: CONTACT_REVEAL_KEY_VERSION,
  };
}

export function decryptContactValue(value: {
  ciphertext: string;
  iv: string;
  authTag: string;
}) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    readKey(),
    fromBytea(value.iv),
  );
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
