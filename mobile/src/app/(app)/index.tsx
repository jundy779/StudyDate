import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/providers/auth-provider";
import { colors, radius } from "@/theme";

const nextFeatures = ["Cari Teman dan perkenalan", "Circle belajar", "Acara mahasiswa", "Percakapan aman"];

export default function HomeScreen() {
  const { session } = useAuth();

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>HALO, KAMU SUDAH MASUK</Text>
        <Text accessibilityRole="header" style={styles.title}>Ruang mahasiswa yang mulai dari tujuan yang sama.</Text>
        <Text style={styles.body}>Akunmu sudah tersambung. Sekarang kamu bisa mencari teman, masuk Circle belajar, menemukan acara, dan ngobrol dengan aman.</Text>

        <Pressable onPress={() => router.push("/(app)/community")} style={styles.exploreButton}><Text style={styles.exploreButtonText}>Jelajahi Circle dan Acara</Text></Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tahap berikutnya</Text>
          {nextFeatures.map((feature) => (
            <View key={feature} style={styles.row}>
              <View style={styles.dot} />
              <Text style={styles.rowText}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={styles.accountHint}>
          <Text style={styles.accountHintTitle}>Akun aktif</Text>
          <Text numberOfLines={1} style={styles.accountHintBody}>{session?.user.email ?? "Email tersimpan dengan aman"}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 24, paddingBottom: 40 },
  eyebrow: { color: colors.blue, fontSize: 12, fontWeight: "800", letterSpacing: 1.3 },
  title: { color: colors.navy, fontSize: 32, fontWeight: "800", letterSpacing: -1, lineHeight: 39, marginTop: 12 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 25, marginTop: 14 },
  card: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: radius.large, borderWidth: 1, gap: 16, marginTop: 28, padding: 20 },
  cardTitle: { color: colors.navy, fontSize: 18, fontWeight: "800" },
  row: { alignItems: "center", flexDirection: "row", gap: 12 },
  dot: { backgroundColor: colors.blue, borderRadius: 99, height: 8, width: 8 },
  rowText: { color: colors.navy, fontSize: 15 },
  accountHint: { backgroundColor: colors.blueSoft, borderRadius: radius.medium, marginTop: 18, padding: 16 },
  accountHintTitle: { color: colors.blue, fontSize: 12, fontWeight: "800" },
  accountHintBody: { color: colors.navy, fontSize: 14, marginTop: 5 },
  exploreButton: { alignItems: "center", backgroundColor: colors.blue, borderRadius: radius.medium, marginTop: 22, padding: 15 },
  exploreButtonText: { color: colors.white, fontSize: 14, fontWeight: "800" },
});
