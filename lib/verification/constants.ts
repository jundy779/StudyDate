export const VERIFICATION_CONSENT_VERSION = "student-verification-v1";
export const VERIFICATION_BUCKET = "student-verification-evidence";
export const MAX_VERIFICATION_REQUEST_BYTES = 10_800_000;
export const MAX_EVIDENCE_BYTES = 5_242_880;
export const MAX_CODE_ATTEMPTS = 5;
export const CODE_EXPIRY_MINUTES = 10;
export const CODE_RESEND_SECONDS = 60;

export const REQUEST_STATUSES = [
  "pending",
  "under_review",
  "needs_action",
  "verified",
  "rejected",
  "expired",
  "cancelled",
] as const;

export const VERIFICATION_STATUS_LABELS = {
  pending: "Sedang diperiksa",
  under_review: "Sedang diperiksa",
  needs_action: "Perlu tindakan",
  verified: "Terverifikasi",
  rejected: "Data belum dapat diverifikasi",
  expired: "Kedaluwarsa",
  cancelled: "Belum terverifikasi",
} as const;

export type VerificationRequestStatus = (typeof REQUEST_STATUSES)[number];
