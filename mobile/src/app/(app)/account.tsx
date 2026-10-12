import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/primary-button";
import { useAuth } from "@/providers/auth-provider";
import { colors, radius } from "@/theme";

export default function AccountScreen() {
  const { session, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setIsSigningOut(true);
    setError(null);
    try {
      await signOut();
    } catch {
      setError("Belum berhasil keluar. Periksa koneksi lalu coba lagi.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>EMAIL AKUN</Text>
          <Text style={styles.email}>{session?.user.email ?? "-"}</Text>
          <Text style={styles.note}>Data profil, verifikasi, dan pengaturan privasi akan ditambahkan setelah kontrak API mobile selesai diuji.</Text>
        </View>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        <PrimaryButton isLoading={isSigningOut} label="Keluar dari aplikasi" onPress={() => void handleSignOut()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1, justifyContent: "space-between", padding: 24 },
  card: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: radius.large, borderWidth: 1, padding: 20 },
  label: { color: colors.blue, fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  email: { color: colors.navy, fontSize: 19, fontWeight: "700", marginTop: 8 },
  note: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 16 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
