import { submitChatSticker } from "@/app/app/messages/actions";
import {
  CHAT_EMOJI_SHORTLIST,
  CHAT_STICKERS,
} from "@/lib/messages/stickers";
import Image from "next/image";

type ChatComposerToolsProps = {
  disabled?: boolean;
  onInsertEmoji: (emoji: string) => void;
};

export function ChatComposerTools({
  disabled = false,
  onInsertEmoji,
}: ChatComposerToolsProps) {
  return (
    <div className="flex items-center gap-2">
      <details className="relative">
        <summary className="focus-ring flex min-h-10 cursor-pointer list-none items-center rounded-xl border border-brand-border bg-white px-3 text-sm font-semibold text-brand-navy [&::-webkit-details-marker]:hidden">
          Emoji
        </summary>
        <div className="absolute bottom-12 right-0 z-30 grid w-64 grid-cols-6 gap-1 rounded-2xl border border-brand-border bg-white p-2 shadow-[0_16px_40px_rgba(15,27,51,0.16)]">
          {CHAT_EMOJI_SHORTLIST.map((emoji) => (
            <button
              key={emoji}
              type="button"
              disabled={disabled}
              onClick={() => onInsertEmoji(emoji)}
              className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg text-xl hover:bg-brand-surface disabled:opacity-50"
              aria-label={`Tambahkan emoji ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </details>

      <details className="relative">
        <summary className="focus-ring flex min-h-10 cursor-pointer list-none items-center rounded-xl border border-brand-border bg-white px-3 text-sm font-semibold text-brand-navy [&::-webkit-details-marker]:hidden">
          Stiker
        </summary>
        <div className="absolute bottom-12 right-0 z-30 w-72 rounded-2xl border border-brand-border bg-white p-3 shadow-[0_16px_40px_rgba(15,27,51,0.16)]">
          <p className="mb-2 text-xs leading-5 text-brand-muted">
            Stiker resmi StudyDate. Tidak membuka identitas atau kontak.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CHAT_STICKERS.map((sticker) => (
              <button
                key={sticker.id}
                type="submit"
                name="stickerId"
                value={sticker.id}
                formAction={submitChatSticker}
                formNoValidate
                disabled={disabled}
                aria-label={`Kirim stiker ${sticker.label}`}
                className="focus-ring flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-brand-border bg-brand-surface/50 p-2 text-xs font-semibold text-brand-navy hover:bg-brand-surface disabled:opacity-50"
              >
                <Image
                  src={sticker.src}
                  alt=""
                  width={96}
                  height={96}
                  className="h-20 w-20 object-contain"
                />
                <span className="mt-1">{sticker.label}</span>
              </button>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
