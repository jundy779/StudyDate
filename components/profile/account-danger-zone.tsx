"use client";

import {
  deactivateStudentAccountAction,
  permanentlyDeleteStudentAccountAction,
} from "@/app/app/profile/account-actions";
import { PERMANENT_DELETE_CONFIRMATION } from "@/lib/account/lifecycle-constants";
import { TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";

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

  function onDeactivate() {
    setError("");
    startTransition(async () => {
      const result = await deactivateStudentAccountAction();
      if (result && !result.ok) {
        setError(result.message);
      }
    });
  }

  function onPermanentDelete() {
    setError("");
    startTransition(async () => {
      const result = await permanentlyDeleteStudentAccountAction(confirmation);
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
            Zona Berbahaya
          </h2>
          <p className="mt-2 text-sm leading-6 text-brand-muted">
            Menghapus akun akan menghapus seluruh data secara permanen dan tidak
            dapat dipulihkan — termasuk profil, bukti verifikasi (jika ada),
            foto Identity Reveal milikmu, dan percakapan terkait.
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
            Hapus Akun Permanen
          </button>
        ) : (
          <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50/50 p-4 sm:p-5">
            <p className="text-sm font-semibold text-brand-navy">
              Ketik{" "}
              <span className="font-mono text-brand-error">
                {PERMANENT_DELETE_CONFIRMATION}
              </span>{" "}
              untuk mengonfirmasi
            </p>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-label={`Ketik ${PERMANENT_DELETE_CONFIRMATION} untuk konfirmasi`}
              className="focus-ring h-11 w-full rounded-xl border border-brand-border bg-white px-3 font-mono text-sm"
              placeholder={PERMANENT_DELETE_CONFIRMATION}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={
                  isPending ||
                  confirmation.trim() !== PERMANENT_DELETE_CONFIRMATION
                }
                onClick={onPermanentDelete}
                className="focus-ring min-h-12 rounded-xl bg-brand-error px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isPending ? "Menghapus…" : "Ya, hapus permanen"}
              </button>
              <button
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
