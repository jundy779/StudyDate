import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/providers/auth-provider";
import { colors } from "@/theme";

export default function IndexScreen() {
  const { session, isLoading } = useAuth();

  if (!isLoading) {
    return <Redirect href={session ? "/(app)" : "/(auth)/login"} />;
  }

  return (
    <View accessibilityLabel="Menyiapkan StudyDate" style={styles.container}>
      <Text style={styles.brand}>STUDYDATE.ID</Text>
      <ActivityIndicator color={colors.blue} size="large" />
      <Text style={styles.label}>Menyiapkan ruang belajarmu...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  brand: { color: colors.navy, fontSize: 20, fontWeight: "800", letterSpacing: 1.1 },
  label: { color: colors.muted, fontSize: 14 },
});
