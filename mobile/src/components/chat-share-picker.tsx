import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { ChatShareableItem } from "@/features/chat/types";
import { colors, radius } from "@/theme";

export function ChatSharePicker({
  visible,
  items,
  isLoading,
  isSending,
  onClose,
  onSelect,
}: {
  visible: boolean;
  items: ChatShareableItem[];
  isLoading: boolean;
  isSending: boolean;
  onClose: () => void;
  onSelect: (item: ChatShareableItem) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id-ID");
    if (!normalized) return items;
    return items.filter((item) => `${item.title} ${item.description} ${item.meta}`.toLocaleLowerCase("id-ID").includes(normalized));
  }, [items, query]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text accessibilityRole="header" style={styles.title}>Ajak lewat chat</Text>
              <Text style={styles.body}>Pilih Circle atau Event yang memang bisa kamu akses.</Text>
            </View>
            <Pressable accessibilityLabel="Tutup pilihan" onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          <TextInput
            autoCapitalize="none"
            onChangeText={setQuery}
            placeholder="Cari Circle atau Event"
            placeholderTextColor={colors.muted}
            style={styles.search}
            value={query}
          />
          {isLoading ? <View style={styles.state}><ActivityIndicator color={colors.blue} /><Text style={styles.stateText}>Menyiapkan pilihan...</Text></View> : (
            <FlatList
              contentContainerStyle={styles.list}
              data={filtered}
              keyExtractor={(item) => `${item.share_kind}:${item.public_slug}`}
              ListEmptyComponent={<View style={styles.state}><Text style={styles.emptyTitle}>Belum ada yang bisa dibagikan</Text><Text style={styles.stateText}>Ikuti Circle atau Event terlebih dahulu, lalu coba lagi.</Text></View>}
              renderItem={({ item }) => (
                <Pressable disabled={isSending} onPress={() => onSelect(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                  <Text style={styles.kind}>{item.share_kind === "circle" ? "CIRCLE BELAJAR" : "EVENT"}</Text>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text numberOfLines={2} style={styles.description}>{item.description}</Text>
                  <Text style={styles.meta}>{item.meta}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(15,27,51,0.46)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, height: "82%", padding: 20, paddingBottom: 30 },
  handle: { alignSelf: "center", backgroundColor: colors.border, borderRadius: radius.pill, height: 4, marginBottom: 17, width: 42 },
  header: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  headerText: { flex: 1 },
  title: { color: colors.navy, fontSize: 23, fontWeight: "800" },
  body: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5 },
  close: { alignItems: "center", height: 36, justifyContent: "center", width: 36 },
  closeText: { color: colors.navy, fontSize: 27, lineHeight: 30 },
  search: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.medium, borderWidth: 1, color: colors.navy, fontSize: 13, marginTop: 16, minHeight: 48, paddingHorizontal: 13 },
  list: { gap: 10, paddingVertical: 14 },
  card: { borderColor: colors.border, borderRadius: radius.large, borderWidth: 1, padding: 15 },
  pressed: { backgroundColor: colors.blueSoft },
  kind: { color: colors.blue, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  cardTitle: { color: colors.navy, fontSize: 16, fontWeight: "800", marginTop: 6 },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  meta: { color: colors.navy, fontSize: 10, fontWeight: "700", marginTop: 8 },
  state: { alignItems: "center", flex: 1, gap: 10, justifyContent: "center", padding: 30 },
  emptyTitle: { color: colors.navy, fontSize: 17, fontWeight: "800", textAlign: "center" },
  stateText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
});
