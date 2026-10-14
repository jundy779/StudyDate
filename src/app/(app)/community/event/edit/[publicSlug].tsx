import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { EventEditor } from "@/components/event-editor";
import { getEvent, saveEvent } from "@/features/community/api";
import type { EventDetail, EventFormInput } from "@/features/community/types";
import { colors } from "@/theme";

export default function EditEventScreen() {
  const { publicSlug } = useLocalSearchParams<{ publicSlug: string }>(); const [event, setEvent] = useState<EventDetail | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { const detail = await getEvent(publicSlug ?? ""); setEvent(detail?.can_edit ? detail : null); } finally { setLoading(false); } }, [publicSlug]); useEffect(() => { void load(); }, [load]);
  async function submit(input: EventFormInput) { setBusy(true); try { await saveEvent(input, publicSlug); router.replace(`/(app)/community/event/${publicSlug}`); } catch (cause) { Alert.alert("Perubahan belum disimpan", cause instanceof Error ? cause.message : "Coba lagi sebentar."); } finally { setBusy(false); } }
  return <SafeAreaView edges={["bottom"]} style={styles.safe}><Stack.Screen options={{ title: "Kelola Acara" }} />{loading ? <View style={styles.center}><ActivityIndicator color={colors.blue} /></View> : event ? <EventEditor busy={busy} event={event} onSubmit={(input) => void submit(input)} /> : <View style={styles.center}><Text style={styles.title}>Kamu tidak dapat mengubah acara ini.</Text></View>}</SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { backgroundColor: colors.surface, flex: 1 }, center: { alignItems: "center", flex: 1, justifyContent: "center", padding: 30 }, title: { color: colors.navy, fontSize: 18, fontWeight: "800", textAlign: "center" } });
