"use client";

import { useEffect, useId, useState } from "react";

const RESEND_SECONDS = 60;

export function StaffMagicLinkForm() {
  const emailId = useId();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || cooldown) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/staff-magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Permintaan belum dapat diproses.");
      } else {
        setSent(true);
        setCooldown(RESEND_SECONDS);
      }
    } catch {
      setError("Permintaan belum dapat diproses. Coba lagi beberapa saat.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="font-hand text-xl text-brand-blue">Khusus tim StudyDate</p>
      <h1 className="mt-1 font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl">
        {sent ? "Cek email kamu" : "Masuk ke Ruang Operasional"}
      </h1>
      <p className="mt-4 leading-7 text-brand-muted">
        {sent
          ? "Kalau email ini terdaftar sebagai tim, tautan masuk sudah dikirim. Buka dari perangkat ini. Hak akses tetap diperiksa lagi setelah kamu masuk."
          : "Masukkan email tim kamu, lalu buka tautan yang kami kirim. Tidak perlu kata sandi. Halaman ini tidak bisa dipakai untuk mendaftar."}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        <div>
          <label htmlFor={emailId} className="mb-2 block text-sm font-semibold text-brand-navy">Email tim</label>
          <input id={emailId} type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className="focus-ring h-12 w-full rounded-xl border border-brand-border bg-white px-4" />
        </div>
        {error && <p id={errorId} role="alert" className="text-sm leading-6 text-brand-error">{error}</p>}
        <button type="submit" disabled={loading || cooldown > 0} className="focus-ring min-h-12 w-full rounded-xl border-2 border-brand-navy bg-brand-blue px-5 font-semibold text-white shadow-[3px_3px_0_#0F1B33] disabled:opacity-60">
          {loading ? "Mengirim..." : cooldown ? `Kirim ulang dalam ${cooldown} detik` : "Kirim tautan masuk"}
        </button>
      </form>
      <p className="mt-5 text-sm leading-6 text-brand-muted">Bukan tim? Kamu akan diarahkan ke halaman mahasiswa seperti biasa.</p>
    </div>
  );
}
