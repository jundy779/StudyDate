import "server-only";

import { createServerAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";
import { VERIFICATION_CONSENT_VERSION } from "./constants";
import {
  encryptVerificationValue,
  fingerprintAcademicClaim,
  fingerprintNim,
} from "./crypto";
import {
  isPddiktiProviderEnabled,
  PddiktiAcademicLookupProvider,
} from "./pddikti-provider";
import { runAcademicLookupProvider } from "./lookup-core";
import type {
  AcademicLookupClaim,
  AcademicLookupOutcome,
  AcademicLookupProvider,
} from "./provider-core";
import { isVerificationRequestAllowed } from "./readiness";
import { normalizeNim } from "./validation";

export type AcademicLookupInput = AcademicLookupClaim & {
  providerConsent: "true";
  degreeLevel:
    | "diploma"
    | "sarjana"
    | "magister"
    | "doktor"
    | "profesi"
    | "spesialis";
  semester: number | null;
};

export class AcademicLookupServiceError extends Error {
  public readonly category:
    | "configuration"
    | "authorization"
    | "rate_limit"
    | "duplicate"
    | "database";

  constructor(
    category:
      | "configuration"
      | "authorization"
      | "rate_limit"
      | "duplicate"
      | "database",
  ) {
    super("Academic lookup could not be completed.");
    this.category = category;
  }
}

function safeOutcome(outcome: AcademicLookupOutcome) {
  return { outcome };
}

export async function lookupAcademicIdentity(
  userId: string,
  input: AcademicLookupInput,
  provider: AcademicLookupProvider = new PddiktiAcademicLookupProvider(),
) {
  if (!(await isVerificationRequestAllowed(userId))) {
    throw new AcademicLookupServiceError("configuration");
  }
  const admin = createServerAdminClient();
  if (!admin) throw new AcademicLookupServiceError("configuration");

  const { data: eligible, error: eligibleError } = await admin.rpc(
    "is_eligible_verification_student",
    { p_user_id: userId },
  );
  const outcome = await runAcademicLookupProvider(input, provider, {
    eligible: !eligibleError && eligible === true,
    providerReady: isPddiktiProviderEnabled(),
  });
  if (outcome === null) {
    throw new AcademicLookupServiceError("authorization");
  }
  if (outcome !== "academic_match") {
    return safeOutcome(outcome);
  }

  const normalizedNim = normalizeNim(input.nim);
  const nimFingerprint = fingerprintNim(normalizedNim);
  const academicClaimFingerprint = fingerprintAcademicClaim(input);
  const { data: reusable } = await admin
    .from("student_verification_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("method", "academic_pending")
    .eq("status", "under_review")
    .eq("pddikti_match_status", "matched")
    .eq("nim_fingerprint", nimFingerprint)
    .eq("academic_claim_fingerprint", academicClaimFingerprint)
    .maybeSingle<{ id: string }>();
  if (reusable) {
    return { outcome, requestId: reusable.id };
  }

  const encryptedNim = encryptVerificationValue(normalizedNim);
  const encryptedName = encryptVerificationValue(input.legalName);
  const requestId = randomUUID();
  const { error } = await admin.rpc("create_pddikti_academic_match_request", {
    p_user_id: userId,
    p_request_id: requestId,
    p_campus_claim: input.campus,
    p_study_program_claim: input.studyProgram,
    p_degree_level_claim: input.degreeLevel,
    p_semester_claim: input.semester,
    p_nim_ciphertext: encryptedNim.ciphertext,
    p_nim_iv: encryptedNim.iv,
    p_nim_auth_tag: encryptedNim.authTag,
    p_nim_last_four: normalizedNim.slice(-4),
    p_nim_fingerprint: nimFingerprint,
    p_legal_name_ciphertext: encryptedName.ciphertext,
    p_legal_name_iv: encryptedName.iv,
    p_legal_name_auth_tag: encryptedName.authTag,
    p_academic_claim_fingerprint: academicClaimFingerprint,
    p_consent_version: VERIFICATION_CONSENT_VERSION,
  });
  if (error) {
    throw new AcademicLookupServiceError(
      error.code === "23505" ? "duplicate" : "database",
    );
  }
  return { outcome, requestId };
}
