"use server";

import { requireVerificationReviewer } from "@/lib/staff/authorization";
import {
  finalizeStaffVerificationReview,
  invalidateStudentVerification,
  reviewManualAcademicMatch,
} from "@/lib/staff/service";
import {
  manualAcademicReviewSchema,
  verificationInvalidationSchema,
  verificationReviewSchema,
} from "@/lib/staff/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function submitVerificationReview(formData: FormData) {
  await requireVerificationReviewer();
  const parsed = verificationReviewSchema.safeParse({
    requestId: formData.get("requestId"),
    requestStatus: formData.get("requestStatus"),
    academicResult: formData.get("academicResult"),
    ownershipResult: formData.get("ownershipResult"),
    rejectionReasonCode: formData.get("rejectionReasonCode") || undefined,
  });
  if (!parsed.success) redirect("/admin/verifications?state=invalid");
  try {
    await finalizeStaffVerificationReview(parsed.data);
  } catch {
    redirect(`/admin/verifications/${parsed.data.requestId}?state=error`);
  }
  revalidatePath("/admin/verifications");
  redirect("/admin/verifications?state=saved");
}

export async function submitManualAcademicReview(formData: FormData) {
  await requireVerificationReviewer();
  const parsed = manualAcademicReviewSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) redirect("/admin/verifications?state=invalid");
  try {
    await reviewManualAcademicMatch(parsed.data);
  } catch {
    redirect(`/admin/verifications/${parsed.data.requestId}?state=error`);
  }
  revalidatePath("/admin/verifications");
  redirect("/admin/verifications?state=saved");
}

export async function invalidateVerification(formData: FormData) {
  await requireVerificationReviewer();
  const parsed = verificationInvalidationSchema.safeParse({
    requestId: formData.get("requestId"),
  });
  if (!parsed.success) redirect("/admin/verifications?state=invalid");
  try {
    await invalidateStudentVerification(parsed.data.requestId);
  } catch {
    redirect(`/admin/verifications/${parsed.data.requestId}?state=error`);
  }
  revalidatePath("/admin/verifications");
  redirect("/admin/verifications?state=invalidated");
}
