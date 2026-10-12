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

import type { ReportReasonCode } from "@/features/chat/types";
import { validateReportDetails } from "@/features/chat/validation";
import { colors, radius } from "@/theme";

const reasons: Array<{ value: ReportReasonCode; label: string }> = [
  { value: "harassment", label: "Perilaku tidak nyaman" },
  { value: "spam", label: "Spam atau pesan berulang" },
  { value: "contact_pressure", label: "Mendesak untuk berbagi kontak" },
  { value: "fake_or_misleading", label: "Profil atau pesan menyesatkan" },
  { value: "other", label: "Alasan lain" },
];

export function ReportConversationModal({
  visible,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReasonCode, details: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<ReportReasonCode>("harassment");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setReason("harassment");
      setDetails("");
      setError(null);
    }
  }, [visible]);

  async function submit() {
    const validationError = validateReportDetails(details);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    await onSubmit(reason, details.trim());
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>Laporkan percakapan</Text>
          <Text style={styles.body}>Laporan dikirim secara privat ke tim StudyDate. Pilih alasan yang paling sesuai.</Text>
          <ScrollView contentContainerStyle={styles.options} style={styles.scroll}>
            {reasons.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => setReason(item.value)}
                style={[styles.option, reason === item.value && styles.optionActive]}
              >
                <View style={[styles.radio, reason === item.value && styles.radioActive]} />
                <Text style={[styles.optionText, reason === item.value && styles.optionTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            editable={!isSubmitting}
            maxLength={300}
            multiline
            onChangeText={setDetails}
            placeholder="Tambahkan penjelasan jika perlu"
            placeholderTextColor={colors.muted}
            style={styles.input}
            textAlignVertical="top"
            value={details}
          />
          <Text style={styles.counter}>{details.length}/300</Text>
          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable disabled={isSubmitting} onPress={onClose} style={styles.cancelButton}><Text style={styles.cancelText}>Batal</Text></Pressable>
            <Pressable disabled={isSubmitting} onPress={() => void submit()} style={[styles.submitButton, isSubmitting && styles.disabled]}><Text style={styles.submitText}>{isSubmitting ? "Mengirim..." : "Kirim laporan"}</Text></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(15,27,51,0.46)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "92%", padding: 20, paddingBottom: 30 },
  handle: { alignSelf: "center", backgroundColor: colors.border, borderRadius: radius.pill, height: 4, marginBottom: 18, width: 42 },
  title: { color: colors.navy, fontSize: 23, fontWeight: "800" },
  body: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  scroll: { maxHeight: 260 },
  options: { gap: 8, paddingVertical: 15 },
  option: { alignItems: "center", borderColor: colors.border, borderRadius: radius.medium, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 46, paddingHorizontal: 13 },
  optionActive: { backgroundColor: colors.blueSoft, borderColor: colors.blue },
  radio: { borderColor: colors.muted, borderRadius: 8, borderWidth: 2, height: 16, width: 16 },
  radioActive: { backgroundColor: colors.blue, borderColor: colors.blue, borderWidth: 4 },
  optionText: { color: colors.navy, flex: 1, fontSize: 13, fontWeight: "600" },
  optionTextActive: { color: colors.blue },
  input: { borderColor: colors.border, borderRadius: radius.medium, borderWidth: 1, color: colors.navy, fontSize: 14, minHeight: 88, padding: 12 },
  counter: { color: colors.muted, fontSize: 10, marginTop: 5, textAlign: "right" },
  error: { color: colors.danger, fontSize: 12, marginTop: 7 },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelButton: { alignItems: "center", borderColor: colors.border, borderRadius: radius.medium, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48 },
  cancelText: { color: colors.navy, fontSize: 13, fontWeight: "800" },
  submitButton: { alignItems: "center", backgroundColor: colors.danger, borderRadius: radius.medium, flex: 1.4, justifyContent: "center", minHeight: 48 },
  submitText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.5 },
});
