import "server-only";

import {
  NOTIFICATION_TYPES,
  type NotificationType,
} from "@/lib/notifications/constants";
import { createClient } from "@/lib/supabase/server";

export type NotificationPreference = {
  type: NotificationType;
  inAppEnabled: boolean;
};

export async function listNotificationPreferences(): Promise<
  NotificationPreference[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "list_my_notification_preferences",
  );
  if (error) return [];
  const saved = new Map(
    ((data ?? []) as {
      notification_type: NotificationType;
      in_app_enabled: boolean;
    }[]).map((row) => [row.notification_type, row.in_app_enabled]),
  );
  return NOTIFICATION_TYPES.map((type) => ({
    type,
    inAppEnabled: saved.get(type) ?? true,
  }));
}

export async function setNotificationPreference(
  type: NotificationType,
  enabled: boolean,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_notification_preference", {
    p_notification_type: type,
    p_in_app_enabled: enabled,
  });
  if (error) throw new Error("Preferensi notifikasi belum dapat disimpan.");
}
