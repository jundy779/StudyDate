"use server";

import { requireOwner } from "@/lib/staff/authorization";
import { updateModerationReportStatus } from "@/lib/moderation/service";
import { moderationStatusUpdateSchema } from "@/lib/moderation/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateModerationReport(formData: FormData) {
  await requireOwner();
  const parsed = moderationStatusUpdateSchema.safeParse({
    reportId: formData.get("reportId"),
    newStatus: formData.get("newStatus"),
    internalNote: formData.get("internalNote") ?? undefined,
  });
  if (!parsed.success) {
    redirect("/owner/moderation?state=invalid");
  }

  try {
    await updateModerationReportStatus({
      reportId: parsed.data.reportId,
      newStatus: parsed.data.newStatus,
      internalNote: parsed.data.internalNote,
    });
  } catch {
    redirect(
      `/owner/moderation/${parsed.data.reportId}?state=error`,
    );
  }

  revalidatePath("/owner/moderation");
  revalidatePath(`/owner/moderation/${parsed.data.reportId}`);
  redirect(`/owner/moderation/${parsed.data.reportId}?state=saved`);
}
