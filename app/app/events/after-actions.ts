"use server";

import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  claimEventCertificate,
  revokeEventCertificate,
  revokeMyCertificate,
  setEventCertificateSettings,
  setEventRecap,
  submitEventFeedback,
} from "@/lib/events/after";
import {
  CERTIFICATE_CODE_PATTERN,
  eventCertificateClaimSchema,
  eventCertificateSettingsSchema,
  eventFeedbackSchema,
  eventRecapSchema,
  normalizeCertificateCode,
} from "@/lib/events/after-rules";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireStudent() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  if (profile.deactivated_at) redirect("/account-deactivated");
}

function slugOf(formData: FormData) {
  const value = formData.get("publicSlug");
  return typeof value === "string" && /^event-[0-9a-f]{24}$/.test(value) ? value : null;
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function back(path: string, state: string, notice?: string, hash = ""): never {
  const query = new URLSearchParams({ state });
  if (notice) query.set("notice", notice);
  return redirect(`${path}?${query.toString()}${hash}`);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function submitEventFeedbackAction(formData: FormData) {
  await requireStudent();
  const slug = slugOf(formData);
  if (!slug) redirect("/app/events?state=error");
  const detail = `/app/events/${slug}`;
  const parsed = eventFeedbackSchema.safeParse({
    publicSlug: slug,
    rating: formData.get("rating"),
    comment: text(formData, "comment"),
    wouldAttendAgain: text(formData, "wouldAttendAgain"),
  });
  if (!parsed.success) {
    back(detail, "feedback-error", parsed.error.issues[0]?.message, "#ulasan");
  }
  try {
    await submitEventFeedback({
      publicSlug: parsed.data.publicSlug,
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
      wouldAttendAgain:
        parsed.data.wouldAttendAgain === "" ? null : parsed.data.wouldAttendAgain === "yes",
    });
  } catch (error) {
    back(detail, "feedback-error", errorMessage(error, "Ulasan belum tersimpan."), "#ulasan");
  }
  revalidatePath(detail);
  revalidatePath("/app/events");
  back(detail, "feedback-saved", undefined, "#ulasan");
}

export async function setEventRecapAction(formData: FormData) {
  await requireStudent();
  const slug = slugOf(formData);
  if (!slug) redirect("/app/events?state=error");
  const path = `/app/events/${slug}/manage/after`;
  const parsed = eventRecapSchema.safeParse({ publicSlug: slug, body: text(formData, "body") });
  if (!parsed.success) back(path, "error", parsed.error.issues[0]?.message, "#rekap");
  try {
    await setEventRecap(parsed.data.publicSlug, parsed.data.body || null);
  } catch (error) {
    back(path, "error", errorMessage(error, "Rekap belum tersimpan."), "#rekap");
  }
  revalidatePath(path);
  revalidatePath(`/app/events/${slug}`);
  back(path, parsed.data.body ? "recap-saved" : "recap-removed", undefined, "#rekap");
}

export async function setEventCertificateSettingsAction(formData: FormData) {
  await requireStudent();
  const slug = slugOf(formData);
  if (!slug) redirect("/app/events?state=error");
  const path = `/app/events/${slug}/manage/after`;
  const parsed = eventCertificateSettingsSchema.safeParse({
    publicSlug: slug,
    enabled: formData.get("enabled") === "on",
    eligibility: text(formData, "eligibility"),
    requiresFeedback: formData.get("requiresFeedback") === "on",
  });
  if (!parsed.success) back(path, "error", "Pengaturan sertifikat tidak valid.", "#sertifikat");
  try {
    await setEventCertificateSettings(parsed.data);
  } catch (error) {
    back(path, "error", errorMessage(error, "Pengaturan belum tersimpan."), "#sertifikat");
  }
  revalidatePath(path);
  revalidatePath(`/app/events/${slug}`);
  back(path, "certificate-settings-saved", undefined, "#sertifikat");
}

export async function revokeEventCertificateAction(formData: FormData) {
  await requireStudent();
  const slug = slugOf(formData);
  const registration = text(formData, "registrationPublicId");
  if (!slug || !/^[0-9a-f]{32}$/.test(registration)) redirect("/app/events?state=error");
  const path = `/app/events/${slug}/manage/after`;
  try {
    await revokeEventCertificate(slug, registration);
  } catch (error) {
    back(path, "error", errorMessage(error, "Sertifikat belum bisa dicabut."), "#sertifikat");
  }
  revalidatePath(path);
  back(path, "certificate-revoked", undefined, "#sertifikat");
}

export async function claimEventCertificateAction(formData: FormData) {
  await requireStudent();
  const slug = slugOf(formData);
  if (!slug) redirect("/app/events?state=error");
  const detail = `/app/events/${slug}`;
  const parsed = eventCertificateClaimSchema.safeParse({
    publicSlug: slug,
    recipientName: text(formData, "recipientName"),
    confirmsPublicName: formData.get("confirmsPublicName") === "on",
  });
  if (!parsed.success) {
    back(detail, "certificate-error", parsed.error.issues[0]?.message, "#sertifikat");
  }
  try {
    await claimEventCertificate(parsed.data.publicSlug, parsed.data.recipientName);
  } catch (error) {
    back(detail, "certificate-error", errorMessage(error, "Sertifikat belum bisa dibuat."), "#sertifikat");
  }
  revalidatePath(detail);
  revalidatePath("/app/certificates");
  back(detail, "certificate-issued", undefined, "#sertifikat");
}

export async function revokeMyCertificateAction(formData: FormData) {
  await requireStudent();
  const code = normalizeCertificateCode(formData.get("verifyCode"));
  if (!CERTIFICATE_CODE_PATTERN.test(code)) redirect("/app/certificates?state=error");
  try {
    await revokeMyCertificate(code);
  } catch {
    redirect("/app/certificates?state=error");
  }
  revalidatePath("/app/certificates");
  revalidatePath(`/certificates/${code}`);
  redirect("/app/certificates?state=revoked");
}
