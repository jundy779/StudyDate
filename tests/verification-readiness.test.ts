import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVerificationReadiness,
} from "../lib/verification/readiness-core.ts";

test("verification is disabled by default and fails closed", () => {
  const readiness = buildVerificationReadiness({
    enabled: false,
    encryptionConfigured: false,
    hmacConfigured: false,
    keysSeparated: false,
    emailDeliveryConfigured: false,
    evidenceStorageConfigured: true,
    cleanupConfigured: false,
    controlledTestUsersConfigured: false,
  });
  assert.equal(readiness.enabled, false);
  assert.equal(readiness.readyForControlledTesting, false);
  assert.equal(readiness.encryptionConfigured, false);
  assert.equal(readiness.hmacConfigured, false);
});

test("malformed cryptography configuration is not ready", () => {
  const readiness = buildVerificationReadiness({
    enabled: true,
    encryptionConfigured: false,
    hmacConfigured: true,
    keysSeparated: true,
    emailDeliveryConfigured: true,
    evidenceStorageConfigured: true,
    cleanupConfigured: true,
    controlledTestUsersConfigured: true,
  });
  assert.equal(readiness.encryptionConfigured, false);
  assert.equal(readiness.hmacConfigured, true);
  assert.equal(readiness.readyForControlledTesting, false);
});

test("controlled testing requires every server dependency", () => {
  const readiness = buildVerificationReadiness({
    enabled: true,
    encryptionConfigured: true,
    hmacConfigured: true,
    keysSeparated: true,
    emailDeliveryConfigured: true,
    evidenceStorageConfigured: true,
    cleanupConfigured: true,
    controlledTestUsersConfigured: true,
  });
  assert.deepEqual(readiness, {
    enabled: true,
    encryptionConfigured: true,
    hmacConfigured: true,
    keysSeparated: true,
    emailDeliveryConfigured: true,
    evidenceStorageConfigured: true,
    cleanupConfigured: true,
    controlledTestUsersConfigured: true,
    readyForControlledTesting: true,
  });
});
