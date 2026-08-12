import "server-only";

import { createServerAdminClient } from "@/lib/supabase/admin";
import { randomInt, randomUUID } from "node:crypto";
import {
  CODE_EXPIRY_MINUTES,
  CODE_RESEND_SECONDS,
  MAX_CODE_ATTEMPTS,
  VERIFICATION_BUCKET,
  VERIFICATION_CONSENT_VERSION,
} from "./constants";
import {
  encryptVerificationValue,
  fingerprintNim,
  hashCampusEmailCode,
} from "./crypto";
import { processVerificationEvidence } from "./evidence";
import {
  campusVerificationEmailSender,
  type CampusVerificationEmailSender,
} from "./email-sender";
import { normalizeNim } from "./validation";
import {
  getVerificationCapabilities,
  isVerificationRequestAllowed,
} from "./readiness";

export type SubmissionInput = {
  method: "campus_email" | "student_card";
} & (
  | {
      flow: "academic_matched";
      requestId: string;
    }
  | {
      flow: "manual";
      requestId: null;
      nim: string;
      legalName: string;
      campus: string;
      studyProgram: string;
      degreeLevel:
        | "diploma"
        | "sarjana"
        | "magister"
        | "doktor"
        | "profesi"
        | "spesialis";
      semester: number | null;
    }
);

export class VerificationServiceError extends Error {
  constructor(
    public readonly category:
      | "configuration"
      | "duplicate"
      | "evidence"
      | "database"
      | "email_domain"
      | "cooldown"
      | "challenge",
  ) {
    super("Student verification request could not be completed.");
  }
}

export async function submitVerificationRequest(
  userId: string,
  input: SubmissionInput,
  studentCardEvidence: File | null,
  pddiktiEvidence: File | null,
) {
  if (!(await isVerificationRequestAllowed(userId))) {
    throw new VerificationServiceError("configuration");
  }
  const capabilities = await getVerificationCapabilities(userId);
  if (
    (input.method === "campus_email" && !capabilities.manualEmail) ||
    (input.method === "student_card" && !capabilities.manualCard) ||
    (input.flow === "academic_matched" && !capabilities.provider)
  ) {
    throw new VerificationServiceError("configuration");
  }
  const admin = createServerAdminClient();
  if (!admin) throw new VerificationServiceError("configuration");
  const verificationAdmin = admin;
  const requestId =
    input.flow === "academic_matched" ? input.requestId : randomUUID();

  let evidencePath: string | null = null;
  let pddiktiEvidencePath: string | null = null;

  if (
    (input.flow === "manual" && !pddiktiEvidence) ||
    (input.flow === "academic_matched" && pddiktiEvidence) ||
    (input.method === "student_card" && !studentCardEvidence) ||
    (input.method === "campus_email" && studentCardEvidence)
  ) {
    throw new VerificationServiceError("evidence");
  }

  async function uploadEvidence(file: File, category: string) {
    const processed = await processVerificationEvidence(file);
    const path = `${userId}/${requestId}/${category}/${randomUUID()}.${processed.extension}`;
    const { error } = await verificationAdmin.storage
      .from(VERIFICATION_BUCKET)
      .upload(path, processed.buffer, {
        contentType: processed.contentType,
        cacheControl: "private, max-age=0",
        upsert: false,
      });
    if (error) throw new VerificationServiceError("evidence");
    return path;
  }

  try {
    if (pddiktiEvidence) {
      pddiktiEvidencePath = await uploadEvidence(pddiktiEvidence, "pddikti");
    }
    if (input.method === "student_card" && studentCardEvidence) {
      evidencePath = await uploadEvidence(studentCardEvidence, "student-card");
    }
  } catch (error) {
    const uploadedPaths = [pddiktiEvidencePath, evidencePath].filter(
      (path): path is string => Boolean(path),
    );
    if (uploadedPaths.length) {
      await admin.storage.from(VERIFICATION_BUCKET).remove(uploadedPaths);
    }
    throw error;
  }

  if (input.flow === "academic_matched") {
    const { error } = await admin.rpc("complete_student_verification_ownership", {
      p_user_id: userId,
      p_request_id: requestId,
      p_method: input.method,
      p_evidence_path: evidencePath,
    });
    if (error) {
      if (evidencePath) {
        await admin.storage.from(VERIFICATION_BUCKET).remove([evidencePath]);
      }
      throw new VerificationServiceError("database");
    }
    return { requestId };
  }

  const normalizedNim = normalizeNim(input.nim);
  const encryptedNim = encryptVerificationValue(normalizedNim);
  const encryptedName = encryptVerificationValue(input.legalName);
  const { error } = await admin.rpc("create_manual_academic_review_request", {
    p_user_id: userId,
    p_request_id: requestId,
    p_method: input.method,
    p_campus_claim: input.campus,
    p_study_program_claim: input.studyProgram,
    p_degree_level_claim: input.degreeLevel,
    p_semester_claim: input.semester,
    p_nim_ciphertext: encryptedNim.ciphertext,
    p_nim_iv: encryptedNim.iv,
    p_nim_auth_tag: encryptedNim.authTag,
    p_nim_last_four: normalizedNim.slice(-4),
    p_nim_fingerprint: fingerprintNim(normalizedNim),
    p_legal_name_ciphertext: encryptedName.ciphertext,
    p_legal_name_iv: encryptedName.iv,
    p_legal_name_auth_tag: encryptedName.authTag,
    p_consent_version: VERIFICATION_CONSENT_VERSION,
    p_evidence_path: evidencePath,
    p_pddikti_evidence_path: pddiktiEvidencePath,
  });

  if (error) {
    const uploadedPaths = [pddiktiEvidencePath, evidencePath].filter(
      (path): path is string => Boolean(path),
    );
    if (uploadedPaths.length) {
      await admin.storage.from(VERIFICATION_BUCKET).remove(uploadedPaths);
    }
    throw new VerificationServiceError(
      error.code === "23505" ? "duplicate" : "database",
    );
  }
  return { requestId };
}

export async function sendCampusEmailCode(
  userId: string,
  requestId: string,
  email: string,
  sender: CampusVerificationEmailSender = campusVerificationEmailSender,
) {
  if (!(await isVerificationRequestAllowed(userId))) {
    throw new VerificationServiceError("configuration");
  }
  const admin = createServerAdminClient();
  if (!admin) throw new VerificationServiceError("configuration");

  const domain = email.split("@")[1];
  const [{ data: request }, { data: domainRecord }] = await Promise.all([
    admin
      .from("student_verification_requests")
      .select("id, user_id, method, status, campus_claim")
      .eq("id", requestId)
      .eq("user_id", userId)
    .eq("pddikti_match_status", "matched")
      .maybeSingle(),
    admin
      .from("campus_email_domains")
      .select("domain, campus_name")
      .eq("domain", domain)
      .eq("status", "approved")
      .maybeSingle(),
  ]);

  if (
    !request ||
    request.method !== "campus_email" ||
    !["pending", "under_review", "needs_action"].includes(request.status) ||
    !domainRecord ||
    request.campus_claim.trim().toLocaleLowerCase("id-ID") !==
      domainRecord.campus_name.trim().toLocaleLowerCase("id-ID")
  ) {
    throw new VerificationServiceError("email_domain");
  }

  const { data: existing } = await admin
    .from("campus_email_verifications")
    .select("resend_available_at")
    .eq("request_id", requestId)
    .maybeSingle<{ resend_available_at: string }>();
  if (
    existing &&
    new Date(existing.resend_available_at).getTime() > Date.now()
  ) {
    throw new VerificationServiceError("cooldown");
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const now = Date.now();
  const challenge = {
    request_id: requestId,
    user_id: userId,
    normalized_email: email,
    code_hash: hashCampusEmailCode(requestId, email, code),
    expires_at: new Date(now + CODE_EXPIRY_MINUTES * 60_000).toISOString(),
    attempts: 0,
    resend_available_at: new Date(now + CODE_RESEND_SECONDS * 1_000).toISOString(),
    verified_at: null,
  };
  const { error } = await admin.rpc("prepare_student_campus_email_challenge", {
    p_user_id: userId,
    p_request_id: requestId,
    p_normalized_email: challenge.normalized_email,
    p_code_hash: challenge.code_hash,
    p_expires_at: challenge.expires_at,
    p_resend_available_at: challenge.resend_available_at,
  });
  if (error) throw new VerificationServiceError("database");

  try {
    await sender.send({
      recipient: email,
      code,
      expiresInMinutes: CODE_EXPIRY_MINUTES,
      authorizeDelivery: async () => {
        const { error: authorizationError } = await admin.rpc(
          "authorize_student_campus_email_delivery",
          { p_user_id: userId, p_request_id: requestId },
        );
        if (authorizationError) throw new VerificationServiceError("challenge");
      },
    });
  } catch {
    await admin
      .from("campus_email_verifications")
      .delete()
      .eq("request_id", requestId)
      .eq("user_id", userId);
    throw new VerificationServiceError("challenge");
  }

  await admin.from("verification_events").insert({
    request_id: requestId,
    user_id: userId,
    actor_id: userId,
    event_type: "campus_email_sent",
  });
}

export async function confirmCampusEmailCode(
  userId: string,
  requestId: string,
  code: string,
) {
  if (!(await isVerificationRequestAllowed(userId))) {
    throw new VerificationServiceError("configuration");
  }
  const admin = createServerAdminClient();
  if (!admin) throw new VerificationServiceError("configuration");

  const { data: challenge } = await admin
    .from("campus_email_verifications")
    .select("normalized_email")
    .eq("request_id", requestId)
    .eq("user_id", userId)
    .maybeSingle<{ normalized_email: string }>();
  if (!challenge) throw new VerificationServiceError("challenge");

  const { data, error } = await admin.rpc(
    "confirm_student_campus_email_code",
    {
      p_user_id: userId,
      p_request_id: requestId,
      p_candidate_hash: hashCampusEmailCode(
        requestId,
        challenge.normalized_email,
        code,
      ),
      p_max_attempts: MAX_CODE_ATTEMPTS,
    },
  );
  if (error || data !== "ownership_verified") {
    throw new VerificationServiceError("challenge");
  }
}
