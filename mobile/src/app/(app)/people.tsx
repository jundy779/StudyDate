import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IntroductionComposer } from "@/components/introduction-composer";
import { StudentCard } from "@/components/student-card";
import {
  getIntroductionEligibility,
  listPeople,
  sendIntroduction,
} from "@/features/social/api";
import { getEligibilityMessage } from "@/features/social/labels";
import type { DiscoveryProfile } from "@/features/social/types";
import { colors } from "@/theme";

export default function PeopleScreen() {
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [checkingAlias, setCheckingAlias] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<DiscoveryProfile | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const result = await listPeople();
      setProfiles(result.profiles);
      setNextCursor(result.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Cari Teman belum dapat dimuat.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await listPeople(nextCursor);
      setProfiles((current) => {
        const aliases = new Set(current.map((profile) => profile.public_alias));
        return [...current, ...result.profiles.filter((profile) => !aliases.has(profile.public_alias))];
      });
      setNextCursor(result.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Profil berikutnya belum dapat dimuat.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function startIntroduction(profile: DiscoveryProfile) {
    setCheckingAlias(profile.public_alias);
    try {
      const eligibility = await getIntroductionEligibility(profile.public_alias);
      if (!eligibility.can_send) {
        Alert.alert("Belum bisa mengirim", getEligibilityMessage(eligibility.state_code));
        return;
      }
      setSelectedProfile(profile);
    } catch (eligibilityError) {
      Alert.alert(
        "Belum bisa memeriksa profil",
        eligibilityError instanceof Error ? eligibilityError.message : "Coba lagi sebentar.",
      );
    } finally {
      setCheckingAlias(null);
    }
  }

  async function handleSend(message: string) {
    if (!selectedProfile) return;
    setIsSending(true);
    try {
      await sendIntroduction(selectedProfile.public_alias, message);
      setNotice(`Perkenalan untuk ${selectedProfile.public_alias} sudah dikirim.`);
      setSelectedProfile(null);
    } catch (sendError) {
      Alert.alert("Perkenalan belum terkirim", sendError instanceof Error ? sendError.message : "Coba lagi sebentar.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={profiles}
        keyExtractor={(profile) => profile.public_alias}
        ListEmptyComponent={isLoading ? (
          <View style={styles.state}><ActivityIndicator color={colors.blue} /><Text style={styles.stateText}>Mencari profil yang bisa kamu kenal...</Text></View>
        ) : (
          <View style={styles.state}><Text style={styles.stateTitle}>{error ? "Belum dapat memuat profil" : "Belum ada profil yang cocok"}</Text><Text style={styles.stateText}>{error ?? "Coba lagi nanti. Hanya profil yang memilih untuk ditemukan yang akan muncul."}</Text></View>
        )}
        ListFooterComponent={isLoadingMore ? <ActivityIndicator color={colors.blue} style={styles.footer} /> : null}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>CARI TEMAN</Text>
            <Text accessibilityRole="header" style={styles.title}>Temukan orang yang punya kesamaan denganmu.</Text>
            <Text style={styles.body}>Profil tetap memakai nama samaran. Nama asli dan kontak hanya bisa dibuka lewat persetujuan bersama.</Text>
            {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
            {error && profiles.length ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          </View>
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} tintColor={colors.blue} />}
        renderItem={({ item }) => (
          <StudentCard busy={checkingAlias === item.public_alias} onIntroduce={(profile) => void startIntroduction(profile)} profile={item} />
        )}
      />
      <IntroductionComposer
        isSending={isSending}
        onClose={() => !isSending && setSelectedProfile(null)}
        onSend={handleSend}
        profile={selectedProfile}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, padding: 18, paddingBottom: 34 },
  header: { marginBottom: 22, paddingTop: 8 },
  eyebrow: { color: colors.blue, fontSize: 11, fontWeight: "800", letterSpacing: 1.3 },
  title: { color: colors.navy, fontSize: 29, fontWeight: "800", letterSpacing: -0.9, lineHeight: 36, marginTop: 9 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 10 },
  notice: { backgroundColor: "#E8F7F0", borderRadius: 12, color: colors.success, fontSize: 13, lineHeight: 19, marginTop: 14, overflow: "hidden", padding: 12 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 12 },
  state: { alignItems: "center", gap: 12, paddingHorizontal: 24, paddingVertical: 54 },
  stateTitle: { color: colors.navy, fontSize: 18, fontWeight: "800", textAlign: "center" },
  stateText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  footer: { paddingVertical: 22 },
});
