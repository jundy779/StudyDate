import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ConversationListItem } from "@/features/chat/types";
import { colors, radius } from "@/theme";

const statusLabels: Record<ConversationListItem["status"], string> = {
  awaiting_chat: "Siap dimulai",
  active: "Aktif",
  ended: "Sudah selesai",
  blocked: "Tidak tersedia",
};

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function ConversationCard({
  item,
  onPress,
}: {
  item: ConversationListItem;
  onPress: (item: ConversationListItem) => void;
}) {
  const preview = item.preview_body
    ?? (item.status === "awaiting_chat" ? "Kirim pesan pertama untuk memulai." : "Belum ada pesan.");
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.counterpart_alias.slice(-2)}</Text>
      </View>
      <View style={styles.main}>
        <View style={styles.topRow}>
          <View style={styles.aliasRow}>
            <Text numberOfLines={1} style={styles.alias}>{item.counterpart_alias}</Text>
            {item.is_verified ? <Text style={styles.verified}>Terverifikasi</Text> : null}
          </View>
          <Text style={styles.time}>{timeLabel(item.last_activity_at)}</Text>
        </View>
        <Text numberOfLines={1} style={styles.meta}>
          {item.campus} · {item.study_program}
        </Text>
        <View style={styles.bottomRow}>
          <Text numberOfLines={1} style={[styles.preview, item.unread_count > 0 && styles.previewUnread]}>{preview}</Text>
          {item.unread_count > 0 ? <Text style={styles.badge}>{Math.min(item.unread_count, 99)}</Text> : null}
        </View>
        {item.status !== "active" ? <Text style={styles.status}>{statusLabels[item.status]}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "flex-start", backgroundColor: colors.white, borderColor: colors.border, borderRadius: radius.large, borderWidth: 1, flexDirection: "row", gap: 12, marginBottom: 12, padding: 15 },
  pressed: { opacity: 0.82 },
  avatar: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: 18, height: 48, justifyContent: "center", width: 48 },
  avatarText: { color: colors.blue, fontSize: 15, fontWeight: "800" },
  main: { flex: 1, minWidth: 0 },
  topRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  aliasRow: { alignItems: "center", flex: 1, flexDirection: "row", gap: 6, minWidth: 0 },
  alias: { color: colors.navy, flexShrink: 1, fontSize: 15, fontWeight: "800" },
  verified: { color: colors.success, fontSize: 9, fontWeight: "800" },
  time: { color: colors.muted, fontSize: 10 },
  meta: { color: colors.muted, fontSize: 11, marginTop: 4 },
  bottomRow: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 8 },
  preview: { color: colors.muted, flex: 1, fontSize: 13 },
  previewUnread: { color: colors.navy, fontWeight: "700" },
  badge: { backgroundColor: colors.blue, borderRadius: radius.pill, color: colors.white, fontSize: 10, fontWeight: "800", minWidth: 22, overflow: "hidden", paddingHorizontal: 6, paddingVertical: 4, textAlign: "center" },
  status: { color: colors.warning, fontSize: 10, fontWeight: "800", marginTop: 8 },
});
