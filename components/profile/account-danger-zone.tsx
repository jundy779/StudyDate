"use client";

import {
  deactivateStudentAccountAction,
  requestStudentAccountDeletionAction,
} from "@/app/app/profile/account-actions";
import { ACCOUNT_DELETE_CONFIRMATION } from "@/lib/account/lifecycle-constants";
import { TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

type AccountDangerZoneProps = {
  /** When true, hide soft-deactivate (already on reactivate screen). */
  hideDeactivate?: boolean;
};

export function AccountDangerZone({
  hideDeactivate = false,
}: AccountDangerZoneProps) {
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDelete) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const trigger = deleteTriggerRef.current;
    cancelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        event.preventDefault();
        setShowDelete(false);
        setConfirmation("");
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      (previousFocus ?? trigger)?.focus();
    };
  }, [isPending, showDelete]);

  function onDeactivate() {
    setError("");
    startTransition(async () => {
      const result = await deactivateStudentAccountAction();
      if (result && !result.ok) {
        setError(result.message);
      }
    });
  }

  function onDeleteRequest() {
    setError("");
    startTransition(async () => {
      const result = await requestStudentAccountDeletionAction(confirmation);
      if (result && !result.ok) {
        setError(result.message);
      }
    });
  }

  return (
    <section
      aria-labelledby="danger-zone-heading"
      className="mt-8 rounded-[22px] border border-red-200 bg-white p-5 sm:mt-10 sm:p-6 lg:max-w-3xl"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-brand-error">
          <TriangleAlert className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2
            id="danger-zone-heading"
            className="font-heading text-xl font-semibold text-brand-error"
          >
            Status akun
          </h2>
          <p className="mt-2 text-sm leading-6 text-brand-muted">
            Kamu dapat berhenti sementara atau meminta penghapusan akun.
            Penghapusan final menunggu kebijakan retensi dan shared history yang
            sedang ditinjau Owner.
          </p>
        </div>
      </div>

      {!hideDeactivate ? (
        <div className="mt-6 rounded-2xl border border-brand-border bg-brand-surface/60 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-brand-navy">
            Nonaktifkan akun (sementara)
          </h3>
          <p className="mt-2 text-sm leading-6 text-brand-muted">
            Profil hilang dari People. Data tetap ada; kamu bisa aktifkan lagi
            kapan saja.
          </p>
          <button
            ref={deleteTriggerRef}
            type="button"
            disabled={isPending}
            onClick={onDeactivate}
            className="focus-ring mt-4 min-h-11 rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy disabled:opacity-60"
          >
            {isPending ? "Memproses…" : "Nonaktifkan akun"}
          </button>
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {!showDelete ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setShowDelete(true)}
            className="focus-ring flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-error px-5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
          >
            Minta penghapusan akun
          </button>
        ) : (
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-description"
            className="fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/50 p-3 sm:items-center sm:p-6"
          >
            <div className="max-h-[calc(100svh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-[20px] bg-white p-5 shadow-2xl sm:p-6">
            <h3 id="delete-account-title" className="font-heading text-xl font-semibold text-brand-navy">
              Minta penghapusan akun?
            </h3>
            <p id="delete-account-description" className="mt-2 text-sm leading-6 text-brand-muted">
              Setelah dikonfirmasi, profil langsung disembunyikan dan akses
              sosial dinonaktifkan. Permintaan bersifat idempotent. Cleanup
              final tidak dijalankan sampai kebijakan retensi, Reveal,
              Circle, Event, dan bukti moderasi disetujui.
            </p>
            <div className="mt-4 space-y-3 rounded-2xl border border-red-200 bg-red-50/50 p-4">
            <p className="text-sm font-semibold text-brand-navy">
              Ketik{" "}
              <span className="font-mono text-brand-error">
                {ACCOUNT_DELETE_CONFIRMATION}
              </span>{" "}
              untuk mengonfirmasi
            </p>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-label={`Ketik ${ACCOUNT_DELETE_CONFIRMATION} untuk konfirmasi`}
              className="focus-ring h-11 w-full rounded-xl border border-brand-border bg-white px-3 font-mono text-sm"
              placeholder={ACCOUNT_DELETE_CONFIRMATION}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={
                  isPending ||
                  confirmation.trim() !== ACCOUNT_DELETE_CONFIRMATION
                }
                onClick={onDeleteRequest}
                className="focus-ring min-h-12 rounded-xl bg-brand-error px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isPending ? "Memproses…" : "Kirim permintaan"}
              </button>
              <button
                ref={cancelRef}
                type="button"
                disabled={isPending}
                onClick={() => {
                  setShowDelete(false);
                  setConfirmation("");
                }}
                className="focus-ring min-h-12 rounded-xl border border-brand-border bg-white px-5 text-sm font-semibold text-brand-navy disabled:opacity-60"
              >
                Batal
              </button>
            </div>
            </div>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm font-semibold text-brand-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
