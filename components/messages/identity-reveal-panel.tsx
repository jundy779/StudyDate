"use client";

import {
  selectIdentityRevealAction,
  withdrawIdentityRevealAction,
} from "@/app/app/messages/actions";
import {
  IDENTITY_REVEAL_COPY,
  type IdentityRevealCompleted,
  type IdentityRevealProfilePreview,
  type IdentityRevealState,
} from "@/lib/identity-reveal/constants";
import {
  canShowCounterpartRevealMedia,
  isIdentityRevealPanelAvailable,
  normalizeIdentityRevealState,
} from "@/lib/identity-reveal/panel-visibility";
import { LoaderCircle } from "lucide-react";
import { useId, useState, useTransition, type FormEvent } from "react";

type IdentityRevealPanelProps = {
  publicId: string;
  conversationStatus: "awaiting_chat" | "active" | "ended" | "blocked";
  mutualCompleted: boolean;
  state: IdentityRevealState;
  initialPreview: IdentityRevealProfilePreview | null;
  completedData: IdentityRevealCompleted | null;
  onStateChange: (next: IdentityRevealState) => void;
};

export function IdentityRevealPanel({
  publicId,
  conversationStatus,
  mutualCompleted,
  state,
  initialPreview,
  completedData,
  onStateChange,
}: IdentityRevealPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState(initialPreview);
  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState(initialPreview?.firstName ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPending, setPhotoPending] = useState(false);
  const firstNameId = useId();
  const photoId = useId();
  const errorId = useId();

  const safeState = normalizeIdentityRevealState(state);

  const closed =
    conversationStatus === "ended" || conversationStatus === "blocked";

  if (
    !isIdentityRevealPanelAvailable({
      mutualCompleted,
      state: safeState,
    })
  ) {
    return null;
  }

  if (closed && !safeState.completed) {
    return null;
  }

  function onConsent() {
    if (!preview?.profileVersionId) return;
    setError(null);
    const formData = new FormData();
    formData.set("publicId", publicId);
    formData.set("profileVersionId", preview.profileVersionId);
    startTransition(async () => {
      try {
        const next = await selectIdentityRevealAction(formData);
        onStateChange(next);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : IDENTITY_REVEAL_COPY.genericError,
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
        const next = await withdrawIdentityRevealAction(formData);
        onStateChange(next);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : IDENTITY_REVEAL_COPY.genericError,
        );
      }
    });
  }

  async function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!photoFile && !preview?.photoReady) {
      setError(IDENTITY_REVEAL_COPY.photoError);
      return;
    }

    setPhotoPending(true);
    try {
      const formData = new FormData();
      formData.set("publicId", publicId);
      formData.set("firstName", firstName);
      if (photoFile) {
        formData.set("photo", photoFile);
      } else {
        setError(IDENTITY_REVEAL_COPY.photoError);
        setPhotoPending(false);
        return;
      }

      const response = await fetch("/api/identity-reveal/profile", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        profileVersionId?: string;
        firstName?: string;
        photoReady?: boolean;
      };

      if (!response.ok || !payload.profileVersionId || !payload.firstName) {
        setError(payload.error ?? IDENTITY_REVEAL_COPY.photoError);
        return;
      }

      setPreview({
        profileVersionId: payload.profileVersionId,
        firstName: payload.firstName,
        photoReady: Boolean(payload.photoReady),
        createdAt: new Date().toISOString(),
      });
      setShowForm(false);
      setPhotoFile(null);
      onStateChange({
        ...safeState,
        hasProfile: true,
        selectedByMe: false,
        canWithdraw: false,
      });
    } catch {
      setError(IDENTITY_REVEAL_COPY.photoError);
    } finally {
      setPhotoPending(false);
    }
  }

  if (safeState.completed && completedData?.completed) {
    const counterpartVisible = canShowCounterpartRevealMedia({
      completed: completedData.completed,
      counterpartFirstName: completedData.counterpartFirstName,
    });
    return (
      <section
        aria-label="Buka Identitas"
        className="rounded-[18px] border border-brand-border bg-brand-surface px-4 py-4"
      >
        <h2 className="font-heading text-base font-semibold text-brand-navy">
          {IDENTITY_REVEAL_COPY.completedTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-brand-muted">
          {counterpartVisible
            ? IDENTITY_REVEAL_COPY.completedBody
            : IDENTITY_REVEAL_COPY.completedBlockedBody}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <RevealedCard
            label={IDENTITY_REVEAL_COPY.mineLabel}
            firstName={completedData.mineFirstName ?? ""}
            photoSrc={`/api/identity-reveal/media?mode=completed&publicId=${encodeURIComponent(publicId)}&which=mine`}
          />
          {counterpartVisible ? (
            <RevealedCard
              label={IDENTITY_REVEAL_COPY.counterpartLabel}
              firstName={completedData.counterpartFirstName ?? ""}
              photoSrc={`/api/identity-reveal/media?mode=completed&publicId=${encodeURIComponent(publicId)}&which=counterpart`}
            />
          ) : (
            <div className="rounded-2xl border border-brand-border bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                {IDENTITY_REVEAL_COPY.counterpartLabel}
              </p>
              <p className="mt-3 text-sm text-brand-muted">
                {IDENTITY_REVEAL_COPY.counterpartUnavailable}
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Buka Identitas"
      className="rounded-[18px] border border-brand-border bg-brand-surface px-4 py-4"
    >
      <h2 className="font-heading text-base font-semibold text-brand-navy">
        {IDENTITY_REVEAL_COPY.heading}
      </h2>
      <p className="mt-2 text-sm leading-6 text-brand-muted">
        {IDENTITY_REVEAL_COPY.description}
      </p>
      <p className="mt-2 text-xs leading-5 text-brand-muted">
        {IDENTITY_REVEAL_COPY.privacyNote}
      </p>

      {safeState.selectedByMe ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-brand-navy">
            {IDENTITY_REVEAL_COPY.selectedNote}
          </p>
          {safeState.canWithdraw ? (
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
                IDENTITY_REVEAL_COPY.withdrawCta
              )}
            </button>
          ) : null}
        </div>
      ) : safeState.eligible ? (
        <div className="mt-4 space-y-4">
          {preview?.photoReady && !showForm ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 overflow-hidden rounded-full bg-brand-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/identity-reveal/media?mode=preview&publicId=${encodeURIComponent(publicId)}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-brand-navy">
                    {preview.firstName}
                  </p>
                  <button
                    type="button"
                    className="focus-ring mt-1 text-sm font-semibold text-brand-blue"
                    onClick={() => setShowForm(true)}
                  >
                    Ganti identitas
                  </button>
                </div>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={onConsent}
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
                  IDENTITY_REVEAL_COPY.consentCta
                )}
              </button>
            </div>
          ) : showForm || !preview ? (
            <form className="space-y-3" onSubmit={onSaveProfile}>
              <div>
                <label
                  htmlFor={firstNameId}
                  className="text-sm font-medium text-brand-navy"
                >
                  {IDENTITY_REVEAL_COPY.firstNameLabel}
                </label>
                <p className="mt-1 text-xs leading-5 text-brand-muted">
                  {IDENTITY_REVEAL_COPY.firstNameHint}
                </p>
                <input
                  id={firstNameId}
                  name="firstName"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  maxLength={40}
                  required
                  autoComplete="nickname"
                  className="focus-ring mt-2 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm"
                  aria-describedby={error ? errorId : undefined}
                />
              </div>
              <div>
                <label
                  htmlFor={photoId}
                  className="text-sm font-medium text-brand-navy"
                >
                  {IDENTITY_REVEAL_COPY.photoLabel}
                </label>
                <p className="mt-1 text-xs leading-5 text-brand-muted">
                  {IDENTITY_REVEAL_COPY.photoHint}
                </p>
                <input
                  id={photoId}
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required={!preview?.photoReady}
                  onChange={(event) =>
                    setPhotoFile(event.target.files?.[0] ?? null)
                  }
                  className="focus-ring mt-2 block w-full text-sm text-brand-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-blue file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={photoPending}
                  className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {photoPending ? (
                    <>
                      <LoaderCircle
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Menyimpan…
                    </>
                  ) : (
                    IDENTITY_REVEAL_COPY.saveProfileCta
                  )}
                </button>
                {preview ? (
                  <button
                    type="button"
                    className="focus-ring inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-brand-muted"
                    onClick={() => setShowForm(false)}
                  >
                    Batal
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white"
              onClick={() => setShowForm(true)}
            >
              {IDENTITY_REVEAL_COPY.prepareCta}
            </button>
          )}
        </div>
      ) : conversationStatus === "active" ? (
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          {IDENTITY_REVEAL_COPY.notReadyNote}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {pending || photoPending ? (
        <p className="sr-only" role="status">
          {IDENTITY_REVEAL_COPY.loading}
        </p>
      ) : null}
    </section>
  );
}

function RevealedCard({
  label,
  firstName,
  photoSrc,
}: {
  label: string;
  firstName: string;
  photoSrc: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-border bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
        {label}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div className="relative h-16 w-16 overflow-hidden rounded-full bg-brand-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoSrc} alt="" className="h-full w-full object-cover" />
        </div>
        <p className="font-heading text-lg font-semibold text-brand-navy">
          {firstName}
        </p>
      </div>
    </div>
  );
}
