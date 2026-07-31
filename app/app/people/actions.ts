"use server";

import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { setOwnDiscoveryVisibility } from "@/lib/people/service";
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
