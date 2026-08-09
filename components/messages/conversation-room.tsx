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
  getCharacterThresholdAnnouncement,
  isNearChatBottom,
  mergeChatMessages,
  nextPollDelay,
} from "@/lib/messages/client-state";
import type { ChatMessage, ConversationDetail } from "@/lib/messages/service";
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
import { getMascotForAlias } from "@/lib/people/constants";
import { BadgeCheck, LoaderCircle } from "lucide-react";
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
  notice?: string | null;
  state?: string | null;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

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

export function ConversationRoom({
  conversation,
  initialMessages,
  initialMutualInterest,
  initialIdentityReveal,
  initialIdentityRevealPreview,
  initialIdentityRevealCompleted,
  initialContactReveal,
  initialContactPreviews,
  initialContactCompleted,
  profileContactDefaults,
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
  const listRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  const markedRead = useRef(false);
  const initialScrollDone = useRef(false);
  const shouldScrollAfterUpdate = useRef(false);
  const prependSnapshot = useRef<{ height: number; top: number } | null>(null);
  const errorId = useId();
  const counterId = useId();
  const counterStatusId = useId();
  const endTitleId = useId();
  const endDescriptionId = useId();
  const endDialogRef = useRef<HTMLDialogElement>(null);
  const endTriggerRef = useRef<HTMLButtonElement>(null);
  const endCancelRef = useRef<HTMLButtonElement>(null);

  const chronological = useMemo(() => messages, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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
    let revealFailures = 0;
    let messageTimer: number | undefined;
    let revealTimer: number | undefined;
    let messageGeneration = 0;
    let revealGeneration = 0;
    let messageController: AbortController | null = null;
    let revealController: AbortController | null = null;

    function scheduleMessages(delay: number) {
      window.clearTimeout(messageTimer);
      if (!cancelled && !document.hidden) {
        messageTimer = window.setTimeout(pollMessages, delay);
      }
    }

    function scheduleReveal(delay: number) {
      window.clearTimeout(revealTimer);
      if (!cancelled && !document.hidden) {
        revealTimer = window.setTimeout(pollReveal, delay);
      }
    }

    async function pollMessages() {
      if (cancelled || document.hidden) return;
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
          ? isNearChatBottom(node.scrollHeight, node.scrollTop, node.clientHeight)
          : true;
        const known = new Set(
          messagesRef.current.map((message) => message.message_id),
        );
        const hasNew = payload.messages.some(
          (message) => !known.has(message.message_id),
        );
        if (hasNew) {
          shouldScrollAfterUpdate.current = nearBottom;
          setNewMessagesAvailable(!nearBottom);
        }
        setMessages((current) =>
          mergeChatMessages(current, payload.messages),
        );
      } catch {
        if (cancelled) return;
        messageFailures += 1;
        if (messageFailures >= 2) {
          setPollNote("Menyambungkan ulang…");
        }
      } finally {
        scheduleMessages(
          nextPollDelay(messageFailures, 4000, 30000),
        );
      }
    }

    async function pollReveal() {
      if (cancelled || document.hidden) return;
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

    function handleVisibility() {
      window.clearTimeout(messageTimer);
      window.clearTimeout(revealTimer);
      messageGeneration += 1;
      revealGeneration += 1;
      messageController?.abort();
      revealController?.abort();
      if (!document.hidden) {
        void pollMessages();
        void pollReveal();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    scheduleMessages(4000);
    scheduleReveal(30000);

    return () => {
      cancelled = true;
      messageGeneration += 1;
      revealGeneration += 1;
      messageController?.abort();
      revealController?.abort();
      window.clearTimeout(messageTimer);
      window.clearTimeout(revealTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
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

  function onComposerSubmit(event: FormEvent<HTMLFormElement>) {
    if (!canSend || pending) {
      event.preventDefault();
      return;
    }
    const trimmed = body
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!trimmed) {
      event.preventDefault();
      setClientError("Tulis pesan singkat terlebih dahulu.");
      return;
    }
    if (trimmed.length > CHAT_MESSAGE_MAX) {
      event.preventDefault();
      setClientError(`Maksimal ${CHAT_MESSAGE_MAX} karakter.`);
      return;
    }

    setClientError(null);
    const keyInput = event.currentTarget.elements.namedItem(
      "idempotencyKey",
    ) as HTMLInputElement | null;
    if (keyInput) {
      keyInput.value = makeIdempotencyKey();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const closed = status === "ended" || status === "blocked" || !canSend;

  return (
    <div className="flex min-h-[calc(100svh-5rem)] flex-col lg:min-h-svh">
      <header className="border-b border-brand-border bg-white px-4 py-4 sm:px-6">
        <Link
          href="/app/messages"
          className="focus-ring inline-flex min-h-10 items-center text-sm font-semibold text-brand-blue"
        >
          ← Kembali ke Pesan
        </Link>
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
            <p className="mt-1 text-sm text-brand-muted">
              {conversation.study_program} · {conversation.campus}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">
              {CONVERSATION_PRIVACY_NOTE}
            </p>
          </div>
        </div>
        {pollNote ? (
          <p role="status" aria-live="polite" className="mt-3 text-xs text-brand-muted">
            {pollNote}
          </p>
        ) : null}
        {revealNote ? (
          <p role="status" className="mt-3 text-xs text-brand-muted">
            {revealNote}
          </p>
        ) : null}
        {state === "ended" || status === "ended" ? (
          <p role="status" className="mt-3 rounded-xl bg-brand-surface px-4 py-3 text-sm text-brand-navy">
            {CONVERSATION_CLOSED_MESSAGE}
          </p>
        ) : null}
        {state === "blocked" || status === "blocked" ? (
          <p role="status" className="mt-3 rounded-xl bg-brand-surface px-4 py-3 text-sm text-brand-navy">
            Percakapan tidak tersedia saat ini.
          </p>
        ) : null}
        {state === "reported" ? (
          <p role="status" className="mt-3 rounded-xl bg-brand-surface px-4 py-3 text-sm text-brand-navy">
            Laporan diterima. Terima kasih sudah membantu menjaga ruang aman.
          </p>
        ) : null}
      </header>

      <div
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
          <p className="rounded-[18px] border border-dashed border-brand-border bg-white px-4 py-5 text-sm leading-6 text-brand-muted">
            Perkenalan sudah diterima. Mulai percakapan dengan santai dan tetap
            jaga privasi.
          </p>
        ) : null}

        {chronological.map((message, index) => {
          const previous = chronological[index - 1];
          const showDay =
            !previous ||
            formatDay(previous.created_at) !== formatDay(message.created_at);

          return (
            <div key={message.message_id}>
              {showDay ? (
                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-brand-muted">
                  {formatDay(message.created_at)}
                </p>
              ) : null}
              <div
                className={`flex ${message.is_mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[min(100%,28rem)] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.is_mine
                      ? "bg-brand-blue text-white"
                      : "border border-brand-border bg-white text-brand-navy"
                  }`}
                >
                  <p className="sr-only">
                    {message.is_mine
                      ? "Pesan dari kamu"
                      : `Pesan dari ${conversation.counterpart_alias}`}
                  </p>
                  <p className="whitespace-pre-wrap break-words">
                    {message.moderation_status === "removed"
                      ? "Pesan tidak tersedia."
                      : message.body}
                  </p>
                  <p
                    className={`mt-2 text-[11px] ${
                      message.is_mine ? "text-white/75" : "text-brand-muted"
                    }`}
                  >
                    {formatTime(message.created_at)}
                    {message.is_mine
                      ? message.read_at
                        ? " · Dibaca"
                        : " · Terkirim"
                      : null}
                  </p>
                </div>
              </div>
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
                      setContactReveal(payload.contactReveal as ContactRevealState);
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
            <input type="hidden" name="publicId" value={conversation.public_id} />
            <input type="hidden" name="idempotencyKey" defaultValue="" />
            <label htmlFor="chat-body" className="text-sm font-semibold text-brand-navy">
              Tulis pesan
            </label>
            <textarea
              id="chat-body"
              name="body"
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={onKeyDown}
              maxLength={CHAT_MESSAGE_MAX}
              disabled={pending}
              aria-invalid={clientError ? true : undefined}
              aria-describedby={[counterId, counterStatusId, clientError ? errorId : null]
                .filter(Boolean)
                .join(" ")}
              className="focus-ring w-full resize-y rounded-xl border border-brand-border bg-brand-surface px-3 py-3 text-sm leading-6 text-brand-navy"
              placeholder="Bagikan pesan singkat tanpa membagikan kontak."
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span id={counterId} className="text-xs text-brand-muted">
                {body.trim().length} dari {CHAT_MESSAGE_MAX} karakter
              </span>
              <span
                id={counterStatusId}
                className="sr-only"
                aria-live="polite"
              >
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
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
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
              <p className="text-xs leading-5 text-brand-muted">{CHAT_CONTACT_MESSAGE}</p>
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
                <input type="hidden" name="publicId" value={conversation.public_id} />
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
              <input type="hidden" name="publicId" value={conversation.public_id} />
              <div>
                <label htmlFor="chat-report-reason" className="text-sm font-medium">
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
                <label htmlFor="chat-report-details" className="text-sm font-medium">
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
          <p id={endDescriptionId} className="text-sm leading-6 text-brand-muted">
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
