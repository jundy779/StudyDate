/**
 * Local Contact Reveal key recovery / rotation drills.
 * Uses synthetic hex keys only. Never reads production .env.local values.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import {
  decryptContactValue,
  encryptContactValue,
  getContactRevealCurrentKeyVersion,
  isContactRevealKeyConfigured,
  isContactRevealKeyVersionConfigured,
  KEY_ENV,
  KEY_VERSION_ENV,
  type ContactEncryptedValue,
} from "../lib/contact-reveal/crypto-core.ts";

function syntheticKey() {
  return randomBytes(32).toString("hex");
}

function withEnv<T>(
  patch: Record<string, string | undefined>,
  run: () => T,
): T {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    previous[key] = process.env[key];
    const next = patch[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  try {
    return run();
  } finally {
    for (const key of Object.keys(patch)) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function mutateAuthTag(value: ContactEncryptedValue): ContactEncryptedValue {
  const hex = value.authTag.replace(/^\\x/, "");
  const bytes = Buffer.from(hex, "hex");
  bytes[0] = bytes[0] ^ 0xff;
  return { ...value, authTag: `\\x${bytes.toString("hex")}` };
}

test("recovery: encrypt with A, decrypt with A", () => {
  const keyA = syntheticKey();
  withEnv(
    {
      [KEY_ENV]: keyA,
      [KEY_VERSION_ENV]: "1",
      [`${KEY_ENV}_V1`]: undefined,
      [`${KEY_ENV}_V2`]: undefined,
    },
    () => {
      assert.equal(isContactRevealKeyConfigured(), true);
      assert.equal(getContactRevealCurrentKeyVersion(), 1);
      const sealed = encryptContactValue("synthetic_telegram_handle");
      assert.equal(sealed.keyVersion, 1);
      const plain = decryptContactValue(sealed);
      assert.equal(plain, "synthetic_telegram_handle");
    },
  );
});

test("recovery: removing A causes controlled failure; restoring A works", () => {
  const keyA = syntheticKey();
  let sealed!: ContactEncryptedValue;
  withEnv(
    {
      [KEY_ENV]: keyA,
      [KEY_VERSION_ENV]: "1",
    },
    () => {
      sealed = encryptContactValue("restore_drill_handle");
    },
  );

  withEnv(
    {
      [KEY_ENV]: undefined,
      [KEY_VERSION_ENV]: "1",
      [`${KEY_ENV}_V1`]: undefined,
    },
    () => {
      assert.equal(isContactRevealKeyConfigured(), false);
      assert.throws(
        () => decryptContactValue(sealed),
        /Contact cryptography is unavailable/,
      );
    },
  );

  withEnv(
    {
      [KEY_ENV]: keyA,
      [KEY_VERSION_ENV]: "1",
    },
    () => {
      assert.equal(decryptContactValue(sealed), "restore_drill_handle");
    },
  );
});

test("recovery: key B does not decrypt A ciphertext", () => {
  const keyA = syntheticKey();
  const keyB = syntheticKey();
  let sealed!: ContactEncryptedValue;
  withEnv(
    { [KEY_ENV]: keyA, [KEY_VERSION_ENV]: "1" },
    () => {
      sealed = encryptContactValue("wrong_key_probe");
    },
  );

  withEnv(
    {
      [KEY_ENV]: keyB,
      [KEY_VERSION_ENV]: "1",
      [`${KEY_ENV}_V1`]: undefined,
    },
    () => {
      assert.throws(() => decryptContactValue(sealed));
    },
  );
});

test("recovery: malformed ciphertext and auth-tag tamper fail closed", () => {
  const keyA = syntheticKey();
  withEnv(
    { [KEY_ENV]: keyA, [KEY_VERSION_ENV]: "1" },
    () => {
      const sealed = encryptContactValue("tamper_probe");
      assert.throws(() =>
        decryptContactValue({
          ...sealed,
          ciphertext: "\\x00",
        }),
      );
      assert.throws(() => decryptContactValue(mutateAuthTag(sealed)));
      assert.throws(() =>
        decryptContactValue({
          ...sealed,
          keyVersion: 0,
        }),
      );
      assert.throws(() =>
        decryptContactValue({
          ...sealed,
          keyVersion: 99,
        }),
      );
    },
  );
});

test("recovery: missing key never falls back to plaintext", () => {
  const keyA = syntheticKey();
  let sealed!: ContactEncryptedValue;
  withEnv(
    { [KEY_ENV]: keyA, [KEY_VERSION_ENV]: "1" },
    () => {
      sealed = encryptContactValue("no_plaintext_fallback");
    },
  );
  withEnv(
    {
      [KEY_ENV]: undefined,
      [KEY_VERSION_ENV]: "1",
      [`${KEY_ENV}_V1`]: undefined,
    },
    () => {
      assert.throws(() => decryptContactValue(sealed));
      assert.notEqual(sealed.ciphertext.includes("no_plaintext"), true);
    },
  );
});

test("rotation: A encrypt → configure A+B with B current → old decrypts via V1, new writes B", () => {
  const keyA = syntheticKey();
  const keyB = syntheticKey();
  let sealedA!: ContactEncryptedValue;

  withEnv(
    { [KEY_ENV]: keyA, [KEY_VERSION_ENV]: "1" },
    () => {
      sealedA = encryptContactValue("legacy_channel_handle");
      assert.equal(sealedA.keyVersion, 1);
    },
  );

  withEnv(
    {
      [KEY_ENV]: keyB,
      [KEY_VERSION_ENV]: "2",
      [`${KEY_ENV}_V1`]: keyA,
      [`${KEY_ENV}_V2`]: undefined,
    },
    () => {
      assert.equal(getContactRevealCurrentKeyVersion(), 2);
      assert.equal(isContactRevealKeyVersionConfigured(1), true);
      assert.equal(isContactRevealKeyVersionConfigured(2), true);
      assert.equal(decryptContactValue(sealedA), "legacy_channel_handle");

      const sealedB = encryptContactValue("new_channel_handle");
      assert.equal(sealedB.keyVersion, 2);
      assert.equal(decryptContactValue(sealedB), "new_channel_handle");

      // Retiring A too early (remove V1) fails closed for legacy rows.
      const withoutA = {
        [KEY_ENV]: keyB,
        [KEY_VERSION_ENV]: "2",
        [`${KEY_ENV}_V1`]: undefined as string | undefined,
      };
      withEnv(withoutA, () => {
        assert.equal(isContactRevealKeyVersionConfigured(1), false);
        assert.throws(() => decryptContactValue(sealedA));
        assert.equal(decryptContactValue(sealedB), "new_channel_handle");
      });
    },
  );
});

test("rotation: unknown key version fails closed without guessing", () => {
  const keyA = syntheticKey();
  withEnv(
    { [KEY_ENV]: keyA, [KEY_VERSION_ENV]: "1" },
    () => {
      const sealed = encryptContactValue("version_gate");
      assert.throws(() =>
        decryptContactValue({ ...sealed, keyVersion: 7 }),
      );
    },
  );
});
