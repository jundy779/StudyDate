"use client";

import { submitIntroduction } from "@/app/app/introductions/actions";
import {
  CONTACT_DISCLOSURE_MESSAGE,
  INTRODUCTION_MESSAGE_MAX,
  INTRODUCTION_MESSAGE_MIN,
} from "@/lib/introductions/constants";
import { LoaderCircle, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";

type SendIntroductionDialogProps = {
  alias: string;
  disabledReason?: string | null;
  canSend: boolean;
};

export function SendIntroductionDialog({
  alias,
  disabledReason,
  canSend,
}: SendIntroductionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const counterId = useId();
  const hintId = useId();
  const textareaId = useId();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (open) return;
    // Restore focus only after the dialog has been opened at least once.
    const trigger = triggerRef.current;
    if (!trigger || !trigger.dataset.wasOpened) return;
    trigger.focus();
  }, [open]);

  function closeDialog() {
    if (pending) return;
    setOpen(false);
    setClientError(null);
  }

  function openDialog() {
    if (triggerRef.current) {
      triggerRef.current.dataset.wasOpened = "true";
    }
    setOpen(true);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim().replace(/\s+/g, " ");
    if (trimmed.length < INTRODUCTION_MESSAGE_MIN) {
      setClientError(`Tulis minimal ${INTRODUCTION_MESSAGE_MIN} karakter.`);
      return;
    }
    if (trimmed.length > INTRODUCTION_MESSAGE_MAX) {
      setClientError(`Maksimal ${INTRODUCTION_MESSAGE_MAX} karakter.`);
      return;
    }

    setClientError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      void submitIntroduction(formData);
    });
  }

  if (!canSend) {
    return (
      <p className="max-w-md text-sm leading-6 text-white/70">
        {disabledReason ??
          "Perkenalan belum dapat dikirim untuk profil ini saat ini."}
      </p>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-navy transition hover:bg-blue-50"
        onClick={openDialog}
      >
        Kirim perkenalan
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-[min(100%,28rem)] max-h-[min(90vh,40rem)] overflow-y-auto rounded-[22px] border border-brand-border bg-white p-0 text-brand-navy shadow-[0_24px_60px_rgba(15,27,51,0.18)] open:flex open:flex-col backdrop:bg-brand-navy/45"
        onClose={closeDialog}
        onCancel={(event) => {
          if (pending) {
            event.preventDefault();
            return;
          }
          closeDialog();
        }}
      >
        <form onSubmit={onSubmit} className="flex flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-brand-border px-5 py-4">
            <div>
              <h2 id={titleId} className="font-heading text-xl font-semibold">
                Kirim perkenalan
              </h2>
              <p id={descriptionId} className="mt-1 text-sm leading-6 text-brand-muted">
                Ceritakan sedikit alasan kamu ingin berkenalan. Nama lengkap dan
                kontak tetap tertutup.
              </p>
            </div>
            <button
              type="button"
              className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-full text-brand-muted hover:bg-brand-surface"
              aria-label="Tutup"
              onClick={closeDialog}
              disabled={pending}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-4 px-5 py-5">
            <input type="hidden" name="recipientAlias" value={alias} />
            <div>
              <label
                htmlFor={textareaId}
                className="text-sm font-semibold text-brand-navy"
              >
                Pesan pembuka
              </label>
              <textarea
                id={textareaId}
                name="openingMessage"
                rows={5}
                maxLength={INTRODUCTION_MESSAGE_MAX}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                aria-invalid={clientError ? true : undefined}
                aria-describedby={[hintId, counterId, clientError ? errorId : null]
                  .filter(Boolean)
                  .join(" ")}
                className="focus-ring mt-2 w-full resize-y rounded-xl border border-brand-border bg-brand-surface px-3 py-3 text-sm leading-6 text-brand-navy"
                placeholder="Contoh: Aku juga lagi eksplor minat desain dan ingin bertukar tip belajar."
                required
                disabled={pending}
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-brand-muted">
                <span id={hintId}>Tanpa HTML atau tautan. Teks biasa saja.</span>
                <span id={counterId} aria-live="polite">
                  {message.trim().length} dari {INTRODUCTION_MESSAGE_MAX} karakter
                </span>
              </div>
              {clientError ? (
                <p id={errorId} role="alert" className="mt-2 text-sm text-red-700">
                  {clientError}
                </p>
              ) : (
                <p className="mt-2 text-sm leading-6 text-brand-muted">
                  {CONTACT_DISCLOSURE_MESSAGE}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-brand-border px-5 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-brand-muted hover:bg-brand-surface"
              onClick={closeDialog}
              disabled={pending}
            >
              Batal
            </button>
            <button
              type="submit"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white disabled:opacity-70"
              disabled={pending}
            >
              {pending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Mengirim…
                </>
              ) : (
                "Kirim perkenalan"
              )}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
