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
      <p className="section-label">Akses staff terbatas</p>
      <h1 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl">
        {sent ? "Periksa email staff" : "Masuk ke ruang staff"}
      </h1>
      <p className="mt-4 leading-7 text-brand-muted">
        {sent
          ? "Jika akun memenuhi syarat, tautan masuk telah dikirim. Akses tetap diperiksa kembali setelah autentikasi."
          : "Gunakan akun staff khusus. Halaman ini tidak menyediakan pendaftaran atau pemberian role."}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        <div>
          <label htmlFor={emailId} className="mb-2 block text-sm font-semibold text-brand-navy">Email staff</label>
          <input id={emailId} type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className="focus-ring h-12 w-full rounded-xl border border-brand-border px-4" />
        </div>
        {error && <p id={errorId} role="alert" className="text-sm leading-6 text-brand-error">{error}</p>}
        <button type="submit" disabled={loading || cooldown > 0} className="focus-ring min-h-12 w-full rounded-xl bg-brand-navy px-5 font-semibold text-white disabled:opacity-60">
          {loading ? "Mengirim…" : cooldown ? `Kirim ulang dalam ${cooldown} detik` : "Kirim tautan masuk staff"}
        </button>
      </form>
      <p className="mt-5 text-sm leading-6 text-brand-muted">Akun non-staff diarahkan kembali ke ruang mahasiswa tanpa mengungkap status role.</p>
    </div>
  );
}
