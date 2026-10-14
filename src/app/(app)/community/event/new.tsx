import { useState } from "react";
import { Alert } from "react-native";
import { router, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { EventEditor } from "@/components/event-editor";
import { saveEvent } from "@/features/community/api";
import type { EventFormInput } from "@/features/community/types";
import { colors } from "@/theme";

export default function NewEventScreen() {
  const [busy, setBusy] = useState(false);
  async function submit(input: EventFormInput) { setBusy(true); try { const slug = await saveEvent(input); router.replace(`/(app)/community/event/${slug}`); } catch (cause) { Alert.alert("Acara belum dibuat", cause instanceof Error ? cause.message : "Coba lagi sebentar."); } finally { setBusy(false); } }
  return <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.surface, flex: 1 }}><Stack.Screen options={{ title: "Buat Acara" }} /><EventEditor busy={busy} onSubmit={(input) => void submit(input)} /></SafeAreaView>;
}
