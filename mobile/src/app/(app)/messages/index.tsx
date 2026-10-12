import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConversationCard } from "@/components/conversation-card";
import { listConversations } from "@/features/chat/api";
import {
  conversationViews,
  filterConversations,
  searchConversations,
} from "@/features/chat/filters";
import type {
  ConversationListItem,
  ConversationView,
} from "@/features/chat/types";
import { colors, radius } from "@/theme";

export default function MessagesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [view, setView] = useState<ConversationView>("all");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      setItems(await listConversations());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Percakapan belum dapat dimuat.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visibleItems = useMemo(
    () => searchConversations(filterConversations(items, view), query),
    [items, query, view],
  );

  function openConversation(item: ConversationListItem) {
    router.push({ pathname: "/(app)/messages/[publicId]", params: { publicId: item.public_id } });
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={visibleItems}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.public_id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>PESAN</Text>
            <Text accessibilityRole="header" style={styles.title}>Lanjut ngobrol tanpa membuka identitas.</Text>
            <Text style={styles.body}>Percakapan tersedia setelah perkenalan diterima. Nama asli dan kontak tetap tertutup.</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={80}
              onChangeText={setQuery}
              placeholder="Cari nama samaran, kampus, atau program studi"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              style={styles.search}
              value={query}
            />
            <View style={styles.filters}>
              {conversationViews.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => setView(item.value)}
                  style={[styles.filter, view === item.value && styles.filterActive]}
                >
                  <Text style={[styles.filterText, view === item.value && styles.filterTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            {query ? <Text style={styles.resultText}>{visibleItems.length} percakapan ditemukan</Text> : null}
            {error && items.length ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={isLoading ? (
          <View style={styles.state}><ActivityIndicator color={colors.blue} /><Text style={styles.stateText}>Menyiapkan percakapan...</Text></View>
        ) : (
          <View style={styles.state}>
            <Text style={styles.stateTitle}>{error ? "Percakapan belum dapat dimuat" : query ? "Belum ketemu" : "Belum ada percakapan"}</Text>
            <Text style={styles.stateText}>{error ?? (query ? "Coba nama samaran, kampus, atau program studi lain." : "Terima perkenalan untuk mulai ngobrol secara anonim.")}</Text>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} tintColor={colors.blue} />}
        renderItem={({ item }) => <ConversationCard item={item} onPress={openConversation} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.surface, flex: 1 },
  content: { flexGrow: 1, padding: 18, paddingBottom: 34 },
  header: { marginBottom: 18, paddingTop: 8 },
  eyebrow: { color: colors.blue, fontSize: 11, fontWeight: "800", letterSpacing: 1.3 },
  title: { color: colors.navy, fontSize: 28, fontWeight: "800", letterSpacing: -0.8, lineHeight: 35, marginTop: 9 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 10 },
  search: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: radius.medium, borderWidth: 1, color: colors.navy, fontSize: 13, marginTop: 18, minHeight: 50, paddingHorizontal: 14 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  filter: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  filterActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  filterText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  filterTextActive: { color: colors.white },
  resultText: { color: colors.muted, fontSize: 11, marginTop: 11 },
  error: { color: colors.danger, fontSize: 12, marginTop: 10 },
  state: { alignItems: "center", gap: 11, paddingHorizontal: 24, paddingVertical: 54 },
  stateTitle: { color: colors.navy, fontSize: 18, fontWeight: "800", textAlign: "center" },
  stateText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
