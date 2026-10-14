import { Redirect, Tabs } from "expo-router";

import { useAuth } from "@/providers/auth-provider";
import { colors } from "@/theme";

export default function AppLayout() {
  const { session, isLoading } = useAuth();

  if (!isLoading && !session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.navy,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Beranda", tabBarLabel: "Beranda" }} />
      <Tabs.Screen name="people" options={{ title: "Cari Teman", tabBarLabel: "Cari Teman" }} />
      <Tabs.Screen name="introductions" options={{ title: "Perkenalan", tabBarLabel: "Perkenalan" }} />
      <Tabs.Screen name="community" options={{ headerShown: false, title: "Jelajah", tabBarLabel: "Jelajah" }} />
      <Tabs.Screen name="messages" options={{ headerShown: false, title: "Pesan", tabBarLabel: "Pesan" }} />
      <Tabs.Screen name="account" options={{ title: "Akun", tabBarLabel: "Akun" }} />
    </Tabs>
  );
}
