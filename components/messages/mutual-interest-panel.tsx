"use client";

import {
  selectMutualInterestAction,
  withdrawMutualInterestAction,
} from "@/app/app/messages/actions";
import {
  MUTUAL_INTEREST_COPY,
  type MutualInterestState,
} from "@/lib/mutual-interest/constants";
import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

type MutualInterestPanelProps = {
  publicId: string;
  conversationStatus: "awaiting_chat" | "active" | "ended" | "blocked";
  state: MutualInterestState;
  onStateChange: (next: MutualInterestState) => void;
};

export function MutualInterestPanel({
  publicId,
  conversationStatus,
  state,
  onStateChange,
}: MutualInterestPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const closed =
    conversationStatus === "ended" || conversationStatus === "blocked";

  function onSelect() {
    setError(null);
    const formData = new FormData();
    formData.set("publicId", publicId);
    startTransition(async () => {
      try {
        const next = await selectMutualInterestAction(formData);
        onStateChange(next);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : MUTUAL_INTEREST_COPY.genericError,
        );
      }
    });
  }

  function onWithdraw() {
    setError(null);
    const formData = new FormData();
    formData.set("publicId", publicId);
    startTransition(async () => {
      try {
        const next = await withdrawMutualInterestAction(formData);
        onStateChange(next);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : MUTUAL_INTEREST_COPY.genericError,
        );
      }
    });
  }

  if (closed && !state.mutual) {
    return null;
  }

  return (
    <section
      aria-label="Kenal lebih jauh"
      className="rounded-[18px] border border-brand-border bg-brand-surface px-4 py-4"
    >
      {state.mutual ? (
        <div className="space-y-2">
          <h2 className="font-heading text-base font-semibold text-brand-navy">
            {MUTUAL_INTEREST_COPY.mutualTitle}
          </h2>
          <p className="text-sm leading-6 text-brand-muted">
            {MUTUAL_INTEREST_COPY.mutualBody}
          </p>
          <p className="text-sm font-medium text-brand-navy">
            Kalian sama-sama ingin kenal lebih jauh
          </p>
        </div>
      ) : state.selectedByMe ? (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-brand-navy">
            {MUTUAL_INTEREST_COPY.selectedNote}
          </p>
          <p className="text-xs leading-5 text-brand-muted">
            {MUTUAL_INTEREST_COPY.privacyNote}
          </p>
          {state.canWithdraw ? (
            <button
              type="button"
              disabled={pending}
              onClick={onWithdraw}
              className="focus-ring inline-flex min-h-11 items-center rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy disabled:opacity-60"
            >
              {pending ? (
                <>
                  <LoaderCircle
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Menyimpan…
                </>
              ) : (
                MUTUAL_INTEREST_COPY.withdrawCta
              )}
            </button>
          ) : null}
        </div>
      ) : state.eligible ? (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-brand-navy">
            Jika kamu merasa nyaman, kamu bisa memilih untuk kenal lebih jauh.
            Pilihan ini tidak akan terlihat oleh lawan bicara sampai keduanya
            memilih.
          </p>
          <p className="text-xs leading-5 text-brand-muted">
            {MUTUAL_INTEREST_COPY.privacyNote}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={onSelect}
            className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? (
              <>
                <LoaderCircle
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Menyimpan…
              </>
            ) : (
              MUTUAL_INTEREST_COPY.selectCta
            )}
          </button>
        </div>
      ) : conversationStatus === "active" ||
        conversationStatus === "awaiting_chat" ? (
        <p className="text-sm leading-6 text-brand-muted">
          {MUTUAL_INTEREST_COPY.notReadyNote}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {pending ? (
        <p className="sr-only" role="status">
          {MUTUAL_INTEREST_COPY.loading}
        </p>
      ) : null}
    </section>
  );
}
