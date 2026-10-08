"use client";

import {
  CHAT_REACTIONS,
  getChatReaction,
  type ChatReactionValue,
} from "@/lib/messages/reactions";
import type { ChatMessage } from "@/lib/messages/service";
import { ChatSharedItemCard } from "@/components/messages/chat-shared-item-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { splitChatSearchText } from "@/lib/messages/search";
import { getChatStickerById } from "@/lib/messages/stickers";
import {
  Check,
  Copy,
  MoreHorizontal,
  Reply,
  SmilePlus,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type ChatMessageBubbleProps = {
  message: ChatMessage;
  counterpartAlias: string;
  interactionsEnabled: boolean;
  reactionPending?: boolean;
  searchQuery?: string;
  searchMatch?: boolean;
  activeSearchMatch?: boolean;
  onReply: (message: ChatMessage) => void;
  onReact: (messageId: string, reaction: ChatReactionValue) => void;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function HighlightedChatText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  return (
    <>
      {splitChatSearchText(text, query).map((part, index) =>
        part.matched ? (
          <mark
            key={`${index}-${part.text}`}
            className="rounded-sm bg-amber-200 px-0.5 text-brand-navy"
          >
            {part.text}
          </mark>
        ) : (
          <span key={`${index}-${part.text}`}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function ChatMessageBubble({
  message,
  counterpartAlias,
  interactionsEnabled,
  reactionPending = false,
  searchQuery = "",
  searchMatch = false,
  activeSearchMatch = false,
  onReply,
  onReact,
}: ChatMessageBubbleProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const copyResetTimerRef = useRef<number | undefined>(undefined);
  const sticker =
    message.moderation_status === "visible" &&
    message.message_type === "sticker"
      ? getChatStickerById(message.sticker_id)
      : null;
  const replySticker =
    message.reply_message_type === "sticker"
      ? getChatStickerById(message.reply_sticker_id)
      : null;
  const sharedItem =
    message.moderation_status === "visible" &&
    message.share_kind &&
    message.share_public_slug &&
    message.share_title &&
    message.share_description &&
    message.share_meta
      ? {
          share_kind: message.share_kind,
          share_public_slug: message.share_public_slug,
          share_title: message.share_title,
          share_description: message.share_description,
          share_meta: message.share_meta,
          share_starts_at: message.share_starts_at,
          share_timezone_name: message.share_timezone_name,
        }
      : null;
  const rendersSticker = Boolean(sticker);
  const rendersShare = Boolean(sharedItem);
  const canInteract =
    interactionsEnabled && message.moderation_status === "visible";
  const canCopy =
    message.moderation_status === "visible" &&
    message.message_type === "text" &&
    Boolean(message.body.trim());

  useEffect(() => {
    return () => window.clearTimeout(copyResetTimerRef.current);
  }, []);

  async function copyMessageBody() {
    if (!canCopy) return;
    window.clearTimeout(copyResetTimerRef.current);

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(message.body);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    copyResetTimerRef.current = window.setTimeout(
      () => setCopyState("idle"),
      1_800,
    );
  }

  return (
    <div
      className={`flex flex-col ${
        message.is_mine ? "items-end" : "items-start"
      }`}
    >
      <div
        aria-current={activeSearchMatch ? "true" : undefined}
        className={`max-w-[min(100%,28rem)] rounded-2xl text-sm leading-6 ${
          rendersSticker
            ? "px-2 py-2"
            : rendersShare
              ? "border border-brand-border bg-white p-1.5 text-brand-navy shadow-sm"
              : message.is_mine
                ? "bg-brand-blue px-4 py-3 text-white"
                : "border border-brand-border bg-white px-4 py-3 text-brand-navy"
        } ${
          activeSearchMatch
            ? "ring-2 ring-amber-400 ring-offset-2"
            : searchMatch
              ? "ring-2 ring-brand-blue/25 ring-offset-1"
              : ""
        }`}
      >
        <p className="sr-only">
          {message.is_mine
            ? "Pesan dari kamu"
            : `Pesan dari ${counterpartAlias}`}
        </p>

        {message.reply_message_id ? (
          <div
            className={`mb-2 max-w-full rounded-lg border-l-2 px-3 py-2 ${
              message.is_mine
                ? "border-white/70 bg-white/10"
                : "border-brand-blue bg-brand-surface"
            }`}
          >
            <p
              className={`text-[11px] font-semibold ${
                message.is_mine ? "text-white/80" : "text-brand-blue"
              }`}
            >
              Membalas {message.reply_is_mine ? "pesanmu" : counterpartAlias}
            </p>
            <p
              className={`line-clamp-2 break-words text-xs leading-5 ${
                message.is_mine ? "text-white/90" : "text-brand-muted"
              }`}
            >
              {replySticker?.alt ??
                (message.reply_body ? (
                  <HighlightedChatText
                    text={message.reply_body}
                    query={searchQuery}
                  />
                ) : (
                  "Pesan tidak tersedia."
                ))}
            </p>
          </div>
        ) : null}

        {message.moderation_status === "removed" ? (
          <p className="whitespace-pre-wrap break-words">
            Pesan tidak tersedia.
          </p>
        ) : sharedItem ? (
          <ChatSharedItemCard item={sharedItem} />
        ) : sticker ? (
          <div className="flex min-w-28 flex-col items-center">
            <Image
              src={sticker.src}
              alt={sticker.alt}
              width={160}
              height={160}
              className="h-32 w-32 object-contain sm:h-36 sm:w-36"
            />
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">
            <HighlightedChatText text={message.body} query={searchQuery} />
          </p>
        )}

        <p
          className={`mt-2 text-[11px] ${
            rendersSticker || rendersShare
              ? "text-center text-brand-muted"
              : message.is_mine
                ? "text-white/75"
                : "text-brand-muted"
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

      {message.reactions.length > 0 ? (
        <div
          className="mt-1 flex max-w-[min(100%,28rem)] flex-wrap gap-1"
          aria-label="Reaksi pada pesan"
        >
          {message.reactions.map((summary) => {
            const reaction = getChatReaction(summary.reaction);
            if (!reaction) return null;
            return (
              <button
                key={summary.reaction}
                type="button"
                disabled={!canInteract || reactionPending}
                onClick={() => onReact(message.message_id, summary.reaction)}
                aria-label={`${reaction.label}, ${summary.count} reaksi`}
                aria-pressed={summary.reacted_by_me}
                className={`focus-ring inline-flex min-h-8 items-center gap-1 rounded-full border px-2 text-xs disabled:opacity-60 ${
                  summary.reacted_by_me
                    ? "border-brand-blue bg-blue-50 text-brand-blue"
                    : "border-brand-border bg-white text-brand-navy"
                }`}
              >
                <span aria-hidden="true">{reaction.emoji}</span>
                {summary.count}
              </button>
            );
          })}
        </div>
      ) : null}

      {canInteract || canCopy ? (
        <>
          <div
            className={`mt-1 flex max-w-full ${
              message.is_mine ? "justify-end" : "justify-start"
            }`}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={
                    copyState === "copied"
                      ? "Pesan disalin, buka tindakan pesan"
                      : copyState === "error"
                        ? "Penyalinan gagal, buka tindakan pesan"
                        : "Buka tindakan pesan"
                  }
                  className={`focus-ring inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold hover:bg-white ${
                    copyState === "error"
                      ? "text-red-700"
                      : "text-brand-muted hover:text-brand-blue"
                  }`}
                >
                  {copyState === "copied" ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <MoreHorizontal
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                  )}
                  {copyState === "copied"
                    ? "Disalin"
                    : copyState === "error"
                      ? "Coba lagi"
                      : "Tindakan"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align={message.is_mine ? "end" : "start"}
                className="w-44 rounded-xl border-brand-border bg-white p-1.5 text-brand-navy"
              >
                {canInteract ? (
                  <DropdownMenuItem
                    onSelect={() => onReply(message)}
                    className="min-h-10 cursor-pointer rounded-lg px-3 text-sm focus:bg-brand-surface"
                  >
                    <Reply aria-hidden="true" />
                    Balas
                  </DropdownMenuItem>
                ) : null}
                {canCopy ? (
                  <DropdownMenuItem
                    onSelect={() => void copyMessageBody()}
                    className="min-h-10 cursor-pointer rounded-lg px-3 text-sm focus:bg-brand-surface"
                  >
                    <Copy aria-hidden="true" />
                    Salin pesan
                  </DropdownMenuItem>
                ) : null}
                {canInteract ? (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger
                      disabled={reactionPending}
                      className="min-h-10 cursor-pointer rounded-lg px-3 text-sm focus:bg-brand-surface data-[state=open]:bg-brand-surface"
                    >
                      <SmilePlus aria-hidden="true" />
                      Reaksi
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-40 rounded-xl border-brand-border bg-white p-1.5 text-brand-navy">
                      {CHAT_REACTIONS.map((reaction) => (
                        <DropdownMenuItem
                          key={reaction.value}
                          disabled={reactionPending}
                          onSelect={() =>
                            onReact(message.message_id, reaction.value)
                          }
                          className="min-h-10 cursor-pointer rounded-lg px-3 text-sm focus:bg-brand-surface"
                        >
                          <span aria-hidden="true">{reaction.emoji}</span>
                          {reaction.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="sr-only" aria-live="polite">
            {copyState === "copied"
              ? "Pesan berhasil disalin."
              : copyState === "error"
                ? "Pesan belum bisa disalin. Coba lagi."
                : ""}
          </p>
        </>
      ) : null}
    </div>
  );
}
