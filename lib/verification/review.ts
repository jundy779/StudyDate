import "server-only";

import { createServerAdminClient } from "@/lib/supabase/admin";
import { VERIFICATION_BUCKET } from "./constants";
import { decryptVerificationValue } from "./crypto";
import type { RegistryResult, StudentRegistryVerifier } from "./registry";

export type OwnershipReview =
  | "not_checked"
  | "campus_email_verified"
  | "document_verified"
  | "failed";

export type ManualReviewDecision = {
  requestId: string;
  reviewerId: string;
  requestStatus:
    | "under_review"
    | "needs_action"
    | "verified"
    | "rejected"
    | "expired";
  academicResult: RegistryResult;
  ownershipResult: OwnershipReview;
  rejectionReasonCode?: string;
};

export class StudentVerificationReviewService {
  constructor(private readonly registry: StudentRegistryVerifier) {}

  private async authorizeReviewer(reviewerId: string) {
    const admin = createServerAdminClient();
    if (!admin || !reviewerId) {
      throw new Error("Verification review is unavailable.");
    }
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
    if (
      error ||
      membershipError ||
      !membership ||
      membership.status !== "active" ||
      !membership.verification_reviewer ||
      !["owner", "admin"].includes(membership.role) ||
      data.user?.app_metadata?.role !== membership.role ||
      data.user?.app_metadata?.verification_reviewer !== true ||
      data.user?.user_metadata?.verification_reviewer === true
    ) {
      throw new Error("Reviewer authorization is required.");
    }
    return admin;
  }

  async beginManualReview(requestId: string, reviewerId: string) {
    await this.authorizeReviewer(reviewerId);
    return this.registry.verify({ requestId });
  }

  async finalize(decision: ManualReviewDecision) {
    const admin = await this.authorizeReviewer(decision.reviewerId);
    const { error } = await admin.rpc("finalize_student_verification_review", {
      p_request_id: decision.requestId,
      p_actor_id: decision.reviewerId,
      p_request_status: decision.requestStatus,
      p_pddikti_match_status: decision.academicResult,
      p_ownership_status: decision.ownershipResult,
      p_rejection_reason_code: decision.rejectionReasonCode ?? null,
    });
    if (error) throw new Error("Verification review could not be completed.");
  }

  async createEvidenceReviewUrl(requestId: string, reviewerId: string) {
    const admin = await this.authorizeReviewer(reviewerId);
    const { data: request, error } = await admin
      .from("student_verification_requests")
      .select("evidence_path")
      .eq("id", requestId)
      .eq("method", "student_card")
      .maybeSingle<{ evidence_path: string | null }>();
    if (error || !request?.evidence_path) {
      throw new Error("Evidence is unavailable.");
    }
    const { data, error: signedUrlError } = await admin.storage
      .from(VERIFICATION_BUCKET)
      .createSignedUrl(request.evidence_path, 300);
    if (signedUrlError || !data.signedUrl) {
      throw new Error("Evidence is unavailable.");
    }
    return data.signedUrl;
  }

  async createPddiktiEvidenceReviewUrl(
    requestId: string,
    reviewerId: string,
  ) {
    const admin = await this.authorizeReviewer(reviewerId);
    const { data: request, error } = await admin
      .from("student_verification_requests")
      .select("pddikti_evidence_path")
      .eq("id", requestId)
      .maybeSingle<{ pddikti_evidence_path: string | null }>();
    if (error || !request?.pddikti_evidence_path) {
      throw new Error("PDDikti evidence is unavailable.");
    }
    const { data, error: signedUrlError } = await admin.storage
      .from(VERIFICATION_BUCKET)
      .createSignedUrl(request.pddikti_evidence_path, 300);
    if (signedUrlError || !data.signedUrl) {
      throw new Error("PDDikti evidence is unavailable.");
    }
    return data.signedUrl;
  }

  async getManualReviewClaim(requestId: string, reviewerId: string) {
    const admin = await this.authorizeReviewer(reviewerId);
    const { data, error } = await admin
      .from("student_verification_requests")
      .select(
        "id, campus_claim, study_program_claim, degree_level_claim, semester_claim, nim_ciphertext, nim_iv, nim_auth_tag, legal_name_ciphertext, legal_name_iv, legal_name_auth_tag",
      )
      .eq("id", requestId)
      .in("status", ["pending", "under_review", "needs_action", "verified"])
      .maybeSingle();
    if (error || !data) throw new Error("Verification claim is unavailable.");

    return {
      requestId: data.id,
      campus: data.campus_claim,
      studyProgram: data.study_program_claim,
      degreeLevel: data.degree_level_claim,
      semester: data.semester_claim,
      nim: decryptVerificationValue({
        ciphertext: data.nim_ciphertext,
        iv: data.nim_iv,
        authTag: data.nim_auth_tag,
      }),
      legalName: decryptVerificationValue({
        ciphertext: data.legal_name_ciphertext,
        iv: data.legal_name_iv,
        authTag: data.legal_name_auth_tag,
      }),
    };
  }
}

export async function deleteExpiredVerificationEvidence(nowIso: string) {
  const admin = createServerAdminClient();
  if (!admin) throw new Error("Evidence deletion is unavailable.");
  const { error: expiryError } = await admin.rpc(
    "expire_overdue_student_verification_requests",
  );
  if (expiryError) throw new Error("Evidence deletion is unavailable.");
  const { data, error } = await admin
    .from("student_verification_requests")
    .select(
      "id, evidence_path, evidence_deletion_at, pddikti_evidence_path, pddikti_evidence_deletion_at",
    )
    .in("status", ["verified", "rejected", "expired", "cancelled"])
    .or(
      `evidence_deletion_at.lte.${nowIso},pddikti_evidence_deletion_at.lte.${nowIso}`,
    )
    .limit(100);
  if (error) throw new Error("Evidence deletion is unavailable.");

  let processedCount = 0;
  let failedCount = 0;
  for (const request of data ?? []) {
    const dueStudentCard =
      request.evidence_path &&
      request.evidence_deletion_at &&
      request.evidence_deletion_at <= nowIso;
    const duePddikti =
      request.pddikti_evidence_path &&
      request.pddikti_evidence_deletion_at &&
      request.pddikti_evidence_deletion_at <= nowIso;
    const paths = [
      dueStudentCard ? request.evidence_path : null,
      duePddikti ? request.pddikti_evidence_path : null,
    ].filter((path): path is string => Boolean(path));
    if (!paths.length) continue;

    const { error: removalError } = await admin.storage
      .from(VERIFICATION_BUCKET)
      .remove(paths);
    if (removalError) {
      failedCount += 1;
      continue;
    }

    const { error: recordError } = await admin.rpc(
      "record_student_verification_evidence_cleanup",
      {
        p_request_id: request.id,
        p_student_card_deleted: Boolean(dueStudentCard),
        p_pddikti_deleted: Boolean(duePddikti),
      },
    );
    if (recordError) {
      failedCount += 1;
      continue;
    }
    processedCount += 1;
  }
  const { data: remainingCount, error: countError } = await admin.rpc(
    "count_due_student_verification_evidence",
    { p_now: nowIso },
  );
  if (countError) throw new Error("Evidence deletion is unavailable.");
  return {
    processedCount,
    failedCount,
    remainingCount: Number(remainingCount ?? 0),
  };
}

export async function recordVerificationCleanupHealth(
  status: "running" | "succeeded" | "failed",
  counts: {
    processedCount: number;
    failedCount: number;
    remainingCount: number;
  },
) {
  const admin = createServerAdminClient();
  if (!admin) throw new Error("Cleanup health is unavailable.");
  const { error } = await admin.rpc(
    "record_student_verification_cleanup_health",
    {
      p_status: status,
      p_processed_count: counts.processedCount,
      p_failed_count: counts.failedCount,
      p_remaining_count: counts.remainingCount,
    },
  );
  if (error) throw new Error("Cleanup health is unavailable.");
}
