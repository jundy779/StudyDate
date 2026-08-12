import "server-only";

import { isStudyDateEmailConfigured } from "@/lib/email/mailer";
import { createServerAdminClient } from "@/lib/supabase/admin";
import {
  MAX_EVIDENCE_BYTES,
  VERIFICATION_BUCKET,
} from "./constants";
import {
  areVerificationKeysSeparated,
  isVerificationKeyConfigured,
} from "./crypto";
import { buildVerificationReadiness } from "./readiness-core";
import type { VerificationReadiness } from "./readiness-core";

export type { VerificationReadiness } from "./readiness-core";

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

async function inspectEvidenceStorage() {
  const admin = createServerAdminClient();
  if (!admin) return false;

  try {
    const { data, error } = await admin.storage.getBucket(VERIFICATION_BUCKET);
    if (error || !data || data.public) return false;

    const allowedTypes = new Set(data.allowed_mime_types ?? []);
    return (
      data.file_size_limit === MAX_EVIDENCE_BYTES &&
      ["image/jpeg", "image/png", "image/webp"].every((type) =>
        allowedTypes.has(type),
      )
    );
  } catch {
    return false;
  }
}

async function inspectReviewerConfiguration() {
  const reviewerId = process.env.STUDENT_VERIFICATION_REVIEWER_USER_ID;
  const admin = createServerAdminClient();
  if (!reviewerId || !UUID_PATTERN.test(reviewerId) || !admin) return false;

  try {
    const { data, error } = await admin.auth.admin.getUserById(reviewerId);
    const { data: membership, error: membershipError } = await admin
      .from("staff_members")
      .select("role, status, verification_reviewer")
      .eq("user_id", reviewerId)
      .maybeSingle<{
        role: "owner" | "admin";
        status: "active" | "inactive";
        verification_reviewer: boolean;
      }>();
    return Boolean(
      !error &&
        !membershipError &&
        membership?.status === "active" &&
        membership.verification_reviewer === true &&
        membership.role === data.user?.app_metadata?.role &&
        data.user?.app_metadata?.verification_reviewer === true &&
        data.user?.user_metadata?.verification_reviewer !== true,
    );
  } catch {
    return false;
  }
}

async function inspectCleanupHealth() {
  const admin = createServerAdminClient();
  if (!admin) return false;
  try {
    const { data, error } = await admin
      .from("student_verification_cleanup_health")
      .select("last_succeeded_at,last_status,last_failed_count,last_remaining_count")
      .eq("singleton", true)
      .maybeSingle<{
        last_succeeded_at: string | null;
        last_status: string;
        last_failed_count: number;
        last_remaining_count: number;
      }>();
    if (
      error ||
      !data?.last_succeeded_at ||
      data.last_status !== "succeeded" ||
      data.last_failed_count !== 0 ||
      data.last_remaining_count !== 0
    ) {
      return false;
    }
    return (
      Date.now() - new Date(data.last_succeeded_at).getTime() <=
      36 * 60 * 60 * 1_000
    );
  } catch {
    return false;
  }
}

export async function getVerificationReadiness(): Promise<VerificationReadiness> {
  const encryptionConfigured = isVerificationKeyConfigured(
    "STUDENT_VERIFICATION_ENCRYPTION_KEY",
  );
  const hmacConfigured = isVerificationKeyConfigured(
    "STUDENT_VERIFICATION_HMAC_KEY",
  );
  const emailDeliveryConfigured = isStudyDateEmailConfigured();
  const cleanupConfigured = Boolean(
    process.env.STUDENT_VERIFICATION_CLEANUP_SECRET &&
      process.env.STUDENT_VERIFICATION_CLEANUP_SECRET.length >= 32 &&
      process.env.CRON_SECRET &&
      process.env.CRON_SECRET.length >= 32 &&
      process.env.STUDENT_VERIFICATION_CLEANUP_SCHEDULED === "true",
  );
  const enabled = process.env.STUDENT_VERIFICATION_ENABLED === "true";
  const controlledTestUserIds = getControlledTestUserIds();
  const [evidenceStorageConfigured, cleanupHealthy, reviewerConfigured] =
    await Promise.all([
      inspectEvidenceStorage(),
      inspectCleanupHealth(),
      inspectReviewerConfiguration(),
    ]);
  const providerConfigured = Boolean(
    process.env.PDDIKTI_LOOKUP_PROVIDER_ENABLED === "true" &&
      process.env.PDDIKTI_PROVIDER_ACCESS_KEY &&
      process.env.PDDIKTI_PROVIDER_BASE_URL?.startsWith("https://"),
  );

  return buildVerificationReadiness({
    enabled,
    encryptionConfigured,
    hmacConfigured,
    keysSeparated: areVerificationKeysSeparated(),
    emailDeliveryConfigured,
    evidenceStorageConfigured,
    cleanupConfigured,
    cleanupHealthy,
    reviewerConfigured,
    providerConfigured,
    controlledTestUsersConfigured: controlledTestUserIds.size > 0,
  });
}

export async function isVerificationRequestAllowed(userId: string) {
  const controlledTestUserIds = getControlledTestUserIds();
  if (
    process.env.STUDENT_VERIFICATION_ENABLED !== "true" &&
    !controlledTestUserIds.has(userId)
  ) {
    return false;
  }

  const readiness = await getVerificationReadiness();
  if (readiness.enabled) {
    return readiness.manualCardReady;
  }
  return (
    readiness.readyForControlledTesting &&
    controlledTestUserIds.has(userId)
  );
}

export async function getVerificationCapabilities(userId: string) {
  const allowed = await isVerificationRequestAllowed(userId);
  if (!allowed) {
    return { manualCard: false, manualEmail: false, provider: false };
  }
  const readiness = await getVerificationReadiness();
  return {
    manualCard: readiness.manualCardReady,
    manualEmail: readiness.manualEmailReady,
    provider: readiness.providerReady,
  };
}
