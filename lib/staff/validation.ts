import { EARLY_ACCESS_REVIEW_REASON_CODES } from "../early-access/review-reasons.ts";
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
    "grant_early_access_review",
    "remove_early_access_review",
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
      "grant_early_access_review",
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

export const earlyAccessReviewActionSchema = z
  .object({
    email: z.string().trim().toLowerCase().min(3).max(254).email(),
    action: z.enum(["approve", "reject", "needs_revision", "resend", "remind"]),
    reasonCodes: z.array(z.enum(EARLY_ACCESS_REVIEW_REASON_CODES)).max(7).default([]),
    userNote: z.string().trim().max(500).default(""),
    internalNote: z.string().trim().max(800).default(""),
  })
  .superRefine((value, ctx) => {
    if (
      (value.action === "reject" || value.action === "needs_revision") &&
      value.reasonCodes.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasonCodes"],
        message: "Pilih minimal satu alasan review.",
      });
    }

    if (
      value.action === "needs_revision" &&
      value.reasonCodes.includes("other") &&
      !value.userNote
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["userNote"],
        message: "Tambahkan catatan untuk alasan lainnya.",
      });
    }
  });
