"use server";

import { manageCampusOption } from "@/lib/campus/service";
import { campusManageSchema } from "@/lib/campus/validation";
import { requireActiveStaff } from "@/lib/staff/authorization";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function redirectBase(role: "owner" | "admin") {
  return role === "owner" ? "/owner/campuses" : "/admin/campuses";
}

export async function submitCampusManage(formData: FormData) {
  const access = await requireActiveStaff();
  const base = redirectBase(access.role);
  const parsed = campusManageSchema.safeParse({
    action: formData.get("action"),
    id: formData.get("id") || null,
    name: formData.get("name") || null,
  });

  if (!parsed.success) {
    redirect(`${base}?state=invalid`);
  }

  try {
    await manageCampusOption(parsed.data);
  } catch {
    redirect(`${base}?state=error`);
  }

  revalidatePath("/owner/campuses");
  revalidatePath("/admin/campuses");
  revalidatePath("/onboarding");
  redirect(`${base}?state=saved`);
}
