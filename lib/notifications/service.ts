import "server-only";

import {
  NOTIFICATION_TYPES,
  type NotificationChannel,
  type NotificationItem,
  type NotificationType,
} from "@/lib/notifications/constants";
import { createClient } from "@/lib/supabase/server";

type NotificationRow = {
  notification_public_id: string;
  notification_type: string;
  target_path: string;
  channel: string | null;
  created_at: string;
  read_at: string | null;
};

const typeSet = new Set<string>(NOTIFICATION_TYPES);
const channelSet = new Set<string>(["telegram", "instagram", "linkedin"]);

function isSafeTargetPath(path: string): boolean {
  return (
    path === "/app/introductions" ||
    /^\/app\/messages\/[0-9a-f]{32}$/.test(path)
  );
}

function mapNotification(row: NotificationRow): NotificationItem | null {
  if (
    !/^[0-9a-f]{32}$/.test(row.notification_public_id) ||
    !typeSet.has(row.notification_type) ||
    !isSafeTargetPath(row.target_path) ||
    (row.channel !== null && !channelSet.has(row.channel))
  ) {
    return null;
  }

  return {
    publicId: row.notification_public_id,
    type: row.notification_type as NotificationType,
    targetPath: row.target_path,
    channel: row.channel as NotificationChannel | null,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export async function listNotifications(options?: {
  limit?: number;
  beforeCreatedAt?: string;
  beforePublicId?: string;
  unreadOnly?: boolean;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_notifications", {
    p_limit: options?.limit ?? 21,
    p_before_created_at: options?.beforeCreatedAt ?? null,
    p_before_public_id: options?.beforePublicId ?? null,
    p_unread_only: options?.unreadOnly ?? false,
  });

  if (error) {
    throw new Error("Notifikasi belum dapat dimuat.");
  }

  return ((data ?? []) as NotificationRow[])
    .map(mapNotification)
    .filter((item): item is NotificationItem => item !== null);
}

export async function countUnreadNotifications() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("count_my_unread_notifications");

  if (error || typeof data !== "number") return 0;
  return Math.max(0, data);
}

export async function markNotificationRead(publicId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_my_notification_read", {
    p_notification_public_id: publicId,
  });

  if (error) throw new Error("Notifikasi belum dapat diperbarui.");
  return data === true;
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "mark_all_my_notifications_read",
  );

  if (error) throw new Error("Notifikasi belum dapat diperbarui.");
  return typeof data === "number" ? data : 0;
}
