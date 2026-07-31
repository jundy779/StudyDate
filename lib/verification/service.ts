import "server-only";

import { createServerAdminClient } from "@/lib/supabase/admin";
import { randomInt, randomUUID } from "node:crypto";
import {
  CODE_EXPIRY_MINUTES,
  CODE_RESEND_SECONDS,
  MAX_CODE_ATTEMPTS,
  MAX_EVIDENCE_BYTES,
  VERIFICATION_BUCKET,
  VERIFICATION_CONSENT_VERSION,
} from "./constants";
import {
  encryptVerificationValue,
  fingerprintNim,
  hashCampusEmailCode,
} from "./crypto";
import {
  campusVerificationEmailSender,
  type CampusVerificationEmailSender,
} from "./email-sender";
import { normalizeNim } from "./validation";
import { isVerificationRequestAllowed } from "./readiness";

const SUPPORTED_FILES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export type SubmissionInput = {
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
  method: "campus_email" | "student_card";
};

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
  const admin = createServerAdminClient();
  if (!admin) throw new VerificationServiceError("configuration");
  const verificationAdmin = admin;

  let evidencePath: string | null = null;
  let pddiktiEvidencePath: string | null = null;
  const requestId = randomUUID();
  const normalizedNim = normalizeNim(input.nim);
  const encryptedNim = encryptVerificationValue(normalizedNim);
  const encryptedName = encryptVerificationValue(input.legalName);

  function isSupportedEvidence(file: File | null): file is File {
    return Boolean(
      file &&
        file.size >= 1 &&
        file.size <= MAX_EVIDENCE_BYTES &&
        SUPPORTED_FILES.has(file.type),
    );
  }

  if (!isSupportedEvidence(pddiktiEvidence)) {
    throw new VerificationServiceError("evidence");
  }
  if (
    (input.method === "student_card" &&
      !isSupportedEvidence(studentCardEvidence)) ||
    (input.method === "campus_email" && studentCardEvidence)
  ) {
    throw new VerificationServiceError("evidence");
  }

  async function uploadEvidence(file: File, category: string) {
    const extension = SUPPORTED_FILES.get(file.type);
    const path = `${userId}/${requestId}/${category}/${randomUUID()}.${extension}`;
    const { error } = await verificationAdmin.storage
      .from(VERIFICATION_BUCKET)
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        cacheControl: "private, max-age=0",
        upsert: false,
      });
    if (error) throw new VerificationServiceError("evidence");
    return path;
  }

  try {
    pddiktiEvidencePath = await uploadEvidence(
      pddiktiEvidence,
      "pddikti",
    );
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

  const { error } = await admin.rpc("create_student_verification_request_v2", {
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
    !["pending", "needs_action"].includes(request.status) ||
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
  const { error } = await admin
    .from("campus_email_verifications")
    .upsert(challenge, { onConflict: "request_id" });
  if (error) throw new VerificationServiceError("database");

  try {
    await sender.send({
      recipient: email,
      code,
      expiresInMinutes: CODE_EXPIRY_MINUTES,
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
  if (error || data !== "verified") {
    throw new VerificationServiceError("challenge");
  }
}
