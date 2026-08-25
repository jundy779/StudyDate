import type { ChatMessage } from "@/lib/messages/service";
import { getChatStickerById } from "@/lib/messages/stickers";
import Image from "next/image";

type ChatMessageBubbleProps = {
  message: ChatMessage;
  counterpartAlias: string;
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
}: ChatMessageBubbleProps) {
  const sticker =
    message.moderation_status === "visible" && message.message_type === "sticker"
      ? getChatStickerById(message.sticker_id)
      : null;
  const rendersSticker = Boolean(sticker);

  return (
    <div className={`flex ${message.is_mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[min(100%,28rem)] rounded-2xl text-sm leading-6 ${
          rendersSticker
            ? "px-2 py-2"
            : message.is_mine
              ? "bg-brand-blue px-4 py-3 text-white"
              : "border border-brand-border bg-white px-4 py-3 text-brand-navy"
        }`}
      >
        <p className="sr-only">
          {message.is_mine ? "Pesan dari kamu" : `Pesan dari ${counterpartAlias}`}
        </p>

        {message.moderation_status === "removed" ? (
          <p className="whitespace-pre-wrap break-words">Pesan tidak tersedia.</p>
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
            rendersSticker
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
    </div>
  );
}
