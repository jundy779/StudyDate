import { Redirect } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/primary-button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { colors, radius } from "@/theme";

const redirectTo = "studydate://auth/callback";

export default function LoginScreen() {
  const { session, configurationError } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/(app)" />;

  async function sendMagicLink() {
    const normalizedEmail = email.trim().toLowerCase();
    setMessage(null);
    setError(null);

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Tulis alamat email yang benar dulu, ya.");
      return;
    }
    if (!supabase) {
      setError(configurationError ?? "Koneksi aplikasi belum siap.");
      return;
    }

    setIsSubmitting(true);
    const { error: requestError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    });
    setIsSubmitting(false);

    if (requestError) {
      setError("Link masuk belum berhasil dikirim. Coba lagi sebentar, ya.");
      return;
    }
    setMessage("Link masuk sudah dikirim. Buka email ini dari HP yang sama.");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.eyebrow}>STUDYDATE.ID</Text>
            <Text accessibilityRole="header" style={styles.title}>Mulai dari belajar, lalu kenal lebih dekat.</Text>
            <Text style={styles.body}>Masuk dengan email yang sudah terdaftar. Tidak perlu mengingat kata sandi.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Email kamu</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              editable={!isSubmitting}
              inputMode="email"
              onChangeText={setEmail}
              onSubmitEditing={() => void sendMagicLink()}
              placeholder="nama@email.com"
              placeholderTextColor="#94A3B8"
              returnKeyType="send"
              style={styles.input}
              value={email}
            />
            {configurationError ? <Text style={styles.warning}>{configurationError}</Text> : null}
            {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
            {message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text> : null}
            <PrimaryButton
              disabled={Boolean(configurationError)}
              isLoading={isSubmitting}
              label="Kirim link masuk"
              onPress={() => void sendMagicLink()}
            />
            <Text style={styles.note}>Akun baru tetap mengikuti persetujuan Akses Awal. Aplikasi tidak membuat akun secara otomatis.</Text>
          </View>

          <Pressable accessibilityRole="link" onPress={() => setMessage("Pendaftaran Akses Awal tersedia di studydate.id.")}>
            <Text style={styles.link}>Belum punya akses? Daftar melalui website</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 28 },
  eyebrow: { color: colors.blue, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: colors.navy, fontSize: 34, fontWeight: "800", letterSpacing: -1.1, lineHeight: 41, marginTop: 12 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 14 },
  card: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: radius.large, borderWidth: 1, gap: 14, padding: 20 },
  label: { color: colors.navy, fontSize: 14, fontWeight: "700" },
  input: { borderColor: colors.border, borderRadius: radius.medium, borderWidth: 1, color: colors.navy, fontSize: 16, minHeight: 52, paddingHorizontal: 16 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  warning: { color: colors.warning, fontSize: 13, lineHeight: 19 },
  success: { color: colors.success, fontSize: 13, lineHeight: 19 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  link: { color: colors.blue, fontSize: 14, fontWeight: "700", textAlign: "center" },
});
