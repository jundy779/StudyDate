"use client";

import { useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  STUDENT_EMAIL_DOMAIN_ERROR,
  STUDENT_EMAIL_DOMAIN_HELP,
} from "@/lib/auth/allowed-email-domains";
import { createClient } from "@/lib/supabase/client";

const RESEND_COOLDOWN_SECONDS = 60;

function getOAuthRedirectTo() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL("/auth/callback?next=/app", configured).toString();
    } catch {
      // fall through
    }
  }
  return `${window.location.origin}/auth/callback?next=/app`;
}

export function MagicLinkForm() {
  const emailId = useId();
  const errorId = useId();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const code = searchParams.get("error");
    if (code === "email_domain") {
      setError(
        searchParams.get("detail")
          ? decodeURIComponent(searchParams.get("detail")!)
          : STUDENT_EMAIL_DOMAIN_ERROR,
      );
      return;
    }
    if (code === "early_access_required") {
      setError(
        "Akun baru masih melalui undangan Akses Awal. Daftar dari halaman utama dan tunggu email persetujuan StudyDate.",
      );
    }
  }, [searchParams]);

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
    if (isLoading || cooldown > 0 || isGoogleLoading) {
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

  async function continueWithGoogle() {
    if (isLoading || isGoogleLoading) {
      return;
    }

    setError("");
    setIsGoogleLoading(true);

    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getOAuthRedirectTo(),
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (oauthError) {
        setError(
          "Masuk dengan Google belum tersedia. Coba lagi atau gunakan tautan email.",
        );
        setIsGoogleLoading(false);
      }
    } catch {
      setError(
        "Masuk dengan Google belum tersedia. Periksa koneksi dan coba lagi.",
      );
      setIsGoogleLoading(false);
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
          : "Masuk dengan Google atau tautan email. Akun baru Beta StudyDate hanya dapat dibuat setelah Akses Awal disetujui."}
      </p>

      {!isSent ? (
        <div className="mt-8 space-y-4">
          <button
            type="button"
            onClick={continueWithGoogle}
            disabled={isGoogleLoading || isLoading}
            className="focus-ring inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-brand-border bg-white px-5 py-3 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-blue hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleMark />
            {isGoogleLoading ? "Menghubungkan..." : "Lanjutkan dengan Google"}
          </button>

          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-brand-border" />
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-brand-muted">
              atau
            </span>
            <div className="h-px flex-1 bg-brand-border" />
          </div>
        </div>
      ) : null}

      <form
        className={isSent ? "mt-8 space-y-5" : "mt-4 space-y-5"}
        onSubmit={submitMagicLink}
        noValidate
      >
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
            placeholder="nama@gmail.com"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-describedby={error ? errorId : "email-domain-help"}
            aria-invalid={Boolean(error)}
            className="focus-ring h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-base text-brand-navy placeholder:text-brand-muted/70"
          />
          <p id="email-domain-help" className="mt-2 text-sm leading-6 text-brand-muted">
            {STUDENT_EMAIL_DOMAIN_HELP}
          </p>
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
          disabled={isLoading || cooldown > 0 || isGoogleLoading}
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
        lain. Akun Google juga harus memakai domain yang didukung.
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
