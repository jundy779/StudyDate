"use server";

import {
  NOTIFICATION_TYPES,
  type NotificationType,
} from "@/lib/notifications/constants";
import { setNotificationPreference } from "@/lib/notifications/preferences";
import { setMyEventEmailPreference } from "@/lib/events/announcement-email";
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

export async function updateEventEmailPreference(formData: FormData) {
  const value = formData.get("enabled");
  if (value !== "true" && value !== "false") return;
  await setMyEventEmailPreference(value === "true").catch(() => undefined);
  revalidatePath("/app/settings");
}
