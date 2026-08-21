"use server";

import {
  NOTIFICATION_TYPES,
  type NotificationType,
} from "@/lib/notifications/constants";
import { setNotificationPreference } from "@/lib/notifications/preferences";
import { revalidatePath } from "next/cache";

export async function updateNotificationPreference(formData: FormData) {
  const type = formData.get("type");
  if (
    typeof type !== "string" ||
    !NOTIFICATION_TYPES.includes(type as NotificationType)
  ) {
    return;
  }
  await setNotificationPreference(
    type as NotificationType,
    formData.get("enabled") === "true",
  );
  revalidatePath("/app/settings");
}
