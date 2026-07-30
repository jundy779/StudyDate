"use client";

import { useEffect, useId, useState } from "react";

const RESEND_COOLDOWN_SECONDS = 60;

export function MagicLinkForm() {
  const emailId = useId();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldown((remaining) => Math.max(0, remaining - 1));
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function submitMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading || cooldown > 0) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(
          result.message ??
            "Tautan masuk belum dapat dikirim. Coba lagi beberapa saat lagi.",
        );
        return;
      }

      setIsSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError(
        "Tautan masuk belum dapat dikirim. Periksa koneksi dan coba lagi.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <p className="section-label">Akses privat</p>
      <h1 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl">
        {isSent ? "Periksa emailmu" : "Masuk ke StudyDate"}
      </h1>
      <p className="mt-4 leading-7 text-brand-muted">
        {isSent
          ? "Kami sudah mengirimkan tautan masuk. Buka tautan tersebut melalui perangkat ini untuk melanjutkan ke StudyDate."
          : "Gunakan emailmu untuk melanjutkan. Kami akan mengirimkan tautan masuk yang aman tanpa kata sandi."}
      </p>

      <form className="mt-8 space-y-5" onSubmit={submitMagicLink} noValidate>
        <div>
          <label
            htmlFor={emailId}
            className="mb-2 block text-sm font-semibold text-brand-navy"
          >
            Email
          </label>
          <input
            id={emailId}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="nama@email.com"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={Boolean(error)}
            className="focus-ring h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-base text-brand-navy placeholder:text-brand-muted/70"
          />
        </div>

        {error ? (
          <p
            id={errorId}
            role="alert"
            className="text-sm leading-6 text-brand-error"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isLoading || cooldown > 0}
          className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white transition-colors hover:bg-[#003FBA] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading
            ? "Mengirim..."
            : cooldown > 0
              ? `Kirim ulang dalam ${cooldown} detik`
              : isSent
                ? "Kirim Ulang Tautan"
                : "Kirim Tautan Masuk"}
        </button>
      </form>

      <p className="mt-5 text-sm leading-6 text-brand-muted">
        Pastikan kamu dapat membuka email ini. Jangan gunakan email milik orang
        lain.
      </p>
    </div>
  );
}
