import { Stack } from "expo-router";
import { colors } from "@/theme";

export default function CommunityLayout() {
  return <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.navy }} />;
}
