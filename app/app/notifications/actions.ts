"use server";

import { requireActiveStudentAppAccess } from "@/lib/account/guard";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/service";
import { notificationPublicIdSchema } from "@/lib/notifications/validation";
import { revalidatePath } from "next/cache";

export async function markNotificationReadAction(formData: FormData) {
  await requireActiveStudentAppAccess();
  const parsed = notificationPublicIdSchema.safeParse(
    formData.get("notificationPublicId"),
  );
  if (!parsed.success) return { ok: false };

  try {
    const ok = await markNotificationRead(parsed.data);
    revalidatePath("/app/notifications");
    return { ok };
  } catch {
    return { ok: false };
  }
}

export async function markAllNotificationsReadAction() {
  await requireActiveStudentAppAccess();

  try {
    await markAllNotificationsRead();
    revalidatePath("/app/notifications");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
