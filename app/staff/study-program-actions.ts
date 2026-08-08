"use server";

import { requireActiveStaff } from "@/lib/staff/authorization";
import { manageStudyProgramOption } from "@/lib/study-program/service";
import { studyProgramManageSchema } from "@/lib/study-program/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function redirectBase(role: "owner" | "admin") {
  return role === "owner" ? "/owner/study-programs" : "/admin/study-programs";
}

export async function submitStudyProgramManage(formData: FormData) {
  const access = await requireActiveStaff();
  const base = redirectBase(access.role);
  const parsed = studyProgramManageSchema.safeParse({
    action: formData.get("action"),
    id: formData.get("id") || null,
    name: formData.get("name") || null,
  });

  if (!parsed.success) {
    redirect(`${base}?state=invalid`);
  }

  try {
    await manageStudyProgramOption(parsed.data);
  } catch {
    redirect(`${base}?state=error`);
  }

  revalidatePath("/owner/study-programs");
  revalidatePath("/admin/study-programs");
  revalidatePath("/onboarding");
  redirect(`${base}?state=saved`);
}
