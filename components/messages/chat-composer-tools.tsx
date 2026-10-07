import { submitChatSticker } from "@/app/app/messages/actions";
import { CHAT_EMOJI_SHORTLIST, CHAT_STICKERS } from "@/lib/messages/stickers";
import {
  CHAT_SHARE_KIND_LABELS,
  getChatShareMetaLabel,
  type ChatShareableItem,
} from "@/lib/messages/shares";
import { CalendarDays, UsersRound } from "lucide-react";
import Image from "next/image";

type ChatComposerToolsProps = {
  disabled?: boolean;
  sharingEnabled?: boolean;
  shareables?: ChatShareableItem[];
  onInsertEmoji: (emoji: string) => void;
};

export function ChatComposerTools({
  disabled = false,
  sharingEnabled = false,
  shareables = [],
  onInsertEmoji,
}: ChatComposerToolsProps) {
  const circles = shareables.filter((item) => item.share_kind === "circle");
  const events = shareables.filter((item) => item.share_kind === "event");

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
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

      {sharingEnabled ? (
        <details className="relative">
          <summary className="focus-ring flex min-h-10 cursor-pointer list-none items-center rounded-xl border border-brand-border bg-white px-3 text-sm font-semibold text-brand-navy [&::-webkit-details-marker]:hidden">
            Ajak
          </summary>
          <div className="absolute bottom-12 right-0 z-30 max-h-80 w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-brand-border bg-white p-3 shadow-[0_16px_40px_rgba(15,27,51,0.16)]">
            <p className="text-sm font-semibold text-brand-navy">
              Ajak ke Circle atau acara
            </p>
            <p className="mt-1 text-xs leading-5 text-brand-muted">
              Temanmu tetap memilih sendiri mau ikut atau tidak.
            </p>
            {shareables.length === 0 ? (
              <p className="mt-3 rounded-xl bg-brand-surface px-3 py-3 text-xs leading-5 text-brand-muted">
                Gabung Circle atau daftar acara dulu agar bisa mengajak teman.
              </p>
            ) : (
              <div className="mt-3 space-y-4">
                {circles.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-brand-muted">
                      Circle kamu
                    </p>
                    <div className="space-y-2">
                      {circles.map((item) => (
                        <button
                          key={item.public_slug}
                          type="submit"
                          name="shareToken"
                          value={`${item.share_kind}:${item.public_slug}`}
                          disabled={disabled}
                          className="focus-ring flex w-full items-start gap-3 rounded-xl border border-brand-border p-3 text-left hover:border-brand-blue disabled:opacity-50"
                        >
                          <UsersRound
                            className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue"
                            aria-hidden="true"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-brand-navy">
                              {item.title}
                            </span>
                            <span className="block truncate text-xs text-brand-muted">
                              {getChatShareMetaLabel(item)}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {events.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-brand-muted">
                      Acara yang kamu ikuti
                    </p>
                    <div className="space-y-2">
                      {events.map((item) => (
                        <button
                          key={item.public_slug}
                          type="submit"
                          name="shareToken"
                          value={`${item.share_kind}:${item.public_slug}`}
                          disabled={disabled}
                          className="focus-ring flex w-full items-start gap-3 rounded-xl border border-brand-border p-3 text-left hover:border-brand-blue disabled:opacity-50"
                        >
                          <CalendarDays
                            className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue"
                            aria-hidden="true"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-brand-navy">
                              {item.title}
                            </span>
                            <span className="block truncate text-xs text-brand-muted">
                              {CHAT_SHARE_KIND_LABELS.event} · {item.meta}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </details>
      ) : null}
    </div>
  );
}
