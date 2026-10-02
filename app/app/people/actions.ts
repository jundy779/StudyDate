"use server";

import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  setOwnDiscoveryVisibility,
  setOwnStudyStatus,
} from "@/lib/people/service";
import { isStudyStatus } from "@/lib/people/study-status";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updatePeopleVisibility(formData: FormData) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const isDiscoverable = formData.get("isDiscoverable") === "on";
  await setOwnDiscoveryVisibility(isDiscoverable);
  revalidatePath("/app");
  revalidatePath("/app/people");
  redirect(`/app/people?visibility=${isDiscoverable ? "on" : "off"}`);
}


export async function updateStudyStatus(formData: FormData) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const rawStatus = String(formData.get("studyStatus") ?? "").trim();
  const status = rawStatus && isStudyStatus(rawStatus) ? rawStatus : null;
  if (rawStatus && !status) {
    redirect("/app/people?studyStatus=invalid");
  }

  try {
    await setOwnStudyStatus(status);
  } catch {
    redirect("/app/people?studyStatus=error");
  }

  revalidatePath("/app");
  revalidatePath("/app/people");
  redirect(`/app/people?studyStatus=${rawStatus ? "saved" : "cleared"}`);
}
