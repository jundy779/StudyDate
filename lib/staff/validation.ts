import { z } from "zod";

export const staffActionSchema = z.object({
  targetUserId: z.string().uuid(),
  action: z.enum([
    "deactivate_admin",
    "reactivate_admin",
    "grant_reviewer",
    "remove_reviewer",
    "grant_early_access",
    "remove_early_access",
    "grant_users_read",
    "remove_users_read",
    "grant_users_support",
    "remove_users_support",
  ]),
}).strict();

export const staffEmailAssignSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(254)
      .email("Masukkan alamat email yang valid."),
    action: z.enum([
      "grant_admin",
      "grant_reviewer",
      "grant_early_access",
      "grant_users_read",
      "grant_users_support",
    ]),
  })
  .strict();

export const verificationReviewSchema = z.object({
  requestId: z.string().uuid(),
  requestStatus: z.enum([
    "under_review",
    "needs_action",
    "verified",
    "rejected",
    "expired",
  ]),
  academicResult: z.enum(["matched", "not_found", "mismatch", "unavailable"]),
  ownershipResult: z.enum([
    "not_checked",
    "campus_email_verified",
    "document_verified",
    "failed",
  ]),
  rejectionReasonCode: z
    .enum([
      "academic_not_found",
      "academic_mismatch",
      "registry_unavailable",
      "ownership_failed",
      "evidence_unreadable",
      "additional_information_required",
    ])
    .optional(),
}).strict();

export const manualAcademicReviewSchema = z
  .object({
    requestId: z.string().uuid(),
    decision: z.enum(["approve", "reject", "needs_action"]),
  })
  .strict();

export const verificationInvalidationSchema = z
  .object({ requestId: z.string().uuid() })
  .strict();
