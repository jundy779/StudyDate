import "server-only";

import { createServerAdminClient } from "@/lib/supabase/admin";
import {
  areVerificationKeysSeparated,
  isVerificationKeyConfigured,
} from "./crypto";
import { buildVerificationReadiness } from "./readiness-core";
import type { VerificationReadiness } from "./readiness-core";

export type { VerificationReadiness } from "./readiness-core";

function hasValidWebhookConfiguration() {
  const endpoint = process.env.STUDENT_VERIFICATION_EMAIL_WEBHOOK_URL;
  const token = process.env.STUDENT_VERIFICATION_EMAIL_WEBHOOK_TOKEN;
  if (!endpoint || !token) return false;

  try {
    const url = new URL(endpoint);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getControlledTestUserIds() {
  return new Set(
    (process.env.STUDENT_VERIFICATION_TEST_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => UUID_PATTERN.test(value)),
  );
}

export function getVerificationReadiness(): VerificationReadiness {
  const encryptionConfigured = isVerificationKeyConfigured(
    "STUDENT_VERIFICATION_ENCRYPTION_KEY",
  );
  const hmacConfigured = isVerificationKeyConfigured(
    "STUDENT_VERIFICATION_HMAC_KEY",
  );
  const evidenceStorageConfigured = Boolean(createServerAdminClient());
  const emailDeliveryConfigured = hasValidWebhookConfiguration();
  const cleanupConfigured = Boolean(
    process.env.STUDENT_VERIFICATION_CLEANUP_SECRET &&
      process.env.STUDENT_VERIFICATION_CLEANUP_SECRET.length >= 32 &&
      process.env.STUDENT_VERIFICATION_CLEANUP_SCHEDULED === "true",
  );
  const enabled = process.env.STUDENT_VERIFICATION_ENABLED === "true";
  const controlledTestUserIds = getControlledTestUserIds();

  return buildVerificationReadiness({
    enabled,
    encryptionConfigured,
    hmacConfigured,
    keysSeparated: areVerificationKeysSeparated(),
    emailDeliveryConfigured,
    evidenceStorageConfigured,
    cleanupConfigured,
    controlledTestUsersConfigured: controlledTestUserIds.size > 0,
  });
}

export function isVerificationRequestAllowed(userId: string) {
  const readiness = getVerificationReadiness();
  if (readiness.enabled) {
    return (
      readiness.encryptionConfigured &&
      readiness.hmacConfigured &&
      readiness.keysSeparated &&
      readiness.emailDeliveryConfigured &&
      readiness.evidenceStorageConfigured &&
      readiness.cleanupConfigured
    );
  }
  return (
    readiness.readyForControlledTesting &&
    getControlledTestUserIds().has(userId)
  );
}
