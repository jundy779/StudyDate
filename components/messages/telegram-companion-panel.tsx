"use client";

import {
  cancelTelegramLinkAction,
  confirmTelegramBindingAction,
  createTelegramLinkAction,
  switchTelegramRelayAction,
  unlinkTelegramCompanionAction,
} from "@/app/app/messages/telegram-actions";
import type { TelegramSafeState } from "@/lib/telegram/constants";
import { useId, useRef, useState, useTransition } from "react";

type TelegramCompanionPanelProps = {
  publicId: string;
  initialState: TelegramSafeState;
};

export function TelegramCompanionPanel({
  publicId,
  initialState,
}: TelegramCompanionPanelProps) {
  const [state, setState] = useState(initialState);
  const [botUrl, setBotUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const switchDialogRef = useRef<HTMLDialogElement>(null);
  const unlinkDialogRef = useRef<HTMLDialogElement>(null);
  const switchTriggerRef = useRef<HTMLButtonElement>(null);
  const unlinkTriggerRef = useRef<HTMLButtonElement>(null);
  const switchTitleId = useId();
  const switchDescriptionId = useId();
  const unlinkTitleId = useId();
  const unlinkDescriptionId = useId();

  function run(operation: () => Promise<TelegramSafeState>) {
    setError(null);
    startTransition(() => {
      void operation()
        .then((next) => {
          setState(next);
          setBotUrl(null);
        })
        .catch(() =>
          setError("Telegram Companion belum dapat diperbarui."),
        );
    });
  }

  if (state.state === "unavailable") {
    return (
      <section
        aria-labelledby="telegram-companion-title"
        className="border-t border-brand-border pt-5"
      >
        <h3
          id="telegram-companion-title"
          className="font-heading text-lg font-semibold text-brand-navy"
        >
          Telegram Companion
        </h3>
        <p className="mt-2 text-sm leading-6 text-brand-muted">
          Telegram Companion belum dapat digunakan.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="telegram-companion-title"
      className="border-t border-brand-border pt-5"
    >
      <h3
        id="telegram-companion-title"
        className="font-heading text-lg font-semibold text-brand-navy"
      >
        Telegram Companion
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
        Opsional. Pesan teks dari bot masuk ke Anonymous Chat yang sama.
        Detail akun Telegram tetap tersembunyi dari counterpart, tetapi pesan
        yang dikirim melalui Telegram juga diproses oleh Telegram. Koneksi ini
        terpisah dari Contact Reveal.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {state.state === "not_connected" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(() => {
                void createTelegramLinkAction(publicId)
                  .then((result) => {
                    setState(result.state);
                    setBotUrl(result.botUrl);
                  })
                  .catch(() =>
                    setError("Tautan Telegram belum dapat dibuat."),
                  );
              });
            }}
            className="focus-ring min-h-11 rounded-xl border border-brand-blue bg-white px-4 text-sm font-semibold text-brand-blue disabled:opacity-60"
          >
            {pending ? "Menyiapkan…" : "Lanjut di Telegram"}
          </button>
        ) : null}

        {state.state === "link_created" ? (
          <>
            {botUrl ? (
              <a
                href={botUrl}
                target="_blank"
                rel="noreferrer"
                className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white"
              >
                Buka StudyDateBot
              </a>
            ) : (
              <span className="text-sm font-semibold text-brand-navy">
                Menunggu konfirmasi dari Telegram
              </span>
            )}
            {state.linkSessionPublicId ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    cancelTelegramLinkAction(
                      publicId,
                      state.linkSessionPublicId!,
                    ),
                  )
                }
                className="focus-ring min-h-11 px-3 text-sm font-semibold text-brand-muted"
              >
                Batalkan
              </button>
            ) : null}
          </>
        ) : null}

        {state.state === "telegram_pending" &&
        state.linkSessionPublicId ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  confirmTelegramBindingAction(
                    publicId,
                    state.linkSessionPublicId!,
                    false,
                  ),
                )
              }
              className="focus-ring min-h-11 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              Konfirmasi Telegram
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  cancelTelegramLinkAction(
                    publicId,
                    state.linkSessionPublicId!,
                  ),
                )
              }
              className="focus-ring min-h-11 px-3 text-sm font-semibold text-brand-muted"
            >
              Batalkan
            </button>
          </>
        ) : null}

        {state.state === "connected" ? (
          <>
            <span role="status" className="text-sm font-semibold text-brand-navy">
              Telegram terhubung
            </span>
            <button
              ref={unlinkTriggerRef}
              type="button"
              onClick={() => unlinkDialogRef.current?.showModal()}
              className="focus-ring min-h-11 px-3 text-sm font-semibold text-brand-muted"
            >
              Putuskan
            </button>
          </>
        ) : null}

        {state.state === "switch_required" ? (
          <>
            <span className="text-sm font-semibold text-brand-navy">
              Telegram terhubung ke percakapan lain
            </span>
            <button
              ref={switchTriggerRef}
              type="button"
              onClick={() => switchDialogRef.current?.showModal()}
              className="focus-ring min-h-11 rounded-xl border border-brand-blue px-4 text-sm font-semibold text-brand-blue"
            >
              Hubungkan ke percakapan ini
            </button>
          </>
        ) : null}
      </div>

      <p className="mt-3 text-xs leading-5 text-brand-muted">
        Satu akun hanya dapat memiliki satu percakapan Telegram aktif pada v1.
        Memutuskan Telegram tidak menghapus riwayat StudyDate.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <dialog
        ref={switchDialogRef}
        aria-labelledby={switchTitleId}
        aria-describedby={switchDescriptionId}
        onClose={() => switchTriggerRef.current?.focus()}
        className="max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-md rounded-[22px] border border-brand-border bg-white p-5 text-brand-navy shadow-[0_24px_60px_rgba(15,27,51,0.18)] backdrop:bg-brand-navy/45"
      >
        <h4 id={switchTitleId} className="font-heading text-xl font-semibold">
          Hubungkan ke percakapan ini?
        </h4>
        <p id={switchDescriptionId} className="mt-3 text-sm leading-6 text-brand-muted">
          Telegram saat ini terhubung ke percakapan lain. Percakapan lama
          tetap tersedia di web dan counterpart tidak menerima pemberitahuan.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => switchDialogRef.current?.close()}
            className="focus-ring min-h-11 px-4 text-sm font-semibold text-brand-muted"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              switchDialogRef.current?.close();
              run(() =>
                state.linkSessionPublicId
                  ? confirmTelegramBindingAction(
                      publicId,
                      state.linkSessionPublicId,
                      true,
                    )
                  : switchTelegramRelayAction(publicId),
              );
            }}
            className="focus-ring min-h-11 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white"
          >
            Hubungkan
          </button>
        </div>
      </dialog>

      <dialog
        ref={unlinkDialogRef}
        aria-labelledby={unlinkTitleId}
        aria-describedby={unlinkDescriptionId}
        onClose={() => unlinkTriggerRef.current?.focus()}
        className="max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-md rounded-[22px] border border-brand-border bg-white p-5 text-brand-navy shadow-[0_24px_60px_rgba(15,27,51,0.18)] backdrop:bg-brand-navy/45"
      >
        <h4 id={unlinkTitleId} className="font-heading text-xl font-semibold">
          Putuskan Telegram Companion?
        </h4>
        <p id={unlinkDescriptionId} className="mt-3 text-sm leading-6 text-brand-muted">
          Pesan Telegram baru akan berhenti. Riwayat Anonymous Chat dan Contact
          Reveal tidak berubah.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => unlinkDialogRef.current?.close()}
            className="focus-ring min-h-11 px-4 text-sm font-semibold text-brand-muted"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              unlinkDialogRef.current?.close();
              run(() => unlinkTelegramCompanionAction(publicId));
            }}
            className="focus-ring min-h-11 rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white"
          >
            Putuskan
          </button>
        </div>
      </dialog>
    </section>
  );
}
