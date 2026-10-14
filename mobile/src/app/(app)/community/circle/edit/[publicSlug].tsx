import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CircleEditor } from "@/components/circle-editor";
import { getCircle, saveCircle } from "@/features/community/api";
import type { CircleDetail, CircleFormInput } from "@/features/community/types";
import { colors } from "@/theme";

export default function EditCircleScreen() {
  const { publicSlug } = useLocalSearchParams<{ publicSlug: string }>(); const [circle, setCircle] = useState<CircleDetail | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { const detail = await getCircle(publicSlug ?? ""); setCircle(detail?.is_owner ? detail : null); } finally { setLoading(false); } }, [publicSlug]); useEffect(() => { void load(); }, [load]);
  async function submit(input: CircleFormInput) { setBusy(true); try { await saveCircle(input, publicSlug); router.replace(`/(app)/community/circle/${publicSlug}`); } catch (cause) { Alert.alert("Perubahan belum disimpan", cause instanceof Error ? cause.message : "Coba lagi sebentar."); } finally { setBusy(false); } }
  return <SafeAreaView edges={["bottom"]} style={styles.safe}><Stack.Screen options={{ title: "Kelola Circle" }} />{loading ? <View style={styles.center}><ActivityIndicator color={colors.blue} /></View> : circle ? <CircleEditor busy={busy} circle={circle} onSubmit={(input) => void submit(input)} /> : <View style={styles.center}><Text style={styles.title}>Kamu tidak dapat mengelola Circle ini.</Text></View>}</SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { backgroundColor: colors.surface, flex: 1 }, center: { alignItems: "center", flex: 1, justifyContent: "center", padding: 30 }, title: { color: colors.navy, fontSize: 18, fontWeight: "800", textAlign: "center" } });
