"use client";

import {
  blockFromConversation,
  endConversationAction,
  markMessagesReadAction,
  reportFromConversation,
  submitChatMessage,
} from "@/app/app/messages/actions";
import {
  CHAT_CONTACT_MESSAGE,
  CHAT_MESSAGE_MAX,
  CONVERSATION_CLOSED_MESSAGE,
  CONVERSATION_PRIVACY_NOTE,
  REPORT_REASON_CODES,
  REPORT_REASON_LABELS,
} from "@/lib/messages/constants";
import {
  clearChatDraft,
  readChatDraft,
  writeChatDraft,
} from "@/lib/messages/drafts";
import {
  getCharacterThresholdAnnouncement,
  isNearChatBottom,
  mergeChatMessages,
  nextChatPollDelay,
  nextPollDelay,
} from "@/lib/messages/client-state";
import {
  findChatMessageIds,
  normalizeChatSearchQuery,
} from "@/lib/messages/search";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ChatMessage, ConversationDetail } from "@/lib/messages/service";
import type { ChatShareableItem, ChatShareKind } from "@/lib/messages/shares";
import type { MutualInterestState } from "@/lib/mutual-interest/constants";
import type {
  IdentityRevealCompleted,
  IdentityRevealProfilePreview,
  IdentityRevealState,
} from "@/lib/identity-reveal/constants";
import { normalizeIdentityRevealState } from "@/lib/identity-reveal/panel-visibility";
import {
  emptyContactRevealState,
  type ContactRevealCompletedChannel,
  type ContactRevealPreview,
  type ContactRevealState,
  type ContactRevealChannel,
} from "@/lib/contact-reveal/constants";
import { MutualInterestPanel } from "@/components/messages/mutual-interest-panel";
import { IdentityRevealPanel } from "@/components/messages/identity-reveal-panel";
import { ContactRevealPanel } from "@/components/messages/contact-reveal-panel";
import { CounterpartPrivacyCard } from "@/components/messages/counterpart-privacy-card";
import { TelegramCompanionPanel } from "@/components/messages/telegram-companion-panel";
import { MeetingPlanPanel } from "@/components/messages/meeting-plan-panel";
import { ChatMessageBubble } from "@/components/messages/chat-message-bubble";
import { ChatComposerTools } from "@/components/messages/chat-composer-tools";
import { getMascotForAlias } from "@/lib/people/constants";
import type { ChatReactionValue } from "@/lib/messages/reactions";
import { CHAT_STARTERS } from "@/lib/messages/starters";
import { getChatStickerById } from "@/lib/messages/stickers";
import type { TelegramSafeState } from "@/lib/telegram/constants";
import type { MeetingPlanState } from "@/lib/meeting-plans/constants";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";

type ConversationRoomProps = {
  conversation: ConversationDetail;
  initialMessages: ChatMessage[];
  messageInteractionsEnabled: boolean;
  chatSharingEnabled: boolean;
  initialShareables: ChatShareableItem[];
  initialMutualInterest: MutualInterestState;
  initialIdentityReveal: IdentityRevealState;
  initialIdentityRevealPreview: IdentityRevealProfilePreview | null;
  initialIdentityRevealCompleted: IdentityRevealCompleted | null;
  initialContactReveal: ContactRevealState;
  initialContactPreviews: Partial<
    Record<ContactRevealChannel, ContactRevealPreview | null>
  >;
  initialContactCompleted: Partial<
    Record<ContactRevealChannel, ContactRevealCompletedChannel | null>
  >;
  profileContactDefaults?: Partial<Record<ContactRevealChannel, string>>;
  initialTelegramCompanion: TelegramSafeState;
  initialMeetingPlan: MeetingPlanState;
  notice?: string | null;
  state?: string | null;
};

function formatDay(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

function makeIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  }
  return `k${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
}

function currentTimeMs() {
  return Date.now();
}

export function ConversationRoom({
  conversation,
  initialMessages,
  messageInteractionsEnabled,
  chatSharingEnabled,
  initialShareables,
  initialMutualInterest,
  initialIdentityReveal,
  initialIdentityRevealPreview,
  initialIdentityRevealCompleted,
  initialContactReveal,
  initialContactPreviews,
  initialContactCompleted,
  profileContactDefaults,
  initialTelegramCompanion,
  initialMeetingPlan,
  notice,
  state,
}: ConversationRoomProps) {
  const [messages, setMessages] = useState(() =>
    [...initialMessages].reverse(),
  );
  const [status, setStatus] = useState(conversation.status);
  const [canSend, setCanSend] = useState(conversation.can_send);
  const [mutualInterest, setMutualInterest] = useState(initialMutualInterest);
  const [identityReveal, setIdentityReveal] = useState(() =>
    normalizeIdentityRevealState(initialIdentityReveal),
  );
  const [identityRevealCompleted, setIdentityRevealCompleted] = useState(
    initialIdentityRevealCompleted,
  );
  const [contactReveal, setContactReveal] = useState(
    () => initialContactReveal ?? emptyContactRevealState(),
  );
  const [contactCompleted, setContactCompleted] = useState(
    initialContactCompleted,
  );
  const [body, setBody] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [reactionPending, setReactionPending] = useState<string | null>(null);
  const [counterpartTyping, setCounterpartTyping] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [clientError, setClientError] = useState<string | null>(notice ?? null);
  const [pending, startTransition] = useTransition();
  const [pollNote, setPollNote] = useState<string | null>(null);
  const [revealNote, setRevealNote] = useState<string | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(
    initialMessages.length === 50,
  );
  const [historyPending, setHistoryPending] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [newMessagesAvailable, setNewMessagesAvailable] = useState(false);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchInput, setChatSearchInput] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const chatSearchInputRef = useRef<HTMLInputElement>(null);
  const messageNodeRefs = useRef(new Map<string, HTMLDivElement>());
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef(messages);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const counterpartTypingTimerRef = useRef<number | undefined>(undefined);
  const typingStopTimerRef = useRef<number | undefined>(undefined);
  const typingActiveRef = useRef(false);
  const lastTypingSignalAtRef = useRef(0);
  const markedRead = useRef(false);
  const initialScrollDone = useRef(false);
  const shouldScrollAfterUpdate = useRef(false);
  const prependSnapshot = useRef<{ height: number; top: number } | null>(null);
  const errorId = useId();
  const counterId = useId();
  const counterStatusId = useId();
  const chatSearchInputId = useId();
  const endTitleId = useId();
  const endDescriptionId = useId();
  const endDialogRef = useRef<HTMLDialogElement>(null);
  const endTriggerRef = useRef<HTMLButtonElement>(null);
  const endCancelRef = useRef<HTMLButtonElement>(null);

  const chronological = useMemo(() => messages, [messages]);
  const chatSearchQuery = useMemo(
    () => normalizeChatSearchQuery(chatSearchInput),
    [chatSearchInput],
  );
  const searchMessageIds = useMemo(
    () => findChatMessageIds(chronological, chatSearchQuery),
    [chronological, chatSearchQuery],
  );
  const searchMessageIdSet = useMemo(
    () => new Set(searchMessageIds),
    [searchMessageIds],
  );
  const currentSearchIndex = Math.min(
    activeSearchIndex,
    Math.max(searchMessageIds.length - 1, 0),
  );
  const activeSearchMessageId =
    searchMessageIds[currentSearchIndex] ?? null;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setBody(readChatDraft(window.localStorage, conversation.public_id));
    setDraftReady(true);
  }, [conversation.public_id]);

  useEffect(() => {
    if (!activeSearchMessageId) return;
    messageNodeRefs.current.get(activeSearchMessageId)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeSearchMessageId]);

  useLayoutEffect(() => {
    const node = listRef.current;
    if (!node) return;

    if (prependSnapshot.current) {
      const snapshot = prependSnapshot.current;
      prependSnapshot.current = null;
      node.scrollTop = snapshot.top + node.scrollHeight - snapshot.height;
      return;
    }
    if (!initialScrollDone.current || shouldScrollAfterUpdate.current) {
      node.scrollTop = node.scrollHeight;
      initialScrollDone.current = true;
      shouldScrollAfterUpdate.current = false;
      setNewMessagesAvailable(false);
    }
  }, [chronological.length]);

  useEffect(() => {
    if (markedRead.current) return;
    if (conversation.unread_count <= 0) return;
    markedRead.current = true;
    const formData = new FormData();
    formData.set("publicId", conversation.public_id);
    void markMessagesReadAction(formData);
  }, [conversation.public_id, conversation.unread_count]);

  useEffect(() => {
    let cancelled = false;
    let messageFailures = 0;
    let messageIdleCycles = 0;
    let revealFailures = 0;
    let messageTimer: number | undefined;
    let revealTimer: number | undefined;
    let messageGeneration = 0;
    let revealGeneration = 0;
    let messageController: AbortController | null = null;
    let revealController: AbortController | null = null;
    let realtimeClient: ReturnType<typeof createBrowserSupabaseClient> | null =
      null;
    let realtimeChannel: RealtimeChannel | null = null;

    function scheduleMessages(delay: number) {
      window.clearTimeout(messageTimer);
      if (!cancelled && !document.hidden && navigator.onLine) {
        messageTimer = window.setTimeout(pollMessages, delay);
      }
    }

    function scheduleReveal(delay: number) {
      window.clearTimeout(revealTimer);
      if (!cancelled && !document.hidden && navigator.onLine) {
        revealTimer = window.setTimeout(pollReveal, delay);
      }
    }

    async function pollMessages() {
      if (cancelled || document.hidden || !navigator.onLine) return;
      const generation = ++messageGeneration;
      messageController = new AbortController();
      try {
        const response = await fetch(
          `/api/messages/${conversation.public_id}?mode=messages`,
          { cache: "no-store", signal: messageController.signal },
        );
        if (!response.ok) {
          throw new Error("poll unavailable");
        }
        const payload = (await response.json()) as {
          conversation: {
            status: ConversationDetail["status"];
            can_send: boolean;
          };
          messages: ChatMessage[];
        };
        if (cancelled || generation !== messageGeneration) return;
        messageFailures = 0;
        setPollNote(null);
        setStatus(payload.conversation.status);
        setCanSend(payload.conversation.can_send);
        const node = listRef.current;
        const nearBottom = node
          ? isNearChatBottom(
              node.scrollHeight,
              node.scrollTop,
              node.clientHeight,
            )
          : true;
        const known = new Set(
          messagesRef.current.map((message) => message.message_id),
        );
        const newMessages = payload.messages.filter(
          (message) => !known.has(message.message_id),
        );
        const hasNew = newMessages.length > 0;
        messageIdleCycles = hasNew ? 0 : Math.min(messageIdleCycles + 1, 4);
        if (hasNew) {
          shouldScrollAfterUpdate.current = nearBottom;
          setNewMessagesAvailable(!nearBottom);
        }
        setMessages((current) => mergeChatMessages(current, payload.messages));

        if (
          newMessages.some((message) => !message.is_mine && !message.read_at)
        ) {
          const formData = new FormData();
          formData.set("publicId", conversation.public_id);
          void markMessagesReadAction(formData);
        }
      } catch {
        if (cancelled) return;
        messageFailures += 1;
        if (messageFailures >= 2) {
          setPollNote("Menyambungkan ulang…");
        }
      } finally {
        scheduleMessages(nextChatPollDelay(messageFailures, messageIdleCycles));
      }
    }

    async function pollReveal() {
      if (cancelled || document.hidden || !navigator.onLine) return;
      const generation = ++revealGeneration;
      revealController = new AbortController();
      try {
        const response = await fetch(
          `/api/messages/${conversation.public_id}?mode=reveal`,
          { cache: "no-store", signal: revealController.signal },
        );
        if (!response.ok) throw new Error("reveal unavailable");
        const payload = (await response.json()) as {
          mutualInterest?: MutualInterestState;
          identityReveal?: IdentityRevealState;
          identityRevealCompleted?: IdentityRevealCompleted | null;
          contactReveal?: ContactRevealState;
          contactRevealCompleted?: ContactRevealCompletedChannel[];
        };
        if (cancelled || generation !== revealGeneration) return;
        revealFailures = 0;
        setRevealNote(null);
        if (payload.mutualInterest) setMutualInterest(payload.mutualInterest);
        if (payload.identityReveal) setIdentityReveal(payload.identityReveal);
        if (payload.identityRevealCompleted?.completed) {
          setIdentityRevealCompleted(payload.identityRevealCompleted);
        }
        if (payload.contactReveal) setContactReveal(payload.contactReveal);
        if (payload.contactRevealCompleted) {
          setContactCompleted((current) => {
            const next = { ...current };
            for (const item of payload.contactRevealCompleted ?? []) {
              next[item.channel] = item;
            }
            return next;
          });
        }
      } catch {
        if (cancelled) return;
        revealFailures += 1;
        setRevealNote("Data pembukaan belum dapat diperbarui.");
      } finally {
        scheduleReveal(nextPollDelay(revealFailures, 30000, 120000));
      }
    }

    function stopActivePolls() {
      window.clearTimeout(messageTimer);
      window.clearTimeout(revealTimer);
      messageGeneration += 1;
      revealGeneration += 1;
      messageController?.abort();
      revealController?.abort();
    }

    function resumePolling() {
      if (cancelled || document.hidden || !navigator.onLine) return;
      messageFailures = 0;
      revealFailures = 0;
      setPollNote(null);
      void pollMessages();
      void pollReveal();
    }

    function handleVisibility() {
      stopActivePolls();
      if (!document.hidden) resumePolling();
    }

    function handleOffline() {
      stopActivePolls();
      setPollNote("Koneksi terputus. Menunggu jaringan…");
    }

    function handleOnline() {
      resumePolling();
    }

    realtimeClient = createBrowserSupabaseClient();
    realtimeChannel = realtimeClient
      .channel(`conversation:${conversation.public_id}`, {
        config: {
          private: true,
          broadcast: { self: false, ack: false },
        },
      })
      .on("broadcast", { event: "message_changed" }, () => {
        messageIdleCycles = 0;
        void pollMessages();
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const active = payload?.active === true;
        window.clearTimeout(counterpartTypingTimerRef.current);
        setCounterpartTyping(active);
        if (active) {
          counterpartTypingTimerRef.current = window.setTimeout(
            () => setCounterpartTyping(false),
            2_500,
          );
        }
      });
    realtimeChannelRef.current = realtimeChannel;
    void realtimeClient.realtime
      .setAuth()
      .then(() => {
        if (cancelled || !realtimeChannel) return;
        realtimeChannel.subscribe((subscriptionStatus) => {
          if (cancelled) return;
          const connected = subscriptionStatus === "SUBSCRIBED";
          setRealtimeConnected(connected);
          if (!connected) {
            typingActiveRef.current = false;
            setCounterpartTyping(false);
          }
        });
      })
      .catch(() => {
        if (!cancelled) setRealtimeConnected(false);
      });

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    scheduleMessages(6_000);
    scheduleReveal(30_000);

    return () => {
      cancelled = true;
      messageGeneration += 1;
      revealGeneration += 1;
      messageController?.abort();
      revealController?.abort();
      window.clearTimeout(messageTimer);
      window.clearTimeout(revealTimer);
      window.clearTimeout(counterpartTypingTimerRef.current);
      window.clearTimeout(typingStopTimerRef.current);
      if (realtimeChannelRef.current === realtimeChannel) {
        realtimeChannelRef.current = null;
      }
      if (realtimeClient && realtimeChannel) {
        void realtimeClient.removeChannel(realtimeChannel);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [conversation.public_id]);

  async function loadOlderMessages() {
    const oldest = messages[0];
    const node = listRef.current;
    if (!oldest || !node || historyPending) return;
    setHistoryPending(true);
    setHistoryError(null);
    prependSnapshot.current = {
      height: node.scrollHeight,
      top: node.scrollTop,
    };
    try {
      const response = await fetch(`/api/messages/${conversation.public_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beforeCreatedAt: oldest.created_at,
          beforeId: oldest.message_id,
        }),
      });
      if (!response.ok) throw new Error("history unavailable");
      const payload = (await response.json()) as {
        messages: ChatMessage[];
        hasMore: boolean;
      };
      setMessages((current) => mergeChatMessages(current, payload.messages));
      setHasMoreHistory(payload.hasMore);
    } catch {
      prependSnapshot.current = null;
      setHistoryError("Pesan sebelumnya belum dapat dimuat.");
    } finally {
      setHistoryPending(false);
    }
  }

  function trapEndDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function closeEndDialog() {
    endDialogRef.current?.close();
  }

  function publishTyping(active: boolean) {
    const channel = realtimeChannelRef.current;
    if (!realtimeConnected || !channel) return;
    typingActiveRef.current = active;
    if (active) lastTypingSignalAtRef.current = currentTimeMs();
    void channel
      .send({
        type: "broadcast",
        event: "typing",
        payload: { active },
      })
      .catch(() => undefined);
  }

  function updateComposerBody(next: string) {
    setBody(next);
    if (draftReady) {
      writeChatDraft(window.localStorage, conversation.public_id, next);
    }
    window.clearTimeout(typingStopTimerRef.current);
    if (!next.trim()) {
      if (typingActiveRef.current) publishTyping(false);
      return;
    }

    const now = currentTimeMs();
    if (now - lastTypingSignalAtRef.current >= 1_200) {
      publishTyping(true);
    }
    typingStopTimerRef.current = window.setTimeout(
      () => publishTyping(false),
      1_800,
    );
  }

  function insertEmoji(emoji: string) {
    const textarea = composerRef.current;
    if (!textarea) {
      updateComposerBody((body + emoji).slice(0, CHAT_MESSAGE_MAX));
      return;
    }

    const start = textarea.selectionStart ?? body.length;
    const end = textarea.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${emoji}${body.slice(end)}`;
    if (next.length > CHAT_MESSAGE_MAX) {
      setClientError(`Maksimal ${CHAT_MESSAGE_MAX} karakter.`);
      return;
    }

    updateComposerBody(next);
    setClientError(null);
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + emoji.length;
      textarea.setSelectionRange(caret, caret);
    });
  }

  function selectReply(message: ChatMessage) {
    if (
      !messageInteractionsEnabled ||
      message.moderation_status !== "visible"
    ) {
      return;
    }
    setReplyingTo(message);
    setClientError(null);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  async function reactToMessage(
    messageId: string,
    reaction: ChatReactionValue,
  ) {
    if (!messageInteractionsEnabled || reactionPending) return;
    setReactionPending(messageId);
    setClientError(null);
    try {
      const response = await fetch(
        `/api/messages/${conversation.public_id}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId, reaction }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        message?: ChatMessage;
        error?: string;
      } | null;
      if (!response.ok || !payload?.message) {
        throw new Error(
          payload?.error ?? "Reaksi belum dapat disimpan. Coba lagi.",
        );
      }
      setMessages((current) =>
        mergeChatMessages(current, [payload.message as ChatMessage]),
      );
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Reaksi belum dapat disimpan. Coba lagi.",
      );
    } finally {
      setReactionPending(null);
    }
  }

  function onComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend || pending) return;

    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const stickerId = submitter?.name === "stickerId" ? submitter.value : null;
    const shareToken =
      submitter?.name === "shareToken" ? submitter.value : null;
    const shareMatch = shareToken?.match(
      /^(circle|event):((?:circle|event)-[0-9a-f]{24})$/,
    );
    const share = shareMatch
      ? {
          kind: shareMatch[1] as ChatShareKind,
          publicSlug: shareMatch[2],
        }
      : null;
    const idempotencyKey = makeIdempotencyKey();
    const replyToMessageId =
      messageInteractionsEnabled && replyingTo
        ? replyingTo.message_id
        : undefined;
    const trimmed = body
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (shareToken && !share) {
      setClientError("Circle atau acara tidak ditemukan.");
      return;
    }
    if (!stickerId && !share && !trimmed) {
      setClientError("Tulis pesan singkat terlebih dahulu.");
      return;
    }
    if (!stickerId && !share && trimmed.length > CHAT_MESSAGE_MAX) {
      setClientError(`Maksimal ${CHAT_MESSAGE_MAX} karakter.`);
      return;
    }

    setClientError(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/messages/${conversation.public_id}/send`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              stickerId
                ? {
                    type: "sticker",
                    stickerId,
                    idempotencyKey,
                    replyToMessageId,
                  }
                : share
                  ? {
                      type: "share",
                      shareKind: share.kind,
                      sharePublicSlug: share.publicSlug,
                      idempotencyKey,
                      replyToMessageId,
                    }
                  : {
                      type: "text",
                      body: trimmed,
                      idempotencyKey,
                      replyToMessageId,
                    },
            ),
          },
        );
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          message?: ChatMessage;
          conversationStatus?: ConversationDetail["status"];
        } | null;
        if (!response.ok || !payload?.message) {
          throw new Error(
            payload?.error ?? "Pesan belum dapat dikirim. Coba lagi.",
          );
        }

        shouldScrollAfterUpdate.current = true;
        setMessages((current) =>
          mergeChatMessages(current, [payload.message as ChatMessage]),
        );
        if (payload.conversationStatus) {
          setStatus(payload.conversationStatus);
        }
        if (!stickerId && !share) {
          updateComposerBody("");
          clearChatDraft(window.localStorage, conversation.public_id);
        }
        setReplyingTo(null);
      } catch (error) {
        setClientError(
          error instanceof Error
            ? error.message
            : "Pesan belum dapat dikirim. Coba lagi.",
        );
      }
    });
  }

  function openChatSearch() {
    setChatSearchOpen(true);
    requestAnimationFrame(() => chatSearchInputRef.current?.focus());
  }

  function closeChatSearch() {
    setChatSearchOpen(false);
    setChatSearchInput("");
    setActiveSearchIndex(0);
  }

  function moveChatSearchResult(direction: -1 | 1) {
    if (searchMessageIds.length === 0) return;
    setActiveSearchIndex((current) => {
      const safeCurrent = Math.min(current, searchMessageIds.length - 1);
      return (
        (safeCurrent + direction + searchMessageIds.length) %
        searchMessageIds.length
      );
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape" && replyingTo) {
      event.preventDefault();
      setReplyingTo(null);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const closed = status === "ended" || status === "blocked" || !canSend;

  return (
    <div className="flex min-h-[calc(100svh-5rem)] flex-col lg:min-h-svh">
      <header className="border-b border-brand-border bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/app/messages"
            className="focus-ring inline-flex min-h-10 items-center text-sm font-semibold text-brand-blue"
          >
            ← Kembali ke Pesan
          </Link>
          <button
            type="button"
            onClick={openChatSearch}
            aria-expanded={chatSearchOpen}
            aria-controls="chat-search-panel"
            className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-muted hover:bg-brand-surface hover:text-brand-blue"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Cari chat
          </button>
        </div>
        <div className="mt-4 flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-end justify-center overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_20%,#ffffff_0%,#edf4ff_55%,#dfeaff_100%)]">
            <Image
              src={getMascotForAlias(conversation.counterpart_alias)}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 object-contain object-bottom"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-semibold text-brand-navy">
                {conversation.counterpart_alias}
              </h1>
              {conversation.is_verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-surface px-2.5 py-1 text-xs font-semibold text-brand-blue">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Terverifikasi
                </span>
              ) : null}
            </div>
            {conversation.counterpart_alias !== "Akun dihapus" ? (
              <p className="mt-1 text-sm text-brand-muted">
                {conversation.study_program} · {conversation.campus}
              </p>
            ) : null}
            <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">
              {CONVERSATION_PRIVACY_NOTE}
            </p>
          </div>
        </div>
        {chatSearchOpen ? (
          <div
            id="chat-search-panel"
            className="mt-4 rounded-xl border border-brand-border bg-brand-surface p-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor={chatSearchInputId} className="sr-only">
                Cari isi chat
              </label>
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted"
                  aria-hidden="true"
                />
                <input
                  ref={chatSearchInputRef}
                  id={chatSearchInputId}
                  type="search"
                  value={chatSearchInput}
                  maxLength={80}
                  autoComplete="off"
                  placeholder="Cari isi chat"
                  onChange={(event) => {
                    setChatSearchInput(event.target.value);
                    setActiveSearchIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      closeChatSearch();
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      moveChatSearchResult(event.shiftKey ? -1 : 1);
                    }
                  }}
                  className="focus-ring min-h-11 w-full rounded-lg border border-brand-border bg-white py-2.5 pl-10 pr-3 text-sm text-brand-navy placeholder:text-brand-muted"
                />
              </div>
              <div className="flex items-center justify-between gap-1 sm:justify-start">
                <p
                  role="status"
                  aria-live="polite"
                  className="min-w-20 px-2 text-center text-xs font-semibold text-brand-muted"
                >
                  {!chatSearchQuery
                    ? "Ketik kata"
                    : searchMessageIds.length === 0
                      ? "Tidak ada"
                      : `${currentSearchIndex + 1} dari ${searchMessageIds.length}`}
                </p>
                <button
                  type="button"
                  onClick={() => moveChatSearchResult(-1)}
                  disabled={searchMessageIds.length === 0}
                  aria-label="Hasil sebelumnya"
                  className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-muted hover:bg-white hover:text-brand-blue disabled:opacity-40"
                >
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => moveChatSearchResult(1)}
                  disabled={searchMessageIds.length === 0}
                  aria-label="Hasil berikutnya"
                  className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-muted hover:bg-white hover:text-brand-blue disabled:opacity-40"
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={closeChatSearch}
                  aria-label="Tutup pencarian"
                  className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-muted hover:bg-white hover:text-brand-navy"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            {chatSearchQuery && hasMoreHistory ? (
              <p className="mt-2 text-xs leading-5 text-brand-muted">
                Pencarian hanya mencakup pesan yang sudah dimuat. Muat pesan
                sebelumnya untuk mencari lebih jauh.
              </p>
            ) : null}
          </div>
        ) : null}
        {pollNote ? (
          <p
            role="status"
            aria-live="polite"
            className="mt-3 text-xs text-brand-muted"
          >
            {pollNote}
          </p>
        ) : null}
        {revealNote ? (
          <p role="status" className="mt-3 text-xs text-brand-muted">
            {revealNote}
          </p>
        ) : null}
        {state === "ended" || status === "ended" ? (
          <p
            role="status"
            className="mt-3 rounded-xl bg-brand-surface px-4 py-3 text-sm text-brand-navy"
          >
            {CONVERSATION_CLOSED_MESSAGE}
          </p>
        ) : null}
        {state === "blocked" || status === "blocked" ? (
          <p
            role="status"
            className="mt-3 rounded-xl bg-brand-surface px-4 py-3 text-sm text-brand-navy"
          >
            Percakapan tidak tersedia saat ini.
          </p>
        ) : null}
        {state === "reported" ? (
          <p
            role="status"
            className="mt-3 rounded-xl bg-brand-surface px-4 py-3 text-sm text-brand-navy"
          >
            Laporan diterima. Terima kasih sudah membantu menjaga ruang aman.
          </p>
        ) : null}
      </header>

      <div
        id="conversation-message-list"
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto bg-brand-surface px-4 py-5 sm:px-6"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Riwayat percakapan anonim"
      >
        <div className="pb-2 text-center">
          {hasMoreHistory ? (
            <button
              type="button"
              onClick={() => void loadOlderMessages()}
              disabled={historyPending}
              className="focus-ring inline-flex min-h-10 items-center rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-blue disabled:opacity-60"
            >
              {historyPending ? "Memuat…" : "Muat pesan sebelumnya"}
            </button>
          ) : chronological.length > 0 ? (
            <p className="text-xs text-brand-muted">Awal percakapan.</p>
          ) : null}
          {historyError ? (
            <div className="mt-2">
              <p role="alert" className="text-sm text-red-700">
                {historyError}
              </p>
              <button
                type="button"
                onClick={() => void loadOlderMessages()}
                className="focus-ring mt-2 text-sm font-semibold text-brand-blue"
              >
                Coba lagi
              </button>
            </div>
          ) : null}
        </div>
        {status === "awaiting_chat" && chronological.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-brand-border bg-white px-4 py-5">
            <p className="text-sm leading-6 text-brand-muted">
              Perkenalan sudah diterima. Mulai percakapan dengan santai dan
              tetap jaga privasi.
            </p>
            <p className="mt-4 text-sm font-semibold text-brand-navy">
              Belum tahu mau bahas apa?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CHAT_STARTERS.map((starter) => (
                <button
                  key={starter.label}
                  type="button"
                  className="focus-ring min-h-10 rounded-full border border-brand-border bg-brand-surface px-3 text-sm font-semibold text-brand-blue hover:border-brand-blue"
                  onClick={() => {
                    updateComposerBody(starter.message);
                    setClientError(null);
                    requestAnimationFrame(() => composerRef.current?.focus());
                  }}
                >
                  {starter.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {chronological.map((message, index) => {
          const previous = chronological[index - 1];
          const showDay =
            !previous ||
            formatDay(previous.created_at) !== formatDay(message.created_at);

          const searchMatch = searchMessageIdSet.has(message.message_id);
          const activeSearchMatch =
            activeSearchMessageId === message.message_id;

          return (
            <div
              key={message.message_id}
              ref={(node) => {
                if (node) {
                  messageNodeRefs.current.set(message.message_id, node);
                } else {
                  messageNodeRefs.current.delete(message.message_id);
                }
              }}
              className="scroll-mt-28"
            >
              {showDay ? (
                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-brand-muted">
                  {formatDay(message.created_at)}
                </p>
              ) : null}
              <ChatMessageBubble
                message={message}
                counterpartAlias={conversation.counterpart_alias}
                interactionsEnabled={messageInteractionsEnabled && !closed}
                reactionPending={reactionPending === message.message_id}
                searchQuery={chatSearchQuery}
                searchMatch={searchMatch}
                activeSearchMatch={activeSearchMatch}
                onReply={selectReply}
                onReact={(messageId, reaction) => {
                  void reactToMessage(messageId, reaction);
                }}
              />
            </div>
          );
        })}
        {newMessagesAvailable ? (
          <div className="sticky bottom-2 flex justify-center pt-2">
            <button
              type="button"
              onClick={() => {
                const node = listRef.current;
                if (!node) return;
                node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
                setNewMessagesAvailable(false);
              }}
              className="focus-ring rounded-xl border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-blue"
            >
              Pesan baru
            </button>
          </div>
        ) : null}
      </div>

      <section
        aria-label="Privasi dan pembukaan bertahap"
        className="space-y-4 border-t border-brand-border bg-white px-4 py-5 sm:px-6"
      >
        <CounterpartPrivacyCard
          mutual={mutualInterest.mutual}
          identityCompleted={identityRevealCompleted}
          contactReveal={contactReveal}
          contactCompleted={contactCompleted}
        />
        <TelegramCompanionPanel
          publicId={conversation.public_id}
          initialState={initialTelegramCompanion}
        />
        <MutualInterestPanel
          publicId={conversation.public_id}
          conversationStatus={status}
          state={mutualInterest}
          onStateChange={setMutualInterest}
        />
        <IdentityRevealPanel
          publicId={conversation.public_id}
          conversationStatus={status}
          mutualCompleted={mutualInterest.mutual}
          state={normalizeIdentityRevealState(identityReveal)}
          initialPreview={initialIdentityRevealPreview}
          completedData={identityRevealCompleted}
          onStateChange={(next) => {
            setIdentityReveal(normalizeIdentityRevealState(next));
            if (next.completed) {
              void fetch(`/api/messages/${conversation.public_id}`, {
                cache: "no-store",
              })
                .then((response) => (response.ok ? response.json() : null))
                .then((payload) => {
                  if (
                    payload?.identityRevealCompleted?.completed &&
                    payload.identityRevealCompleted.mineFirstName
                  ) {
                    setIdentityRevealCompleted(
                      payload.identityRevealCompleted as IdentityRevealCompleted,
                    );
                  }
                  if (payload?.contactReveal) {
                    setContactReveal(
                      payload.contactReveal as ContactRevealState,
                    );
                  }
                })
                .catch(() => undefined);
            }
          }}
        />
        <ContactRevealPanel
          publicId={conversation.public_id}
          conversationStatus={status}
          identityRevealCompleted={Boolean(identityReveal.completed)}
          state={contactReveal}
          initialPreviews={initialContactPreviews}
          completedByChannel={contactCompleted}
          profileDefaults={profileContactDefaults}
          onStateChange={(next) => {
            setContactReveal(next);
            if (next.channels.some((channel) => channel.completed)) {
              void fetch(`/api/messages/${conversation.public_id}`, {
                cache: "no-store",
              })
                .then((response) => (response.ok ? response.json() : null))
                .then((payload) => {
                  if (payload?.contactRevealCompleted) {
                    const nextCompleted: Partial<
                      Record<
                        ContactRevealChannel,
                        ContactRevealCompletedChannel | null
                      >
                    > = {};
                    for (const item of payload.contactRevealCompleted as ContactRevealCompletedChannel[]) {
                      nextCompleted[item.channel] = item;
                    }
                    setContactCompleted(nextCompleted);
                  }
                })
                .catch(() => undefined);
            }
          }}
        />
        <MeetingPlanPanel
          publicId={conversation.public_id}
          initialState={initialMeetingPlan}
        />
      </section>

      <footer className="sticky bottom-0 z-20 border-t border-brand-border bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        {closed ? (
          <p className="text-sm leading-6 text-brand-muted">
            {status === "blocked"
              ? "Percakapan tidak tersedia saat ini."
              : CONVERSATION_CLOSED_MESSAGE}
          </p>
        ) : (
          <form
            action={submitChatMessage}
            onSubmit={onComposerSubmit}
            className="space-y-3"
          >
            <input
              type="hidden"
              name="publicId"
              value={conversation.public_id}
            />
            <input type="hidden" name="idempotencyKey" defaultValue="" />
            <div className="min-h-5" aria-live="polite" aria-atomic="true">
              {counterpartTyping ? (
                <p className="text-xs font-medium text-brand-blue">
                  {conversation.counterpart_alias} sedang mengetik…
                </p>
              ) : realtimeConnected ? (
                <span className="sr-only">Chat tersambung langsung.</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="chat-body"
                className="text-sm font-semibold text-brand-navy"
              >
                Tulis pesan
              </label>
              <ChatComposerTools
                disabled={pending}
                sharingEnabled={chatSharingEnabled}
                shareables={initialShareables}
                onInsertEmoji={insertEmoji}
              />
            </div>
            {messageInteractionsEnabled && replyingTo ? (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface px-3 py-2">
                <div className="min-w-0 border-l-2 border-brand-blue pl-3">
                  <p className="text-xs font-semibold text-brand-blue">
                    Membalas{" "}
                    {replyingTo.is_mine
                      ? "pesanmu"
                      : conversation.counterpart_alias}
                  </p>
                  <p className="mt-0.5 line-clamp-2 break-words text-xs leading-5 text-brand-muted">
                    {replyingTo.message_type === "sticker"
                      ? (getChatStickerById(replyingTo.sticker_id)?.alt ??
                        "Stiker")
                      : replyingTo.share_title
                        ? `${replyingTo.share_kind === "event" ? "Acara" : "Circle"}: ${replyingTo.share_title}`
                        : replyingTo.body}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  aria-label="Batalkan balasan"
                  className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-muted hover:bg-white hover:text-brand-navy"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}
            <textarea
              ref={composerRef}
              id="chat-body"
              name="body"
              rows={3}
              value={body}
              onChange={(event) => updateComposerBody(event.target.value)}
              onKeyDown={onKeyDown}
              maxLength={CHAT_MESSAGE_MAX}
              disabled={pending}
              aria-invalid={clientError ? true : undefined}
              aria-describedby={[
                counterId,
                counterStatusId,
                clientError ? errorId : null,
              ]
                .filter(Boolean)
                .join(" ")}
              className="focus-ring w-full resize-y rounded-xl border border-brand-border bg-brand-surface px-3 py-3 text-sm leading-6 text-brand-navy"
              placeholder="Bagikan pesan singkat tanpa membagikan kontak."
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span id={counterId} className="text-xs text-brand-muted">
                  {body.trim().length} dari {CHAT_MESSAGE_MAX} karakter
                </span>
                {draftReady && body.trim() ? (
                  <span className="text-xs text-brand-blue">
                    Draf tersimpan otomatis di perangkat ini.
                  </span>
                ) : null}
              </div>
              <span id={counterStatusId} className="sr-only" aria-live="polite">
                {getCharacterThresholdAnnouncement(
                  body.trim().length,
                  CHAT_MESSAGE_MAX,
                )}
              </span>
              <button
                type="submit"
                disabled={pending || body.trim().length === 0}
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Mengirim…
                  </>
                ) : (
                  "Kirim"
                )}
              </button>
            </div>
            {clientError ? (
              <p id={errorId} role="alert" className="text-sm text-red-700">
                {clientError}
              </p>
            ) : (
              <p className="text-xs leading-5 text-brand-muted">
                {CHAT_CONTACT_MESSAGE}
              </p>
            )}
          </form>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {!closed ? (
            <>
              <button
                ref={endTriggerRef}
                type="button"
                className="focus-ring inline-flex min-h-11 items-center rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy"
                onClick={() => {
                  endDialogRef.current?.showModal();
                  requestAnimationFrame(() => endCancelRef.current?.focus());
                }}
              >
                Akhiri percakapan
              </button>
              <form action={blockFromConversation}>
                <input
                  type="hidden"
                  name="publicId"
                  value={conversation.public_id}
                />
                <input
                  type="hidden"
                  name="alias"
                  value={conversation.counterpart_alias}
                />
                <button
                  type="submit"
                  className="focus-ring inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-brand-muted hover:bg-brand-surface"
                >
                  Blokir
                </button>
              </form>
            </>
          ) : null}

          <details className="w-full rounded-xl border border-brand-border bg-brand-surface/60 p-4 sm:w-auto">
            <summary className="cursor-pointer text-sm font-semibold text-brand-navy">
              Laporkan
            </summary>
            <form action={reportFromConversation} className="mt-4 space-y-3">
              <input
                type="hidden"
                name="publicId"
                value={conversation.public_id}
              />
              <div>
                <label
                  htmlFor="chat-report-reason"
                  className="text-sm font-medium"
                >
                  Alasan
                </label>
                <select
                  id="chat-report-reason"
                  name="reasonCode"
                  required
                  className="focus-ring mt-1.5 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm"
                >
                  {REPORT_REASON_CODES.map((code) => (
                    <option key={code} value={code}>
                      {REPORT_REASON_LABELS[code]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="chat-report-details"
                  className="text-sm font-medium"
                >
                  Keterangan singkat (opsional)
                </label>
                <textarea
                  id="chat-report-details"
                  name="details"
                  rows={3}
                  maxLength={300}
                  className="focus-ring mt-1.5 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm"
                />
              </div>
              <button
                type="submit"
                className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white"
              >
                Kirim laporan
              </button>
            </form>
          </details>
        </div>
      </footer>

      <dialog
        ref={endDialogRef}
        aria-labelledby={endTitleId}
        aria-describedby={endDescriptionId}
        onKeyDown={trapEndDialogFocus}
        onClose={() => endTriggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeEndDialog();
        }}
        className="max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-96 overflow-y-auto rounded-[22px] border border-brand-border bg-white p-0 text-brand-navy shadow-[0_24px_60px_rgba(15,27,51,0.18)] backdrop:bg-brand-navy/45"
      >
        <form method="dialog" className="space-y-4 p-5">
          <h2 id={endTitleId} className="font-heading text-xl font-semibold">
            Akhiri percakapan?
          </h2>
          <p
            id={endDescriptionId}
            className="text-sm leading-6 text-brand-muted"
          >
            Setelah diakhiri, pesan baru tidak dapat dikirim. Riwayat tetap
            tersedia untuk kalian berdua.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              ref={endCancelRef}
              type="submit"
              value="cancel"
              className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-brand-muted"
            >
              Batal
            </button>
            <button
              type="submit"
              value="confirm"
              className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white"
              onClick={(event) => {
                event.preventDefault();
                endDialogRef.current?.close();
                const formData = new FormData();
                formData.set("publicId", conversation.public_id);
                startTransition(() => {
                  void endConversationAction(formData);
                });
              }}
            >
              Akhiri percakapan
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
