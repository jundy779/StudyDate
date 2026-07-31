"use server";

import { requireOwner } from "@/lib/staff/authorization";
import { manageStaffMember } from "@/lib/staff/service";
import { staffActionSchema } from "@/lib/staff/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateStaffMember(formData: FormData) {
  await requireOwner();
  const parsed = staffActionSchema.safeParse({
    targetUserId: formData.get("targetUserId"),
    action: formData.get("action"),
  });
  if (!parsed.success) redirect("/owner/staff?state=invalid");
  try {
    await manageStaffMember(parsed.data.targetUserId, parsed.data.action);
  } catch {
    redirect("/owner/staff?state=error");
  }
  revalidatePath("/owner/staff");
  revalidatePath("/owner/audit");
  redirect("/owner/staff?state=saved");
}
