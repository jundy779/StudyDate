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
    cleanupHealthy: false,
    reviewerConfigured: false,
    providerConfigured: false,
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
    cleanupHealthy: true,
    reviewerConfigured: true,
    providerConfigured: false,
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
    cleanupHealthy: true,
    reviewerConfigured: true,
    providerConfigured: true,
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
    cleanupHealthy: true,
    reviewerConfigured: true,
    providerConfigured: true,
    controlledTestUsersConfigured: true,
    manualCardReady: true,
    manualEmailReady: true,
    providerReady: true,
    readyForControlledTesting: true,
  });
});

test("controlled testing stays closed without an authorized reviewer", () => {
  const readiness = buildVerificationReadiness({
    enabled: false,
    encryptionConfigured: true,
    hmacConfigured: true,
    keysSeparated: true,
    emailDeliveryConfigured: true,
    evidenceStorageConfigured: true,
    cleanupConfigured: true,
    cleanupHealthy: true,
    reviewerConfigured: false,
    providerConfigured: false,
    controlledTestUsersConfigured: true,
  });
  assert.equal(readiness.readyForControlledTesting, false);
});

test("manual card pilot does not require email or provider configuration", () => {
  const readiness = buildVerificationReadiness({
    enabled: false,
    encryptionConfigured: true,
    hmacConfigured: true,
    keysSeparated: true,
    emailDeliveryConfigured: false,
    evidenceStorageConfigured: true,
    cleanupConfigured: true,
    cleanupHealthy: true,
    reviewerConfigured: true,
    providerConfigured: false,
    controlledTestUsersConfigured: true,
  });
  assert.equal(readiness.manualCardReady, true);
  assert.equal(readiness.manualEmailReady, false);
  assert.equal(readiness.providerReady, false);
  assert.equal(readiness.readyForControlledTesting, true);
});

test("stale cleanup health keeps every verification lane closed", () => {
  const readiness = buildVerificationReadiness({
    enabled: false,
    encryptionConfigured: true,
    hmacConfigured: true,
    keysSeparated: true,
    emailDeliveryConfigured: true,
    evidenceStorageConfigured: true,
    cleanupConfigured: true,
    cleanupHealthy: false,
    reviewerConfigured: true,
    providerConfigured: true,
    controlledTestUsersConfigured: true,
  });
  assert.equal(readiness.manualCardReady, false);
  assert.equal(readiness.manualEmailReady, false);
  assert.equal(readiness.providerReady, false);
});
