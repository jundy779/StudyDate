import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import {
  acceptIntroduction,
  cancelIntroduction,
  declineIntroduction,
  getConversationPublicId,
  listReceivedIntroductions,
  listSentIntroductions,
} from "@/features/social/api";
import { introductionStatusLabels } from "@/features/social/labels";
import type { IntroductionListItem } from "@/features/social/types";
import { colors, radius } from "@/theme";

type Direction = "received" | "sent";

export default function IntroductionsScreen() {
  const router = useRouter();
  const [direction, setDirection] = useState<Direction>("received");
  const [items, setItems] = useState<IntroductionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const rows = direction === "received"
        ? await listReceivedIntroductions()
        : await listSentIntroductions();
      setItems(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Perkenalan belum dapat dimuat.");
      setItems([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [direction]);

  useEffect(() => { void load(); }, [load]);

  async function runAction(item: IntroductionListItem, action: "accept" | "decline" | "cancel") {
    setBusyId(item.request_id);
    try {
      if (action === "accept") await acceptIntroduction(item.request_id);
      if (action === "decline") await declineIntroduction(item.request_id);
      if (action === "cancel") await cancelIntroduction(item.request_id);
      await load(true);
    } catch (actionError) {
      Alert.alert("Belum berhasil", actionError instanceof Error ? actionError.message : "Coba lagi sebentar.");
    } finally {
      setBusyId(null);
    }
  }

  async function openConversation(item: IntroductionListItem) {
    setBusyId(item.request_id);
    try {
      const publicId = await getConversationPublicId(item.request_id);
      router.push({ pathname: "/(app)/messages/[publicId]", params: { publicId } });
    } catch (openError) {
      Alert.alert("Percakapan belum dapat dibuka", openError instanceof Error ? openError.message : "Coba lagi sebentar.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(item) => item.request_id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>PERKENALAN</Text>
            <Text accessibilityRole="header" style={styles.title}>Kenalan tanpa buru-buru membuka identitas.</Text>
            <Text style={styles.body}>Terima hanya jika kamu nyaman. Menolak perkenalan tidak akan membuka data pribadi apa pun.</Text>
            <View style={styles.switcher}>
              {(["received", "sent"] as const).map((value) => (
                <Pressable key={value} onPress={() => setDirection(value)} style={[styles.switchButton, direction === value && styles.switchButtonActive]}>
                  <Text style={[styles.switchText, direction === value && styles.switchTextActive]}>{value === "received" ? "Diterima" : "Dikirim"}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={isLoading ? (
          <View style={styles.state}><ActivityIndicator color={colors.blue} /><Text style={styles.stateText}>Menyiapkan perkenalan...</Text></View>
        ) : (
          <View style={styles.state}><Text style={styles.stateTitle}>{error ? "Belum dapat memuat perkenalan" : "Belum ada perkenalan"}</Text><Text style={styles.stateText}>{error ?? (direction === "received" ? "Perkenalan yang masuk akan tampil di sini." : "Mulai dari halaman Cari Teman untuk menyapa seseorang.")}</Text></View>
        )}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} tintColor={colors.blue} />}
        renderItem={({ item }) => {
          const isBusy = busyId === item.request_id;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.alias}>{item.counterpart_alias}</Text>
                  <Text style={styles.meta}>{item.campus} · {item.study_program}{item.semester ? ` · Semester ${item.semester}` : ""}</Text>
                </View>
                {item.is_verified ? <Text style={styles.verified}>Terverifikasi</Text> : null}
              </View>
              <Text style={styles.message}>{item.opening_message}</Text>
              <Text style={[styles.status, item.status === "accepted" && styles.statusAccepted]}>{introductionStatusLabels[item.status]}</Text>

              {item.status === "pending" ? (
                <View style={styles.actions}>
                  {direction === "received" ? (
                    <>
                      <ActionButton disabled={isBusy} label="Tolak" onPress={() => void runAction(item, "decline")} secondary />
                      <ActionButton disabled={isBusy} label={isBusy ? "Memproses..." : "Terima"} onPress={() => void runAction(item, "accept")} />
                    </>
                  ) : (
                    <ActionButton disabled={isBusy} label={isBusy ? "Memproses..." : "Batalkan perkenalan"} onPress={() => void runAction(item, "cancel")} secondary />
                  )}
                </View>
              ) : null}
              {item.status === "accepted" ? (
                <View style={styles.actions}>
                  <ActionButton disabled={isBusy} label={isBusy ? "Membuka..." : "Buka percakapan"} onPress={() => void openConversation(item)} />
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function ActionButton({ label, onPress, disabled, secondary = false }: { label: string; onPress: () => void; disabled: boolean; secondary?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, secondary && styles.actionButtonSecondary, pressed && styles.pressed, disabled && styles.disabled]}>
      <Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, padding: 18, paddingBottom: 34 },
  header: { marginBottom: 22, paddingTop: 8 },
  eyebrow: { color: colors.blue, fontSize: 11, fontWeight: "800", letterSpacing: 1.3 },
  title: { color: colors.navy, fontSize: 28, fontWeight: "800", letterSpacing: -0.8, lineHeight: 35, marginTop: 9 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 10 },
  switcher: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: radius.medium, borderWidth: 1, flexDirection: "row", marginTop: 18, padding: 4 },
  switchButton: { alignItems: "center", borderRadius: 10, flex: 1, minHeight: 42, justifyContent: "center" },
  switchButtonActive: { backgroundColor: colors.navy },
  switchText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  switchTextActive: { color: colors.white },
  card: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: radius.large, borderWidth: 1, gap: 13, marginBottom: 15, padding: 18 },
  cardHeader: { alignItems: "flex-start", flexDirection: "row", gap: 8 },
  cardHeaderText: { flex: 1 },
  alias: { color: colors.navy, fontSize: 17, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  verified: { color: colors.success, fontSize: 10, fontWeight: "800" },
  message: { backgroundColor: colors.surface, borderRadius: radius.medium, color: colors.navy, fontSize: 14, lineHeight: 21, overflow: "hidden", padding: 13 },
  status: { color: colors.warning, fontSize: 12, fontWeight: "800" },
  statusAccepted: { color: colors.success },
  actions: { flexDirection: "row", gap: 9 },
  actionButton: { alignItems: "center", backgroundColor: colors.blue, borderRadius: radius.medium, flex: 1, justifyContent: "center", minHeight: 45, paddingHorizontal: 12 },
  actionButtonSecondary: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1 },
  actionText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  actionTextSecondary: { color: colors.navy },
  pressed: { opacity: 0.84 },
  disabled: { opacity: 0.5 },
  state: { alignItems: "center", gap: 11, paddingHorizontal: 24, paddingVertical: 54 },
  stateTitle: { color: colors.navy, fontSize: 18, fontWeight: "800", textAlign: "center" },
  stateText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
