import "server-only";

import {
  createDecipheriv,
  createCipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { normalizeNim } from "./validation";

type EncryptedValue = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

function fromBytea(value: string) {
  if (!value.startsWith("\\x")) {
    throw new Error("Verification data is unavailable.");
  }
  return Buffer.from(value.slice(2), "hex");
}

function readKey(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error("Verification cryptography is unavailable.");
  }

  const decoded = /^[a-f0-9]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64");

  if (decoded.length !== 32) {
    throw new Error("Verification cryptography is unavailable.");
  }
  return decoded;
}

function bytea(value: Buffer) {
  return `\\x${value.toString("hex")}`;
}

export function encryptVerificationValue(plaintext: string): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    readKey("STUDENT_VERIFICATION_ENCRYPTION_KEY"),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(plaintext.trim(), "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: bytea(ciphertext),
    iv: bytea(iv),
    authTag: bytea(cipher.getAuthTag()),
  };
}

export function decryptVerificationValue(value: EncryptedValue) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    readKey("STUDENT_VERIFICATION_ENCRYPTION_KEY"),
    fromBytea(value.iv),
  );
  decipher.setAuthTag(fromBytea(value.authTag));
  return Buffer.concat([
    decipher.update(fromBytea(value.ciphertext)),
    decipher.final(),
  ]).toString("utf8");
}

export function fingerprintNim(nim: string) {
  return createHmac(
    "sha256",
    readKey("STUDENT_VERIFICATION_HMAC_KEY"),
  )
    .update(normalizeNim(nim))
    .digest("hex");
}

export function hashCampusEmailCode(
  requestId: string,
  email: string,
  code: string,
) {
  return createHmac(
    "sha256",
    readKey("STUDENT_VERIFICATION_HMAC_KEY"),
  )
    .update(`${requestId}:${email}:${code}`)
    .digest("hex");
}

export function codeHashesMatch(actual: string, expected: string) {
  if (!/^[a-f0-9]{64}$/.test(actual) || !/^[a-f0-9]{64}$/.test(expected)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}
