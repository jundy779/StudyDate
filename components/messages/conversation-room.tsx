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
import type { ChatMessage, ConversationDetail } from "@/lib/messages/service";
import type { MutualInterestState } from "@/lib/mutual-interest/constants";
import type {
  IdentityRevealCompleted,
  IdentityRevealProfilePreview,
  IdentityRevealState,
} from "@/lib/identity-reveal/constants";
import { MutualInterestPanel } from "@/components/messages/mutual-interest-panel";
import { IdentityRevealPanel } from "@/components/messages/identity-reveal-panel";
import { getMascotForAlias } from "@/lib/people/constants";
import { BadgeCheck, LoaderCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useId,
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
  notice,
  state,
}: ConversationRoomProps) {
  const [messages, setMessages] = useState(() =>
    [...initialMessages].reverse(),
  );
  const [status, setStatus] = useState(conversation.status);
  const [canSend, setCanSend] = useState(conversation.can_send);
  const [mutualInterest, setMutualInterest] = useState(initialMutualInterest);
  const [identityReveal, setIdentityReveal] = useState(initialIdentityReveal);
  const [identityRevealCompleted, setIdentityRevealCompleted] = useState(
    initialIdentityRevealCompleted,
  );
  const [body, setBody] = useState("");
  const [clientError, setClientError] = useState<string | null>(notice ?? null);
  const [pending, startTransition] = useTransition();
  const [pollNote, setPollNote] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const markedRead = useRef(false);
  const errorId = useId();
  const counterId = useId();
  const endDialogRef = useRef<HTMLDialogElement>(null);

  const chronological = useMemo(() => messages, [messages]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
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
    let failures = 0;

    async function poll() {
      try {
        const response = await fetch(
          `/api/messages/${conversation.public_id}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          failures += 1;
          if (!cancelled && failures >= 2) {
            setPollNote("Menyambungkan ulang…");
          }
          return;
        }
        failures = 0;
        if (!cancelled) setPollNote(null);
        const payload = (await response.json()) as {
          conversation: {
            status: ConversationDetail["status"];
            can_send: boolean;
          };
          mutualInterest?: MutualInterestState;
          identityReveal?: IdentityRevealState;
          identityRevealCompleted?: IdentityRevealCompleted | null;
          messages: ChatMessage[];
        };
        if (cancelled) return;
        setStatus(payload.conversation.status);
        setCanSend(payload.conversation.can_send);
        if (payload.mutualInterest) {
          setMutualInterest(payload.mutualInterest);
        }
        if (payload.identityReveal) {
          setIdentityReveal(payload.identityReveal);
        }
        if (payload.identityRevealCompleted?.completed) {
          setIdentityRevealCompleted(payload.identityRevealCompleted);
        }
        setMessages([...payload.messages].reverse());
      } catch {
        failures += 1;
        if (!cancelled && failures >= 2) {
          setPollNote("Menyambungkan ulang…");
        }
      }
    }

    const timer = window.setInterval(() => {
      void poll();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [conversation.public_id]);

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
      </div>

      <footer className="sticky bottom-0 border-t border-brand-border bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mb-4 space-y-4">
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
            state={identityReveal}
            initialPreview={initialIdentityRevealPreview}
            completedData={identityRevealCompleted}
            onStateChange={(next) => {
              setIdentityReveal(next);
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
                  })
                  .catch(() => undefined);
              }
            }}
          />
        </div>
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
              aria-describedby={[counterId, clientError ? errorId : null]
                .filter(Boolean)
                .join(" ")}
              className="focus-ring w-full resize-y rounded-xl border border-brand-border bg-brand-surface px-3 py-3 text-sm leading-6 text-brand-navy"
              placeholder="Bagikan pesan singkat tanpa membagikan kontak."
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span id={counterId} aria-live="polite" className="text-xs text-brand-muted">
                {body.trim().length} dari {CHAT_MESSAGE_MAX} karakter
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
                type="button"
                className="focus-ring inline-flex min-h-11 items-center rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy"
                onClick={() => endDialogRef.current?.showModal()}
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
        className="w-[min(100%,24rem)] rounded-[22px] border border-brand-border bg-white p-0 text-brand-navy shadow-[0_24px_60px_rgba(15,27,51,0.18)] backdrop:bg-brand-navy/45"
      >
        <form method="dialog" className="space-y-4 p-5">
          <h2 className="font-heading text-xl font-semibold">Akhiri percakapan?</h2>
          <p className="text-sm leading-6 text-brand-muted">
            Setelah diakhiri, pesan baru tidak dapat dikirim. Riwayat tetap
            tersedia untuk kalian berdua.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
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
