import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { ReportConversationModal } from "@/components/report-conversation-modal";
import {
  blockConversationCounterpart,
  endConversation,
  getConversation,
  listMessages,
  markMessagesRead,
  reportConversation,
  sendMessage,
} from "@/features/chat/api";
import type {
  ChatMessage,
  ConversationDetail,
  ReportReasonCode,
} from "@/features/chat/types";
import {
  CHAT_MESSAGE_MAX,
  validateChatMessage,
} from "@/features/chat/validation";
import { colors, radius } from "@/theme";

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((message) => [message.message_id, message]));
  for (const message of incoming) byId.set(message.message_id, message);
  return [...byId.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

function messageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export default function ConversationScreen() {
  const params = useLocalSearchParams<{ publicId?: string | string[] }>();
  const router = useRouter();
  const publicId = Array.isArray(params.publicId) ? params.publicId[0] : params.publicId;
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const shouldScrollToEnd = useRef(true);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRunningAction, setIsRunningAction] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!publicId) {
      setError("Percakapan tidak ditemukan.");
      setIsLoading(false);
      return;
    }
    if (!silent) setIsLoading(true);
    try {
      const [detail, latest] = await Promise.all([
        getConversation(publicId),
        listMessages(publicId),
      ]);
      if (!detail) throw new Error("Percakapan tidak ditemukan.");
      setConversation(detail);
      setMessages((current) => mergeMessages(current, [...latest].reverse()));
      setHasMore(latest.length === 50);
      setError(null);
      if (detail.unread_count > 0) void markMessagesRead(publicId).catch(() => undefined);
    } catch (loadError) {
      if (!silent) setError(loadError instanceof Error ? loadError.message : "Percakapan belum dapat dibuka.");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [publicId]);

  useEffect(() => {
    shouldScrollToEnd.current = true;
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => void refresh(true), 6000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function loadOlder() {
    if (!publicId || isLoadingMore || !hasMore || messages.length === 0) return;
    setIsLoadingMore(true);
    try {
      const older = await listMessages(publicId, messages[0]);
      setMessages((current) => mergeMessages([...older].reverse(), current));
      setHasMore(older.length === 50);
    } catch (loadError) {
      Alert.alert("Pesan lama belum dapat dimuat", loadError instanceof Error ? loadError.message : "Coba lagi sebentar.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function submitMessage() {
    if (!publicId || isSending || !conversation?.can_send) return;
    const parsed = validateChatMessage(body);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      const sent = await sendMessage(publicId, parsed.value);
      setBody("");
      shouldScrollToEnd.current = true;
      if (sent) setMessages((current) => mergeMessages(current, [sent]));
      setConversation((current) => current ? { ...current, status: "active", can_send: true } : current);
      await refresh(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Pesan belum terkirim.");
    } finally {
      setIsSending(false);
    }
  }

  function confirmEnd() {
    if (!publicId || isRunningAction) return;
    Alert.alert(
      "Akhiri percakapan?",
      "Setelah diakhiri, kalian tidak bisa mengirim pesan baru di percakapan ini.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Akhiri",
          style: "destructive",
          onPress: () => void runEnd(),
        },
      ],
    );
  }

  async function runEnd() {
    if (!publicId) return;
    setIsRunningAction(true);
    try {
      await endConversation(publicId);
      setConversation((current) => current ? { ...current, status: "ended", can_send: false } : current);
      Alert.alert("Percakapan diakhiri", "Pesan lama masih bisa kamu baca.");
    } catch (actionError) {
      Alert.alert("Belum berhasil", actionError instanceof Error ? actionError.message : "Coba lagi sebentar.");
    } finally {
      setIsRunningAction(false);
    }
  }

  function confirmBlock() {
    if (!conversation || isRunningAction) return;
    Alert.alert(
      `Blokir ${conversation.counterpart_alias}?`,
      "Profil ini tidak bisa menghubungimu atau mengirim perkenalan baru.",
      [
        { text: "Batal", style: "cancel" },
        { text: "Blokir", style: "destructive", onPress: () => void runBlock() },
      ],
    );
  }

  async function runBlock() {
    if (!conversation) return;
    setIsRunningAction(true);
    try {
      await blockConversationCounterpart(conversation.counterpart_alias);
      setConversation((current) => current ? { ...current, status: "blocked", can_send: false } : current);
      Alert.alert("Akun diblokir", "Kamu tidak akan menerima perkenalan atau pesan baru dari akun ini.");
    } catch (actionError) {
      Alert.alert("Belum berhasil", actionError instanceof Error ? actionError.message : "Coba lagi sebentar.");
    } finally {
      setIsRunningAction(false);
    }
  }

  async function submitReport(reasonCode: ReportReasonCode, details: string) {
    if (!publicId) return;
    setIsRunningAction(true);
    try {
      await reportConversation({ publicId, reasonCode, details });
      setReportOpen(false);
      Alert.alert("Laporan terkirim", "Terima kasih. Tim StudyDate akan meninjau laporanmu.");
    } catch (actionError) {
      Alert.alert("Laporan belum terkirim", actionError instanceof Error ? actionError.message : "Coba lagi sebentar.");
    } finally {
      setIsRunningAction(false);
    }
  }

  if (isLoading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.blue} /><Text style={styles.loadingText}>Menyiapkan percakapan...</Text></View>;
  }

  if (!conversation) {
    return (
      <View style={styles.loading}>
        <Text style={styles.emptyTitle}>Percakapan tidak ditemukan</Text>
        <Text style={styles.loadingText}>{error ?? "Percakapan ini mungkin sudah tidak tersedia."}</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backButtonText}>Kembali ke Pesan</Text></Pressable>
      </View>
    );
  }

  const closed = !conversation.can_send || conversation.status === "ended" || conversation.status === "blocked";

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <Stack.Screen options={{ title: conversation.counterpart_alias }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={92} style={styles.keyboard}>
        <View style={styles.profileBar}>
          <View style={styles.profileText}>
            <View style={styles.aliasRow}>
              <Text style={styles.alias}>{conversation.counterpart_alias}</Text>
              {conversation.is_verified ? <Text style={styles.verified}>Terverifikasi</Text> : null}
            </View>
            <Text numberOfLines={1} style={styles.meta}>{conversation.campus} · {conversation.study_program}{conversation.semester ? ` · Semester ${conversation.semester}` : ""}</Text>
          </View>
          <View style={styles.safetyActions}>
            {!closed ? <Pressable disabled={isRunningAction} onPress={confirmEnd} style={styles.smallAction}><Text style={styles.smallActionText}>Akhiri</Text></Pressable> : null}
            <Pressable disabled={isRunningAction} onPress={() => setReportOpen(true)} style={styles.smallAction}><Text style={styles.smallActionText}>Laporkan</Text></Pressable>
            <Pressable disabled={isRunningAction || conversation.status === "blocked"} onPress={confirmBlock} style={styles.smallDanger}><Text style={styles.smallDangerText}>Blokir</Text></Pressable>
          </View>
        </View>
        <Text style={styles.privacyNote}>Kalian masih memakai nama samaran. Jangan terburu-buru membagikan data pribadi.</Text>

        <FlatList
          ref={listRef}
          contentContainerStyle={styles.messages}
          data={messages}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.message_id}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>Mulai dengan sapaan sederhana</Text><Text style={styles.loadingText}>Bahas kelas, tugas, minat, atau acara kampus yang kalian suka.</Text></View>}
          ListHeaderComponent={hasMore ? (
            <Pressable disabled={isLoadingMore} onPress={() => void loadOlder()} style={styles.olderButton}>
              <Text style={styles.olderText}>{isLoadingMore ? "Memuat..." : "Muat pesan sebelumnya"}</Text>
            </Pressable>
          ) : null}
          onContentSizeChange={() => {
            if (shouldScrollToEnd.current) {
              shouldScrollToEnd.current = false;
              listRef.current?.scrollToEnd({ animated: false });
            }
          }}
          renderItem={({ item }) => <MessageBubble message={item} />}
        />

        {closed ? (
          <Text style={styles.closedNote}>{conversation.status === "blocked" ? "Percakapan tidak tersedia setelah akun diblokir." : "Percakapan ini sudah selesai. Pesan lama tetap bisa dibaca."}</Text>
        ) : (
          <View style={styles.composerWrap}>
            {error ? <Text accessibilityLiveRegion="polite" style={styles.composerError}>{error}</Text> : null}
            <View style={styles.composer}>
              <TextInput
                editable={!isSending}
                maxLength={CHAT_MESSAGE_MAX}
                multiline
                onChangeText={setBody}
                placeholder="Tulis pesan..."
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={body}
              />
              <Pressable disabled={isSending || !body.trim()} onPress={() => void submitMessage()} style={[styles.sendButton, (isSending || !body.trim()) && styles.disabled]}>
                <Text style={styles.sendText}>{isSending ? "..." : "Kirim"}</Text>
              </Pressable>
            </View>
            <Text style={styles.counter}>{body.length}/{CHAT_MESSAGE_MAX}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
      <ReportConversationModal
        isSubmitting={isRunningAction}
        onClose={() => !isRunningAction && setReportOpen(false)}
        onSubmit={submitReport}
        visible={reportOpen}
      />
    </SafeAreaView>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const removed = message.moderation_status === "removed";
  const content = removed
    ? "Pesan ini tidak tersedia."
    : message.message_type === "sticker"
      ? message.body || "Stiker StudyDate"
      : message.message_type === "circle_invite" || message.message_type === "event_invite"
        ? message.share_title ?? message.body
        : message.body;
  return (
    <View style={[styles.bubbleRow, message.is_mine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, message.is_mine ? styles.bubbleMine : styles.bubbleOther, removed && styles.bubbleRemoved]}>
        {message.reply_body ? <Text numberOfLines={2} style={[styles.reply, message.is_mine && styles.replyMine]}>{message.reply_is_mine ? "Kamu: " : "Balasan: "}{message.reply_body}</Text> : null}
        <Text style={[styles.messageText, message.is_mine && styles.messageTextMine, removed && styles.removedText]}>{content}</Text>
        {message.share_description && !removed ? <Text style={[styles.shareDescription, message.is_mine && styles.shareDescriptionMine]}>{message.share_description}</Text> : null}
        <View style={styles.messageMeta}>
          <Text style={[styles.messageTime, message.is_mine && styles.messageTimeMine]}>{messageTime(message.created_at)}</Text>
          {message.is_mine && message.read_at ? <Text style={styles.read}>Dibaca</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.surface, flex: 1 },
  keyboard: { flex: 1 },
  loading: { alignItems: "center", backgroundColor: colors.surface, flex: 1, gap: 12, justifyContent: "center", padding: 30 },
  loadingText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  emptyTitle: { color: colors.navy, fontSize: 18, fontWeight: "800", textAlign: "center" },
  backButton: { backgroundColor: colors.navy, borderRadius: radius.medium, marginTop: 8, paddingHorizontal: 18, paddingVertical: 13 },
  backButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  profileBar: { alignItems: "flex-start", backgroundColor: colors.white, borderBottomColor: colors.border, borderBottomWidth: 1, gap: 10, padding: 14 },
  profileText: { minWidth: 0, width: "100%" },
  aliasRow: { alignItems: "center", flexDirection: "row", gap: 7 },
  alias: { color: colors.navy, fontSize: 16, fontWeight: "800" },
  verified: { color: colors.success, fontSize: 10, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 11, marginTop: 4 },
  safetyActions: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  smallAction: { borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
  smallActionText: { color: colors.navy, fontSize: 10, fontWeight: "800" },
  smallDanger: { backgroundColor: "#FFF0EE", borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7 },
  smallDangerText: { color: colors.danger, fontSize: 10, fontWeight: "800" },
  privacyNote: { backgroundColor: colors.blueSoft, color: colors.blue, fontSize: 11, lineHeight: 17, paddingHorizontal: 15, paddingVertical: 9, textAlign: "center" },
  messages: { flexGrow: 1, padding: 14, paddingBottom: 20 },
  olderButton: { alignSelf: "center", borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, marginBottom: 18, paddingHorizontal: 13, paddingVertical: 8 },
  olderText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  empty: { alignItems: "center", gap: 7, paddingHorizontal: 28, paddingVertical: 58 },
  bubbleRow: { alignItems: "flex-start", marginBottom: 9 },
  bubbleRowMine: { alignItems: "flex-end" },
  bubble: { borderRadius: 18, maxWidth: "84%", minWidth: 76, paddingHorizontal: 13, paddingVertical: 10 },
  bubbleOther: { backgroundColor: colors.white, borderColor: colors.border, borderTopLeftRadius: 5, borderWidth: 1 },
  bubbleMine: { backgroundColor: colors.blue, borderTopRightRadius: 5 },
  bubbleRemoved: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  reply: { borderLeftColor: colors.blue, borderLeftWidth: 3, color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 7, paddingLeft: 8 },
  replyMine: { borderLeftColor: "rgba(255,255,255,0.7)", color: "rgba(255,255,255,0.78)" },
  messageText: { color: colors.navy, fontSize: 14, lineHeight: 20 },
  messageTextMine: { color: colors.white },
  removedText: { color: colors.muted, fontStyle: "italic" },
  shareDescription: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  shareDescriptionMine: { color: "rgba(255,255,255,0.78)" },
  messageMeta: { alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "flex-end", marginTop: 5 },
  messageTime: { color: colors.muted, fontSize: 9 },
  messageTimeMine: { color: "rgba(255,255,255,0.72)" },
  read: { color: "rgba(255,255,255,0.9)", fontSize: 9, fontWeight: "700" },
  closedNote: { backgroundColor: colors.white, borderTopColor: colors.border, borderTopWidth: 1, color: colors.muted, fontSize: 12, lineHeight: 18, padding: 15, textAlign: "center" },
  composerWrap: { backgroundColor: colors.white, borderTopColor: colors.border, borderTopWidth: 1, padding: 10, paddingBottom: 7 },
  composerError: { color: colors.danger, fontSize: 11, marginBottom: 7, paddingHorizontal: 3 },
  composer: { alignItems: "flex-end", flexDirection: "row", gap: 8 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, color: colors.navy, flex: 1, fontSize: 14, maxHeight: 120, minHeight: 46, paddingHorizontal: 14, paddingVertical: 11 },
  sendButton: { alignItems: "center", backgroundColor: colors.blue, borderRadius: 18, height: 46, justifyContent: "center", paddingHorizontal: 15 },
  sendText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  counter: { color: colors.muted, fontSize: 9, marginTop: 4, textAlign: "right" },
});
