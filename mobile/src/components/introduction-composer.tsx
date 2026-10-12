import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import type { DiscoveryProfile } from "@/features/social/types";
import {
  INTRODUCTION_MESSAGE_MAX,
  validateIntroductionMessage,
} from "@/features/social/validation";
import { colors, radius } from "@/theme";

const suggestions = [
  "Hai, aku tertarik kenalan dan belajar bareng. Kita bisa mulai dari cerita soal kegiatan kuliah masing-masing.",
  "Hai, sepertinya kita punya tujuan yang mirip. Kalau kamu berkenan, yuk ngobrol dulu di sini.",
];

type Props = {
  profile: DiscoveryProfile | null;
  isSending: boolean;
  onClose: () => void;
  onSend: (message: string) => Promise<void>;
};

export function IntroductionComposer({ profile, isSending, onClose, onSend }: Props) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setMessage("");
      setError(null);
    }
  }, [profile]);

  async function submit() {
    const result = validateIntroductionMessage(message);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    await onSend(result.value);
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(profile)}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.handle} />
            <Text style={styles.eyebrow}>PERKENALAN AMAN</Text>
            <Text accessibilityRole="header" style={styles.title}>Sapa {profile?.public_alias}</Text>
            <Text style={styles.body}>Mulai dari minat, kelas, atau hal yang ingin dipelajari. Nama asli dan kontak belum dibuka.</Text>

            <Text style={styles.label}>Butuh contoh?</Text>
            <View style={styles.suggestions}>
              {suggestions.map((suggestion, index) => (
                <Pressable key={suggestion} onPress={() => setMessage(suggestion)} style={styles.suggestion}>
                  <Text style={styles.suggestionText}>Contoh {index + 1}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              accessibilityLabel="Pesan perkenalan"
              editable={!isSending}
              maxLength={INTRODUCTION_MESSAGE_MAX}
              multiline
              onChangeText={setMessage}
              placeholder="Hai, aku lihat kita sama-sama suka..."
              placeholderTextColor="#94A3B8"
              style={styles.input}
              textAlignVertical="top"
              value={message}
            />
            <Text style={styles.counter}>{message.length}/{INTRODUCTION_MESSAGE_MAX}</Text>
            {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
            <Text style={styles.safety}>Jangan tulis nomor telepon, email, username media sosial, atau tautan pada perkenalan pertama.</Text>

            <View style={styles.actions}>
              <Pressable disabled={isSending} onPress={onClose} style={styles.cancel}>
                <Text style={styles.cancelText}>Nanti dulu</Text>
              </Pressable>
              <View style={styles.submit}><PrimaryButton isLoading={isSending} label="Kirim perkenalan" onPress={() => void submit()} /></View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: "rgba(15,27,51,0.45)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "92%", padding: 22, paddingBottom: 30 },
  handle: { alignSelf: "center", backgroundColor: colors.border, borderRadius: 99, height: 4, marginBottom: 20, width: 44 },
  eyebrow: { color: colors.blue, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: colors.navy, fontSize: 27, fontWeight: "800", marginTop: 8 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 9 },
  label: { color: colors.navy, fontSize: 13, fontWeight: "700", marginTop: 20 },
  suggestions: { flexDirection: "row", gap: 8, marginTop: 9 },
  suggestion: { backgroundColor: colors.blueSoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  suggestionText: { color: colors.blue, fontSize: 12, fontWeight: "700" },
  input: { borderColor: colors.border, borderRadius: radius.medium, borderWidth: 1, color: colors.navy, fontSize: 15, lineHeight: 22, marginTop: 14, minHeight: 132, padding: 14 },
  counter: { color: colors.muted, fontSize: 11, marginTop: 6, textAlign: "right" },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 8 },
  safety: { backgroundColor: "#FFF8E8", borderRadius: radius.medium, color: colors.warning, fontSize: 12, lineHeight: 19, marginTop: 12, overflow: "hidden", padding: 12 },
  actions: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 18 },
  cancel: { alignItems: "center", justifyContent: "center", minHeight: 52, paddingHorizontal: 12 },
  cancelText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  submit: { flex: 1 },
});
