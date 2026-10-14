import { Pressable, StyleSheet, Text, View } from "react-native";
import { circleTopicLabels, eventCategoryLabels, eventStatusLabels, formatEventDate } from "@/features/community/labels";
import type { CircleSummary, EventSummary } from "@/features/community/types";
import { colors, radius } from "@/theme";

type Props = { item: CircleSummary | EventSummary; kind: "circle" | "event"; onPress: () => void };

export function CommunityCard({ item, kind, onPress }: Props) {
  const circle = kind === "circle" ? item as CircleSummary : null;
  const event = kind === "event" ? item as EventSummary : null;
  const title = circle?.name ?? event?.title ?? "";
  const category = circle ? circleTopicLabels[circle.topic] : event ? eventCategoryLabels[event.category] : "";
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}><Text style={styles.badge}>{kind === "circle" ? "CIRCLE" : category.toUpperCase()}</Text>{event?.rsvp_status ? <Text style={styles.status}>{eventStatusLabels[event.rsvp_status]}</Text> : null}</View>
      <Text style={styles.title}>{title}</Text>
      <Text numberOfLines={3} style={styles.description}>{item.description}</Text>
      {circle ? <Text style={styles.meta}>{category} · {circle.member_count}/{circle.member_limit} anggota · {circle.scope === "campus" ? "Satu kampus" : "Terbuka"}</Text> : null}
      {event ? <Text style={styles.meta}>{formatEventDate(event.starts_at)} · {event.city} · {event.attendee_count}/{event.capacity} peserta</Text> : null}
      <Text style={styles.open}>Lihat detail →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: radius.large, borderWidth: 1, marginBottom: 13, padding: 18 },
  pressed: { opacity: 0.75 }, top: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  badge: { color: colors.blue, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  status: { color: colors.success, fontSize: 10, fontWeight: "800" },
  title: { color: colors.navy, fontSize: 18, fontWeight: "800", marginTop: 10 },
  description: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  meta: { color: colors.navy, fontSize: 11, lineHeight: 17, marginTop: 12 },
  open: { color: colors.blue, fontSize: 12, fontWeight: "800", marginTop: 13 },
});
