"use client";

import {
  CHAT_REACTIONS,
  getChatReaction,
  type ChatReactionValue,
} from "@/lib/messages/reactions";
import type { ChatMessage } from "@/lib/messages/service";
import { ChatSharedItemCard } from "@/components/messages/chat-shared-item-card";
import { getChatStickerById } from "@/lib/messages/stickers";
import { Reply, SmilePlus } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

type ChatMessageBubbleProps = {
  message: ChatMessage;
  counterpartAlias: string;
  interactionsEnabled: boolean;
  reactionPending?: boolean;
  onReply: (message: ChatMessage) => void;
  onReact: (messageId: string, reaction: ChatReactionValue) => void;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ChatMessageBubble({
  message,
  counterpartAlias,
  interactionsEnabled,
  reactionPending = false,
  onReply,
  onReact,
}: ChatMessageBubbleProps) {
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
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

  return (
    <div
      className={`flex flex-col ${
        message.is_mine ? "items-end" : "items-start"
      }`}
    >
      <div
        className={`max-w-[min(100%,28rem)] rounded-2xl text-sm leading-6 ${
          rendersSticker
            ? "px-2 py-2"
            : rendersShare
              ? "border border-brand-border bg-white p-1.5 text-brand-navy shadow-sm"
              : message.is_mine
                ? "bg-brand-blue px-4 py-3 text-white"
                : "border border-brand-border bg-white px-4 py-3 text-brand-navy"
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
                message.reply_body ??
                "Pesan tidak tersedia."}
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
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
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

      {canInteract ? (
        <div
          className={`mt-1 flex max-w-full flex-wrap items-center gap-1 ${
            message.is_mine ? "justify-end" : "justify-start"
          }`}
        >
          <button
            type="button"
            onClick={() => onReply(message)}
            className="focus-ring inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-brand-muted hover:bg-white hover:text-brand-blue"
          >
            <Reply className="h-3.5 w-3.5" aria-hidden="true" />
            Balas
          </button>
          <div className="relative">
            <button
              type="button"
              disabled={reactionPending}
              onClick={() => setReactionPickerOpen((open) => !open)}
              aria-expanded={reactionPickerOpen}
              className="focus-ring inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-brand-muted hover:bg-white hover:text-brand-blue disabled:opacity-60"
            >
              <SmilePlus className="h-3.5 w-3.5" aria-hidden="true" />
              Reaksi
            </button>
            {reactionPickerOpen ? (
              <div
                className={`absolute bottom-9 z-30 flex gap-1 rounded-xl border border-brand-border bg-white p-1.5 shadow-lg ${
                  message.is_mine ? "right-0" : "left-0"
                }`}
                role="group"
                aria-label="Pilih reaksi"
              >
                {CHAT_REACTIONS.map((reaction) => (
                  <button
                    key={reaction.value}
                    type="button"
                    disabled={reactionPending}
                    onClick={() => {
                      setReactionPickerOpen(false);
                      onReact(message.message_id, reaction.value);
                    }}
                    aria-label={reaction.label}
                    className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-brand-surface disabled:opacity-60"
                  >
                    <span aria-hidden="true">{reaction.emoji}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
