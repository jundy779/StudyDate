import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>STUDYDATE ID · MOBILE</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Mulai dari belajar. Kenal perlahan.
        </Text>
        <Text style={styles.body}>
          Kerangka Android dan iOS sudah siap. Autentikasi, People, Circle, Event,
          notifikasi, dan billing akan ditambahkan bertahap tanpa menyalin UI web.
        </Text>
        <View accessibilityRole="summary" style={styles.status}>
          <Text style={styles.statusTitle}>Foundation only</Text>
          <Text style={styles.statusBody}>
            Belum terhubung ke akun atau data production.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  eyebrow: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  title: {
    color: colors.navy,
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -1.2,
    lineHeight: 43,
    marginTop: 14,
    maxWidth: 540,
  },
  body: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 26,
    marginTop: 18,
    maxWidth: 560,
  },
  status: {
    borderLeftColor: colors.blue,
    borderLeftWidth: 3,
    marginTop: 32,
    paddingLeft: 16,
  },
  statusTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: "700",
  },
  statusBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 4,
  },
});
