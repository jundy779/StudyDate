import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string | string[]; error_description?: string | string[] }>();
  const [error, setError] = useState<string | null>(null);
  const hasHandled = useRef(false);

  useEffect(() => {
    if (hasHandled.current) return;
    hasHandled.current = true;

    const providerError = Array.isArray(params.error_description)
      ? params.error_description[0]
      : params.error_description;
    const code = Array.isArray(params.code) ? params.code[0] : params.code;

    if (providerError) {
      setError("Link masuk tidak dapat dipakai. Minta link baru dari halaman masuk.");
      return;
    }
    if (!supabase || !code) {
      setError("Link masuk tidak lengkap atau koneksi aplikasi belum siap.");
      return;
    }

    void supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) {
        setError("Link masuk sudah kedaluwarsa atau pernah digunakan.");
        return;
      }
      router.replace("/(app)");
    });
  }, [params.code, params.error_description]);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text accessibilityRole="header" style={styles.title}>Belum berhasil masuk</Text>
          <Text accessibilityLiveRegion="polite" style={styles.body}>{error}</Text>
          <PrimaryButton label="Kembali ke halaman masuk" onPress={() => router.replace("/(auth)/login")} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.blue} size="large" />
          <Text accessibilityRole="header" style={styles.title}>Memeriksa link masuk...</Text>
          <Text style={styles.body}>Tunggu sebentar. Kamu akan diarahkan otomatis.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 28, gap: 18 },
  title: { color: colors.navy, fontSize: 26, fontWeight: "800", textAlign: "center" },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: "center" },
});
