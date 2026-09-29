"use client";

import { unlinkTelegramFromSettingsAction } from "@/app/app/settings/actions";
import type { TelegramSafeState } from "@/lib/telegram/constants";
import { useId, useRef, useState, useTransition } from "react";

export function TelegramCompanionSetting({
  initialState,
}: {
  initialState: TelegramSafeState;
}) {
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div className="border-t border-brand-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-heading text-lg font-semibold text-brand-navy">
            Lanjut lewat Telegram
          </h3>
          <p className="mt-1 text-sm leading-6 text-brand-muted">
            {state.connected
              ? "Telegram terhubung. Detail akun Telegram tidak ditampilkan."
              : "Telegram belum terhubung. Kamu dapat menghubungkannya dari percakapan yang memenuhi syarat."}
          </p>
        </div>
        {state.connected ? (
          <button
            ref={triggerRef}
            type="button"
            disabled={pending}
            onClick={() => dialogRef.current?.showModal()}
            className="focus-ring min-h-11 rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy disabled:opacity-60"
          >
            Putuskan
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => triggerRef.current?.focus()}
        className="max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-md rounded-[22px] border border-brand-border bg-white p-5 text-brand-navy shadow-[0_24px_60px_rgba(15,27,51,0.18)] backdrop:bg-brand-navy/45"
      >
        <h4 id={titleId} className="font-heading text-xl font-semibold">
          Putuskan koneksi Telegram?
        </h4>
        <p id={descriptionId} className="mt-3 text-sm leading-6 text-brand-muted">
          Pesan baru tidak lagi diteruskan lewat Telegram. Riwayat percakapan
          dan kontak yang sudah dibagikan tetap tersimpan.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="focus-ring min-h-11 px-4 text-sm font-semibold text-brand-muted"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              dialogRef.current?.close();
              setError(null);
              startTransition(() => {
                void unlinkTelegramFromSettingsAction()
                  .then(setState)
                  .catch(() =>
                    setError("Koneksi Telegram belum dapat diputus."),
                  );
              });
            }}
            className="focus-ring min-h-11 rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            Putuskan
          </button>
        </div>
      </dialog>
    </div>
  );
}
