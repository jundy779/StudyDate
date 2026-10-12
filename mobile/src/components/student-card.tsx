import { Pressable, StyleSheet, Text, View } from "react-native";

import { getGoalLabel, getInterestLabel, studyStatusLabels } from "@/features/social/labels";
import type { DiscoveryProfile } from "@/features/social/types";
import { colors, radius } from "@/theme";

type Props = {
  profile: DiscoveryProfile;
  busy?: boolean;
  onIntroduce: (profile: DiscoveryProfile) => void;
};

export function StudentCard({ profile, busy = false, onIntroduce }: Props) {
  const subtitle = [
    profile.study_program,
    profile.semester ? `Semester ${profile.semester}` : null,
  ].filter(Boolean).join(" · ");
  const tags = [
    ...profile.connection_goals.slice(0, 2).map(getGoalLabel),
    ...profile.interests.slice(0, 2).map(getInterestLabel),
  ].slice(0, 3);

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{profile.public_alias.slice(-2)}</Text></View>
        <View style={styles.headingText}>
          <View style={styles.nameRow}>
            <Text style={styles.alias}>{profile.public_alias}</Text>
            {profile.is_verified ? <Text style={styles.verified}>Terverifikasi</Text> : null}
          </View>
          <Text style={styles.campus}>{profile.campus}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      {profile.study_status ? (
        <Text style={styles.studyStatus}>{studyStatusLabels[profile.study_status]}</Text>
      ) : null}
      {profile.short_intro ? <Text style={styles.intro}>{profile.short_intro}</Text> : null}
      {profile.city_region ? <Text style={styles.location}>{profile.city_region}</Text> : null}

      {tags.length ? (
        <View style={styles.tags}>
          {tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => onIntroduce(profile)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}
      >
        <Text style={styles.buttonText}>{busy ? "Memeriksa..." : "Kirim perkenalan"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: radius.large, borderWidth: 1, gap: 14, marginBottom: 16, padding: 18 },
  heading: { flexDirection: "row", gap: 12 },
  avatar: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: 18, height: 48, justifyContent: "center", width: 48 },
  avatarText: { color: colors.blue, fontSize: 15, fontWeight: "800" },
  headingText: { flex: 1 },
  nameRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 7 },
  alias: { color: colors.navy, fontSize: 17, fontWeight: "800" },
  verified: { backgroundColor: "#E8F7F0", borderRadius: radius.pill, color: colors.success, fontSize: 10, fontWeight: "800", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4 },
  campus: { color: colors.navy, fontSize: 14, fontWeight: "600", marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 3 },
  studyStatus: { backgroundColor: colors.blueSoft, borderRadius: radius.medium, color: colors.blue, fontSize: 13, fontWeight: "700", overflow: "hidden", paddingHorizontal: 12, paddingVertical: 9 },
  intro: { color: colors.navy, fontSize: 14, lineHeight: 21 },
  location: { color: colors.muted, fontSize: 13 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, color: colors.muted, fontSize: 11, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 6 },
  button: { alignItems: "center", backgroundColor: colors.navy, borderRadius: radius.medium, justifyContent: "center", minHeight: 46 },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.5 },
});
