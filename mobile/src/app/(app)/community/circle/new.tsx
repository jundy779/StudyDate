import { useState } from "react";
import { Alert } from "react-native";
import { router, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CircleEditor } from "@/components/circle-editor";
import { saveCircle } from "@/features/community/api";
import type { CircleFormInput } from "@/features/community/types";
import { colors } from "@/theme";

export default function NewCircleScreen() {
  const [busy, setBusy] = useState(false);
  async function submit(input: CircleFormInput) { setBusy(true); try { const slug = await saveCircle(input); router.replace(`/(app)/community/circle/${slug}`); } catch (cause) { Alert.alert("Circle belum dibuat", cause instanceof Error ? cause.message : "Coba lagi sebentar."); } finally { setBusy(false); } }
  return <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.surface, flex: 1 }}><Stack.Screen options={{ title: "Buat Circle" }} /><CircleEditor busy={busy} onSubmit={(input) => void submit(input)} /></SafeAreaView>;
}
