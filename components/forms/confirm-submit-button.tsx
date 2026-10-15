"use client";

import { useId, useRef } from "react";

type ConfirmSubmitButtonProps = {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  className?: string;
  name?: string;
  value?: string;
};

export function ConfirmSubmitButton({
  triggerLabel,
  title,
  description,
  confirmLabel,
  className,
  name,
  value,
}: ConfirmSubmitButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  function openDialog() {
    dialogRef.current?.showModal();
    requestAnimationFrame(() => cancelRef.current?.focus());
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button type="button" onClick={openDialog} className={className}>
        {triggerLabel}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={closeDialog}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[22px] border border-brand-border bg-white p-0 text-brand-navy shadow-2xl backdrop:bg-brand-navy/45"
      >
        <div className="p-6 sm:p-7">
          <h2 id={titleId} className="font-heading text-2xl font-semibold">
            {title}
          </h2>
          <p id={descriptionId} className="mt-3 text-sm leading-6 text-brand-muted">
            {description}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={closeDialog}
              className="focus-ring min-h-11 rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy"
            >
              Kembali
            </button>
            <button
              type="submit"
              name={name}
              value={value}
              className="focus-ring min-h-11 rounded-xl bg-brand-error px-4 text-sm font-semibold text-white"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
