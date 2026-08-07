"use client";

import {
  selectContactRevealAction,
  withdrawContactRevealAction,
} from "@/app/app/messages/actions";
import {
  CONTACT_REVEAL_CHANNELS,
  CONTACT_REVEAL_COPY,
  type ContactRevealChannel,
  type ContactRevealCompletedChannel,
  type ContactRevealPreview,
  type ContactRevealState,
} from "@/lib/contact-reveal/constants";
import { LoaderCircle } from "lucide-react";
import { useId, useState, useTransition, type FormEvent } from "react";

type ContactRevealPanelProps = {
  publicId: string;
  conversationStatus: "awaiting_chat" | "active" | "ended" | "blocked";
  identityRevealCompleted: boolean;
  state: ContactRevealState;
  initialPreviews: Partial<
    Record<ContactRevealChannel, ContactRevealPreview | null>
  >;
  completedByChannel: Partial<
    Record<ContactRevealChannel, ContactRevealCompletedChannel | null>
  >;
  onStateChange: (next: ContactRevealState) => void;
};

export function ContactRevealPanel({
  publicId,
  conversationStatus,
  identityRevealCompleted,
  state,
  initialPreviews,
  completedByChannel,
  onStateChange,
}: ContactRevealPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingChannel, setPendingChannel] =
    useState<ContactRevealChannel | null>(null);
  const [preparePending, setPreparePending] = useState(false);
  const [previews, setPreviews] = useState(initialPreviews);
  const [showFormByChannel, setShowFormByChannel] = useState<
    Partial<Record<ContactRevealChannel, boolean>>
  >({});
  const [values, setValues] = useState<
    Partial<Record<ContactRevealChannel, string>>
  >(() => {
    const initial: Partial<Record<ContactRevealChannel, string>> = {};
    for (const channel of CONTACT_REVEAL_CHANNELS) {
      initial[channel] = initialPreviews[channel]?.displayValue ?? "";
    }
    return initial;
  });
  const errorId = useId();

  const closed =
    conversationStatus === "ended" || conversationStatus === "blocked";

  const channelMap = new Map(
    state.channels.map((item) => [item.channel, item] as const),
  );

  const anyCompleted = CONTACT_REVEAL_CHANNELS.some(
    (channel) => channelMap.get(channel)?.completed,
  );
  const anyEligible = CONTACT_REVEAL_CHANNELS.some(
    (channel) => channelMap.get(channel)?.eligible,
  );
  const anyInProgress = CONTACT_REVEAL_CHANNELS.some((channel) => {
    const item = channelMap.get(channel);
    return Boolean(item?.hasContact || item?.selectedByMe);
  });

  if (!identityRevealCompleted) {
    return null;
  }

  if (closed && !anyCompleted) {
    return null;
  }

  if (!anyCompleted && !anyEligible && !anyInProgress) {
    return null;
  }

  const visibleChannels = CONTACT_REVEAL_CHANNELS.filter((channel) => {
    const item = channelMap.get(channel);
    if (!item) return false;
    if (item.completed) return true;
    if (!item.eligible && !item.hasContact && !item.selectedByMe) {
      return false;
    }
    return true;
  });

  function patchChannelState(
    channel: ContactRevealChannel,
    patch: Partial<{
      eligible: boolean;
      hasContact: boolean;
      selectedByMe: boolean;
      completed: boolean;
      completedAt: string | null;
      canWithdraw: boolean;
    }>,
  ): ContactRevealState {
    return {
      channels: CONTACT_REVEAL_CHANNELS.map((name) => {
        const current = channelMap.get(name) ?? {
          channel: name,
          eligible: false,
          hasContact: false,
          selectedByMe: false,
          completed: false,
          completedAt: null,
          canWithdraw: false,
        };
        if (name !== channel) return current;
        return { ...current, ...patch };
      }),
    };
  }

  function onConsent(channel: ContactRevealChannel) {
    const preview = previews[channel];
    if (!preview?.contactVersionId) return;
    setError(null);
    setPendingChannel(channel);
    const formData = new FormData();
    formData.set("publicId", publicId);
    formData.set("channel", channel);
    formData.set("contactVersionId", preview.contactVersionId);
    startTransition(async () => {
      try {
        const next = await selectContactRevealAction(formData);
        onStateChange(next);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : CONTACT_REVEAL_COPY.genericError,
        );
      } finally {
        setPendingChannel(null);
      }
    });
  }

  function onWithdraw(channel: ContactRevealChannel) {
    setError(null);
    setPendingChannel(channel);
    const formData = new FormData();
    formData.set("publicId", publicId);
    formData.set("channel", channel);
    startTransition(async () => {
      try {
        const next = await withdrawContactRevealAction(formData);
        onStateChange(next);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : CONTACT_REVEAL_COPY.genericError,
        );
      } finally {
        setPendingChannel(null);
      }
    });
  }

  async function onPrepare(
    event: FormEvent<HTMLFormElement>,
    channel: ContactRevealChannel,
  ) {
    event.preventDefault();
    setError(null);
    const value = values[channel]?.trim() ?? "";
    if (!value) {
      setError(CONTACT_REVEAL_COPY.validationError);
      return;
    }

    setPreparePending(true);
    setPendingChannel(channel);
    try {
      const response = await fetch("/api/contact-reveal/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId, channel, value }),
      });
      const payload = (await response.json()) as {
        error?: string;
        contactVersionId?: string;
        channel?: ContactRevealChannel;
        displayValue?: string;
      };

      if (
        !response.ok ||
        !payload.contactVersionId ||
        !payload.displayValue ||
        !payload.channel
      ) {
        setError(payload.error ?? CONTACT_REVEAL_COPY.validationError);
        return;
      }

      setPreviews((current) => ({
        ...current,
        [channel]: {
          contactVersionId: payload.contactVersionId!,
          channel: payload.channel!,
          displayValue: payload.displayValue!,
          createdAt: new Date().toISOString(),
        },
      }));
      setValues((current) => ({
        ...current,
        [channel]: payload.displayValue!,
      }));
      setShowFormByChannel((current) => ({
        ...current,
        [channel]: false,
      }));
      onStateChange(
        patchChannelState(channel, {
          hasContact: true,
          selectedByMe: false,
          canWithdraw: false,
        }),
      );
    } catch {
      setError(CONTACT_REVEAL_COPY.validationError);
    } finally {
      setPreparePending(false);
      setPendingChannel(null);
    }
  }

  return (
    <section
      aria-label={CONTACT_REVEAL_COPY.heading}
      className="rounded-[18px] border border-brand-border bg-brand-surface px-4 py-4"
    >
      <h2 className="font-heading text-base font-semibold text-brand-navy">
        {CONTACT_REVEAL_COPY.heading}
      </h2>
      <p className="mt-2 text-sm leading-6 text-brand-muted">
        {CONTACT_REVEAL_COPY.description}
      </p>
      <p className="mt-2 text-xs leading-5 text-brand-muted">
        {CONTACT_REVEAL_COPY.privacyNote}
      </p>

      <div className="mt-4 space-y-5">
        {visibleChannels.map((channel) => {
          const item = channelMap.get(channel);
          if (!item) return null;
          const completed = completedByChannel[channel];
          const preview = previews[channel];
          const showForm = showFormByChannel[channel] ?? false;
          const channelBusy =
            (pending || preparePending) && pendingChannel === channel;

          if (item.completed && completed?.completed) {
            const counterpartVisible = Boolean(completed.counterpartDisplay);
            return (
              <div
                key={channel}
                className="space-y-3 border-t border-brand-border pt-4 first:border-t-0 first:pt-0"
              >
                <h3 className="text-sm font-semibold text-brand-navy">
                  {CONTACT_REVEAL_COPY.channelLabels[channel]}
                </h3>
                <p className="text-sm font-medium text-brand-navy">
                  {CONTACT_REVEAL_COPY.completedTitle}
                </p>
                <p className="text-sm leading-6 text-brand-muted">
                  {counterpartVisible
                    ? CONTACT_REVEAL_COPY.completedBody
                    : CONTACT_REVEAL_COPY.completedBlockedBody}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ContactDisplay
                    label={CONTACT_REVEAL_COPY.mineLabel}
                    display={completed.mineDisplay}
                    href={completed.mineHref}
                  />
                  {counterpartVisible ? (
                    <ContactDisplay
                      label={CONTACT_REVEAL_COPY.counterpartLabel}
                      display={completed.counterpartDisplay}
                      href={completed.counterpartHref}
                    />
                  ) : (
                    <div className="rounded-2xl border border-brand-border bg-white p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                        {CONTACT_REVEAL_COPY.counterpartLabel}
                      </p>
                      <p className="mt-3 text-sm text-brand-muted">
                        {CONTACT_REVEAL_COPY.counterpartUnavailable}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (item.selectedByMe) {
            return (
              <div
                key={channel}
                className="space-y-3 border-t border-brand-border pt-4 first:border-t-0 first:pt-0"
              >
                <h3 className="text-sm font-semibold text-brand-navy">
                  {CONTACT_REVEAL_COPY.channelLabels[channel]}
                </h3>
                <p className="text-sm leading-6 text-brand-navy">
                  {CONTACT_REVEAL_COPY.selectedNote}
                </p>
                {item.canWithdraw ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onWithdraw(channel)}
                    className="focus-ring inline-flex min-h-11 items-center rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy disabled:opacity-60"
                  >
                    {channelBusy ? (
                      <>
                        <LoaderCircle
                          className="mr-2 h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                        Menyimpan…
                      </>
                    ) : (
                      CONTACT_REVEAL_COPY.withdrawCta
                    )}
                  </button>
                ) : null}
              </div>
            );
          }

          if (item.eligible && preview?.contactVersionId && !showForm) {
            return (
              <div
                key={channel}
                className="space-y-3 border-t border-brand-border pt-4 first:border-t-0 first:pt-0"
              >
                <h3 className="text-sm font-semibold text-brand-navy">
                  {CONTACT_REVEAL_COPY.channelLabels[channel]}
                </h3>
                <div>
                  <p className="text-sm font-medium text-brand-navy">
                    {preview.displayValue}
                  </p>
                  <button
                    type="button"
                    className="focus-ring mt-1 text-sm font-semibold text-brand-blue"
                    onClick={() =>
                      setShowFormByChannel((current) => ({
                        ...current,
                        [channel]: true,
                      }))
                    }
                  >
                    {CONTACT_REVEAL_COPY.replaceCta}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onConsent(channel)}
                  className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {channelBusy ? (
                    <>
                      <LoaderCircle
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Menyimpan…
                    </>
                  ) : (
                    CONTACT_REVEAL_COPY.consentCtas[channel]
                  )}
                </button>
              </div>
            );
          }

          if (item.eligible || item.hasContact) {
            const inputId = `contact-reveal-${channel}`;
            return (
              <div
                key={channel}
                className="space-y-3 border-t border-brand-border pt-4 first:border-t-0 first:pt-0"
              >
                <h3 className="text-sm font-semibold text-brand-navy">
                  {CONTACT_REVEAL_COPY.channelLabels[channel]}
                </h3>
                <form
                  className="space-y-3"
                  onSubmit={(event) => onPrepare(event, channel)}
                >
                  <div>
                    <label
                      htmlFor={inputId}
                      className="text-sm font-medium text-brand-navy"
                    >
                      {CONTACT_REVEAL_COPY.inputLabels[channel]}
                    </label>
                    <p className="mt-1 text-xs leading-5 text-brand-muted">
                      {CONTACT_REVEAL_COPY.inputHints[channel]}
                    </p>
                    <input
                      id={inputId}
                      name="value"
                      value={values[channel] ?? ""}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [channel]: event.target.value,
                        }))
                      }
                      required
                      autoComplete="off"
                      inputMode={
                        channel === "linkedin" ? "url" : "text"
                      }
                      type={channel === "linkedin" ? "url" : "text"}
                      className="focus-ring mt-2 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm"
                      aria-describedby={error ? errorId : undefined}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={preparePending}
                      className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {channelBusy ? (
                        <>
                          <LoaderCircle
                            className="mr-2 h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                          Menyimpan…
                        </>
                      ) : (
                        CONTACT_REVEAL_COPY.addContactCta
                      )}
                    </button>
                    {preview?.contactVersionId ? (
                      <button
                        type="button"
                        className="focus-ring inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-brand-muted"
                        onClick={() =>
                          setShowFormByChannel((current) => ({
                            ...current,
                            [channel]: false,
                          }))
                        }
                      >
                        Batal
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>
            );
          }

          return null;
        })}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {pending || preparePending ? (
        <p className="sr-only" role="status">
          {CONTACT_REVEAL_COPY.loading}
        </p>
      ) : null}
    </section>
  );
}

function ContactDisplay({
  label,
  display,
  href,
}: {
  label: string;
  display: string | null;
  href: string | null;
}) {
  return (
    <div className="rounded-2xl border border-brand-border bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
        {label}
      </p>
      {display ? (
        href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring mt-3 inline-block text-sm font-medium text-brand-blue underline-offset-2 hover:underline"
          >
            {display}
          </a>
        ) : (
          <p className="mt-3 text-sm font-medium text-brand-navy">{display}</p>
        )
      ) : (
        <p className="mt-3 text-sm text-brand-muted">
          {CONTACT_REVEAL_COPY.counterpartUnavailable}
        </p>
      )}
    </div>
  );
}
