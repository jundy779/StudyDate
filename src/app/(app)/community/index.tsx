import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CommunityCard } from "@/components/community-card";
import { listCircles, listEvents } from "@/features/community/api";
import type { CircleSummary, EventSummary } from "@/features/community/types";
import { colors, radius } from "@/theme";

type ViewMode = "circle" | "event";

export default function CommunityScreen() {
  const [mode, setMode] = useState<ViewMode>("circle");
  const [query, setQuery] = useState("");
  const [circles, setCircles] = useState<CircleSummary[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [nextCircles, nextEvents] = await Promise.all([listCircles(), listEvents()]);
      setCircles(nextCircles); setEvents(nextEvents);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Jelajah belum dapat dimuat.");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const normalized = query.trim().toLocaleLowerCase("id-ID");
  const data = (mode === "circle" ? circles : events).filter((item) => {
    const searchable = mode === "circle" ? `${(item as CircleSummary).name} ${item.description}` : `${(item as EventSummary).title} ${item.description} ${(item as EventSummary).city}`;
    return !normalized || searchable.toLocaleLowerCase("id-ID").includes(normalized);
  });

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={data}
        keyExtractor={(item) => item.public_slug}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.blue} />}
        ListHeaderComponent={<View style={styles.header}>
          <Text style={styles.eyebrow}>JELAJAH</Text><Text accessibilityRole="header" style={styles.heading}>Belajar, kenalan, lalu tumbuh bareng.</Text>
          <Text style={styles.body}>Temukan Circle belajar dan acara mahasiswa. Kenalan boleh, fokus utamanya tetap kegiatan yang bermanfaat.</Text>
          <View style={styles.switcher}>{(["circle", "event"] as ViewMode[]).map((value) => <Pressable key={value} onPress={() => setMode(value)} style={[styles.switch, mode === value && styles.switchActive]}><Text style={[styles.switchText, mode === value && styles.switchTextActive]}>{value === "circle" ? "Circle" : "Acara"}</Text></Pressable>)}</View>
          <TextInput onChangeText={setQuery} placeholder={mode === "circle" ? "Cari topik atau nama Circle" : "Cari acara atau kota"} placeholderTextColor={colors.muted} style={styles.search} value={query} />
          <Pressable onPress={() => router.push(mode === "circle" ? "/(app)/community/circle/new" : "/(app)/community/event/new")} style={styles.create}><Text style={styles.createText}>＋ {mode === "circle" ? "Buat Circle baru" : "Buat acara baru"}</Text></Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>}
        ListEmptyComponent={<View style={styles.empty}>{loading ? <ActivityIndicator color={colors.blue} /> : <><Text style={styles.emptyTitle}>Belum ada yang cocok</Text><Text style={styles.emptyText}>Coba kata pencarian lain atau tarik layar untuk memuat ulang.</Text></>}</View>}
        renderItem={({ item }) => <CommunityCard item={item} kind={mode} onPress={() => router.push(`/(app)/community/${mode}/${item.public_slug}`)} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.surface, flex: 1 }, content: { flexGrow: 1, padding: 18, paddingBottom: 36 }, header: { marginBottom: 18 },
  eyebrow: { color: colors.blue, fontSize: 11, fontWeight: "900", letterSpacing: 1.3 }, heading: { color: colors.navy, fontSize: 29, fontWeight: "800", letterSpacing: -0.8, lineHeight: 36, marginTop: 8 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 9 }, switcher: { backgroundColor: colors.blueSoft, borderRadius: radius.pill, flexDirection: "row", marginTop: 18, padding: 4 },
  switch: { alignItems: "center", borderRadius: radius.pill, flex: 1, paddingVertical: 10 }, switchActive: { backgroundColor: colors.blue }, switchText: { color: colors.blue, fontSize: 13, fontWeight: "800" }, switchTextActive: { color: colors.white },
  search: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: radius.medium, borderWidth: 1, color: colors.navy, fontSize: 14, marginTop: 12, paddingHorizontal: 14, paddingVertical: 13 },
  create: { alignItems: "center", borderColor: colors.blue, borderRadius: radius.medium, borderWidth: 1, marginTop: 10, padding: 12 }, createText: { color: colors.blue, fontSize: 12, fontWeight: "800" },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 10 }, empty: { alignItems: "center", gap: 10, padding: 44 }, emptyTitle: { color: colors.navy, fontSize: 17, fontWeight: "800" }, emptyText: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
});
