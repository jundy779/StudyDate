"use server";

import { requireOwner } from "@/lib/staff/authorization";
import {
  assignStaffByEmail,
  manageEarlyAccessReviewCapability,
  manageStaffMember,
} from "@/lib/staff/service";
import {
  staffActionSchema,
  staffEmailAssignSchema,
} from "@/lib/staff/validation";
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
    if (parsed.data.action === "grant_early_access_review") {
      await manageEarlyAccessReviewCapability(parsed.data.targetUserId, true);
    } else if (parsed.data.action === "remove_early_access_review") {
      await manageEarlyAccessReviewCapability(parsed.data.targetUserId, false);
    } else {
      await manageStaffMember(parsed.data.targetUserId, parsed.data.action);
    }
  } catch {
    redirect("/owner/staff?state=error");
  }
  revalidatePath("/owner/staff");
  revalidatePath("/owner/audit");
  redirect("/owner/staff?state=saved");
}

export async function assignStaffMemberByEmail(formData: FormData) {
  await requireOwner();
  const parsed = staffEmailAssignSchema.safeParse({
    email: formData.get("email"),
    action: formData.get("action") ?? "grant_admin",
  });
  if (!parsed.success) redirect("/owner/staff?state=invalid");

  const result = await assignStaffByEmail(
    parsed.data.email,
    parsed.data.action,
  );

  revalidatePath("/owner/staff");
  revalidatePath("/owner/audit");

  if (result === "not_found") redirect("/owner/staff?state=not_found");
  if (result === "ambiguous") redirect("/owner/staff?state=ambiguous");
  if (result === "error") redirect("/owner/staff?state=error");
  redirect("/owner/staff?state=saved");
}
