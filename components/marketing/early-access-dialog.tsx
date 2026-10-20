"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ArrowRight, Check, LoaderCircle, X } from "lucide-react";
import { emitEarlyAccessEvent } from "@/lib/early-access/analytics";
import {
  earlyAccessPayloadSchema,
  getEarlyAccessFieldErrors,
  type EarlyAccessFieldErrors,
  type EarlyAccessInput,
  type EarlyAccessSource,
} from "@/lib/early-access/validation";

type DialogContextValue = {
  openDialog: (source: EarlyAccessSource, trigger: HTMLButtonElement) => void;
};

type SubmissionPhase = "idle" | "submitting" | "success" | "duplicate";

type ApiResponse = {
  status?: "success" | "duplicate" | "validation_error" | "server_error";
  fieldErrors?: EarlyAccessFieldErrors;
  formError?: string;
};

const EarlyAccessDialogContext = createContext<DialogContextValue | null>(null);

const interestOptions = [
  { value: "people", label: "Cari Teman" },
  { value: "groups", label: "Circle Belajar" },
  { value: "events", label: "Acara Kampus" },
] as const;

export function EarlyAccessProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<EarlyAccessSource>("hero");
  const [session, setSession] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const openDialog = useCallback(
    (nextSource: EarlyAccessSource, trigger: HTMLButtonElement) => {
      triggerRef.current = trigger;
      setSource(nextSource);
      setSession((current) => current + 1);
      setOpen(true);
      emitEarlyAccessEvent("early_access_opened", nextSource);
    },
    [],
  );

  return (
    <EarlyAccessDialogContext.Provider value={{ openDialog }}>
      {children}
      <EarlyAccessDialog
        open={open}
        source={source}
        session={session}
        triggerRef={triggerRef}
        onOpenChange={setOpen}
      />
    </EarlyAccessDialogContext.Provider>
  );
}

export function EarlyAccessTrigger({
  source,
  children,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  source: EarlyAccessSource;
}) {
  const context = useContext(EarlyAccessDialogContext);

  if (!context) {
    throw new Error("EarlyAccessTrigger must be used inside EarlyAccessProvider.");
  }

  return (
    <button
      type="button"
      {...props}
      onClick={(event) => {
        onClick?.(event);

        if (!event.defaultPrevented) {
          context.openDialog(source, event.currentTarget);
        }
      }}
    >
      {children}
    </button>
  );
}

function EarlyAccessDialog({
  open,
  source,
  session,
  triggerRef,
  onOpenChange,
}: {
  open: boolean;
  source: EarlyAccessSource;
  session: number;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onOpenChange: (open: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [phase, setPhase] = useState<SubmissionPhase>("idle");
  const [fieldErrors, setFieldErrors] = useState<EarlyAccessFieldErrors>({});
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;

    formRef.current?.reset();
    setPhase("idle");
    setFieldErrors({});
    setFormError("");

    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => emailRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;

      if (dialog?.open) {
        dialog.close();
      }

      trigger?.focus();
    };
  }, [open, session, triggerRef]);

  const closeDialog = () => {
    if (phase !== "submitting") {
      onOpenChange(false);
    }
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]):not([tabindex="-1"])',
      ),
    ).filter((element) => element.getClientRects().length > 0);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);

    if (!firstElement || !lastElement) {
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const focusFirstError = (errors: EarlyAccessFieldErrors) => {
    if (errors.email) {
      emailRef.current?.focus();
      return;
    }

    if (errors.consent) {
      consentRef.current?.focus();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (phase === "submitting") {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const input: EarlyAccessInput = {
      email: String(formData.get("email") || ""),
      campus: String(formData.get("campus") || ""),
      interests: formData
        .getAll("interests")
        .filter((value): value is "people" | "groups" | "events" =>
          value === "people" || value === "groups" || value === "events",
        ),
      source,
      consent: formData.get("consent") === "on",
      website: String(formData.get("website") || ""),
    };
    const parsed = earlyAccessPayloadSchema.safeParse(input);

    if (!parsed.success) {
      const errors = getEarlyAccessFieldErrors(parsed.error);
      setFieldErrors(errors);
      setFormError("");
      focusFirstError(errors);
      return;
    }

    setPhase("submitting");
    setFieldErrors({});
    setFormError("");
    emitEarlyAccessEvent("early_access_submitted", source);

    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      const result = (await response.json()) as ApiResponse;

      if (result.status === "success") {
        setPhase("success");
        emitEarlyAccessEvent("early_access_success", source);
        return;
      }

      if (result.status === "duplicate") {
        setPhase("duplicate");
        emitEarlyAccessEvent("early_access_duplicate", source);
        return;
      }

      if (result.status === "validation_error") {
        const errors = result.fieldErrors || {};
        setPhase("idle");
        setFieldErrors(errors);
        setFormError(result.formError || "");
        focusFirstError(errors);
        return;
      }

      setPhase("idle");
      setFormError(
        result.formError ||
          "Pendaftaran belum dapat diproses. Silakan coba lagi beberapa saat.",
      );
      emitEarlyAccessEvent("early_access_error", source);
    } catch {
      setPhase("idle");
      setFormError(
        "Pendaftaran belum dapat diproses. Silakan coba lagi beberapa saat.",
      );
      emitEarlyAccessEvent("early_access_error", source);
    }
  };

  const isComplete = phase === "success" || phase === "duplicate";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onClose={() => onOpenChange(false)}
      onKeyDown={handleDialogKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
      className="m-auto max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-[620px] overflow-y-auto rounded-[24px] border border-brand-border bg-white p-0 text-brand-navy shadow-[0_32px_100px_rgba(15,27,51,0.28)] backdrop:bg-brand-navy/65 backdrop:backdrop-blur-[2px]"
    >
      <div className="relative p-6 sm:p-8">
        <button
          type="button"
          aria-label="Tutup dialog akses awal"
          onClick={closeDialog}
          disabled={phase === "submitting"}
          className="focus-ring absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-[12px] border border-brand-border bg-white text-brand-muted transition-colors hover:text-brand-navy disabled:cursor-not-allowed disabled:opacity-50 sm:right-6 sm:top-6"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {isComplete ? (
          <div className="pr-10">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF2FF] text-brand-blue">
              <Check className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2
              id={titleId}
              className="mt-6 font-heading text-2xl font-semibold leading-tight sm:text-3xl"
            >
              {phase === "success"
                ? "Kamu sudah masuk daftar akses awal 💙"
                : "Kamu sudah tercatat 💙"}
            </h2>
            <p
              id={descriptionId}
              className="mt-4 max-w-lg leading-7 text-brand-muted"
            >
              {phase === "success"
                ? "Pendaftaranmu akan diperiksa. Jika disetujui, StudyDate akan mengirim email resmi berisi tautan sekali pakai untuk masuk dan melengkapi profil."
                : "Email ini sudah ada di antrean Akses Awal. Jika akses disetujui, tautan login resmi akan dikirim ke email tersebut."}
            </p>
            <button
              type="button"
              onClick={closeDialog}
              className="focus-ring mt-8 inline-flex min-h-12 items-center justify-center rounded-[12px] bg-brand-blue px-6 py-3 font-semibold text-white transition-colors hover:bg-[#013FC7]"
            >
              Tutup
            </button>
          </div>
        ) : (
          <>
            <div className="pr-12">
              <p className="text-sm font-semibold text-brand-blue">
                Akses awal
              </p>
              <h2
                id={titleId}
                className="mt-3 font-heading text-2xl font-semibold leading-tight sm:text-3xl"
              >
                Daftar untuk akses awal StudyDate ID
              </h2>
              <p
                id={descriptionId}
                className="mt-4 max-w-lg text-sm leading-6 text-brand-muted sm:text-base sm:leading-7"
              >
                Daftarkan emailmu untuk mencoba StudyDate. Cari teman belajar,
                gabung circle kecil, dan temukan acara kampus tanpa langsung
                membagikan nama atau kontak pribadi.
              </p>
            </div>

            <form
              ref={formRef}
              onSubmit={handleSubmit}
              noValidate
              aria-busy={phase === "submitting"}
              className="mt-7 space-y-5"
            >
              <div>
                <label
                  htmlFor="early-access-email"
                  className="text-sm font-semibold text-brand-navy"
                >
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  ref={emailRef}
                  id="early-access-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={
                    fieldErrors.email ? "early-access-email-error" : undefined
                  }
                  placeholder="nama@email.com"
                  className="focus-ring mt-2 h-12 w-full rounded-[12px] border border-brand-border bg-white px-4 text-base text-brand-navy placeholder:text-brand-muted/70"
                />
                {fieldErrors.email ? (
                  <p
                    id="early-access-email-error"
                    role="alert"
                    className="mt-2 text-sm text-red-500"
                  >
                    {fieldErrors.email}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="early-access-campus"
                  className="text-sm font-semibold text-brand-navy"
                >
                  Kampus <span className="font-normal text-brand-muted">(opsional)</span>
                </label>
                <input
                  id="early-access-campus"
                  name="campus"
                  type="text"
                  autoComplete="organization"
                  maxLength={120}
                  aria-invalid={Boolean(fieldErrors.campus)}
                  aria-describedby={
                    fieldErrors.campus ? "early-access-campus-error" : undefined
                  }
                  placeholder="Nama kampusmu"
                  className="focus-ring mt-2 h-12 w-full rounded-[12px] border border-brand-border bg-white px-4 text-base text-brand-navy placeholder:text-brand-muted/70"
                />
                {fieldErrors.campus ? (
                  <p
                    id="early-access-campus-error"
                    role="alert"
                    className="mt-2 text-sm text-red-500"
                  >
                    {fieldErrors.campus}
                  </p>
                ) : null}
              </div>

              <fieldset>
                <legend className="text-sm font-semibold text-brand-navy">
                  Minat <span className="font-normal text-brand-muted">(opsional)</span>
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {interestOptions.map((option) => (
                    <label
                      key={option.value}
                      className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[12px] border border-brand-border px-3 py-2.5 text-sm font-medium text-brand-navy transition-colors hover:border-brand-blue"
                    >
                      <input
                        type="checkbox"
                        name="interests"
                        value={option.value}
                        className="h-4 w-4 shrink-0 accent-brand-blue"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-brand-navy">
                  <input
                    ref={consentRef}
                    type="checkbox"
                    name="consent"
                    required
                    aria-invalid={Boolean(fieldErrors.consent)}
                    aria-describedby={
                      fieldErrors.consent ? "early-access-consent-error" : undefined
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-brand-blue"
                  />
                  <span>
                    Saya setuju menerima informasi akses awal dan pembaruan penting
                    dari StudyDate ID.
                  </span>
                </label>
                {fieldErrors.consent ? (
                  <p
                    id="early-access-consent-error"
                    role="alert"
                    className="mt-2 pl-7 text-sm text-red-500"
                  >
                    {fieldErrors.consent}
                  </p>
                ) : null}
              </div>

              <div hidden aria-hidden="true">
                <label htmlFor="early-access-website">Website</label>
                <input
                  id="early-access-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <p className="text-xs leading-5 text-brand-muted">
                Emailmu hanya digunakan untuk informasi akses awal dan pembaruan
                penting. StudyDate tidak menjual data pengguna.
              </p>

              {formError ? (
                <p
                  role="alert"
                  className="rounded-[12px] border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm leading-6 text-red-500"
                >
                  {formError}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={phase === "submitting"}
                  className="focus-ring min-h-12 rounded-[12px] border border-brand-border px-5 py-3 font-semibold text-brand-navy transition-colors hover:border-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Nanti Saja
                </button>
                <button
                  type="submit"
                  disabled={phase === "submitting"}
                  className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-brand-blue px-5 py-3 font-semibold text-white transition-colors hover:bg-[#013FC7] disabled:cursor-not-allowed disabled:opacity-65"
                >
                  {phase === "submitting" ? (
                    <>
                      <LoaderCircle
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Mengirim...
                    </>
                  ) : (
                    <>
                      Daftar Akses Awal
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </dialog>
  );
}
