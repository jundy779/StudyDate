import { Stack } from "expo-router";

import { colors } from "@/theme";

export default function MessagesLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Pesan",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.navy,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Pesan" }} />
      <Stack.Screen name="[publicId]" options={{ title: "Percakapan" }} />
    </Stack>
  );
}
