"use server";

import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  CONTACT_DISCLOSURE_MESSAGE,
  GENERIC_INTRODUCTION_ERROR,
} from "@/lib/introductions/constants";
import {
  acceptIntroductionRequest,
  blockStudentByAlias,
  cancelIntroductionRequest,
  declineIntroductionRequest,
  reportIntroductionRequest,
  sendIntroductionRequest,
} from "@/lib/introductions/service";
import {
  introductionRequestIdSchema,
  reportIntroductionSchema,
  sendIntroductionSchema,
} from "@/lib/introductions/validation";
import { peopleAliasSchema, toPeopleAliasPathSegment } from "@/lib/people/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireOnboardedStudent() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  return { user, profile };
}

function peopleDetailPath(alias: string, query = "") {
  return `/app/people/${toPeopleAliasPathSegment(alias)}${query}`;
}

function revalidateIntroductionPaths(alias?: string) {
  revalidatePath("/app/introductions");
  revalidatePath("/app/people");
  if (alias) {
    revalidatePath(peopleDetailPath(alias));
  }
}

export async function submitIntroduction(formData: FormData) {
  await requireOnboardedStudent();

  const parsed = sendIntroductionSchema.safeParse({
    recipientAlias: formData.get("recipientAlias"),
    openingMessage: formData.get("openingMessage"),
  });

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? CONTACT_DISCLOSURE_MESSAGE;
    const rawAlias = String(formData.get("recipientAlias") ?? "");
    const alias = peopleAliasSchema.safeParse(rawAlias).success
      ? rawAlias
      : null;
    redirect(
      alias
        ? `${peopleDetailPath(alias)}?intro=invalid&notice=${encodeURIComponent(message)}`
        : `/app/people?notice=${encodeURIComponent(message)}`,
    );
  }

  try {
    await sendIntroductionRequest(
      parsed.data.recipientAlias,
      parsed.data.openingMessage,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : GENERIC_INTRODUCTION_ERROR;
    redirect(
      `${peopleDetailPath(parsed.data.recipientAlias)}?intro=error&notice=${encodeURIComponent(message)}`,
    );
  }

  revalidateIntroductionPaths(parsed.data.recipientAlias);
  redirect(
    `/app/introductions?tab=terkirim&state=sent`,
  );
}

export async function acceptIntroduction(formData: FormData) {
  await requireOnboardedStudent();
  const parsed = introductionRequestIdSchema.safeParse(formData.get("requestId"));
  if (!parsed.success) {
    redirect("/app/introductions?tab=masuk&state=error");
  }

  try {
    await acceptIntroductionRequest(parsed.data);
  } catch {
    redirect("/app/introductions?tab=masuk&state=error");
  }

  revalidateIntroductionPaths();
  redirect("/app/introductions?tab=masuk&state=accepted");
}

export async function declineIntroduction(formData: FormData) {
  await requireOnboardedStudent();
  const parsed = introductionRequestIdSchema.safeParse(formData.get("requestId"));
  if (!parsed.success) {
    redirect("/app/introductions?tab=masuk&state=error");
  }

  try {
    await declineIntroductionRequest(parsed.data);
  } catch {
    redirect("/app/introductions?tab=masuk&state=error");
  }

  revalidateIntroductionPaths();
  redirect("/app/introductions?tab=masuk&state=declined");
}

export async function cancelIntroduction(formData: FormData) {
  await requireOnboardedStudent();
  const parsed = introductionRequestIdSchema.safeParse(formData.get("requestId"));
  if (!parsed.success) {
    redirect("/app/introductions?tab=terkirim&state=error");
  }

  try {
    await cancelIntroductionRequest(parsed.data);
  } catch {
    redirect("/app/introductions?tab=terkirim&state=error");
  }

  revalidateIntroductionPaths();
  redirect("/app/introductions?tab=terkirim&state=cancelled");
}

export async function blockFromIntroduction(formData: FormData) {
  await requireOnboardedStudent();
  const alias = peopleAliasSchema.safeParse(formData.get("alias"));
  if (!alias.success) {
    redirect("/app/introductions?tab=masuk&state=error");
  }

  try {
    await blockStudentByAlias(alias.data);
  } catch {
    redirect("/app/introductions?tab=masuk&state=error");
  }

  revalidateIntroductionPaths(alias.data);
  redirect("/app/introductions?tab=masuk&state=blocked");
}

export async function reportFromIntroduction(formData: FormData) {
  await requireOnboardedStudent();
  const parsed = reportIntroductionSchema.safeParse({
    requestId: formData.get("requestId"),
    reasonCode: formData.get("reasonCode"),
    details: formData.get("details") ?? undefined,
  });

  if (!parsed.success) {
    redirect("/app/introductions?tab=masuk&state=invalid");
  }

  try {
    await reportIntroductionRequest(
      parsed.data.requestId,
      parsed.data.reasonCode,
      parsed.data.details,
    );
  } catch {
    redirect("/app/introductions?tab=masuk&state=error");
  }

  revalidateIntroductionPaths();
  redirect("/app/introductions?tab=masuk&state=reported");
}
