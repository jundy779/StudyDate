"use client";

import { useState, type FormEvent } from "react";

const interests = [
  { value: "people", label: "People" },
  { value: "groups", label: "Groups" },
  { value: "events", label: "Campus Events" },
] as const;

export function EarlyAccessRevisionForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      token,
      email: String(form.get("email") ?? ""),
      campus: String(form.get("campus") ?? ""),
      interests: form.getAll("interests").map(String),
      website: String(form.get("website") ?? ""),
    };

    try {
      const response = await fetch("/api/early-access/revise", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setError(result.error || "Perbaikan belum dapat disimpan.");
        return;
      }
      setDone(true);
    } catch {
      setError("Perbaikan belum dapat dikirim. Coba lagi beberapa saat.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-[22px] border border-green-200 bg-green-50 p-6">
        <h2 className="font-heading text-2xl font-semibold text-brand-navy">
          Perbaikan sudah dikirim
        </h2>
        <p className="mt-3 leading-7 text-brand-muted">
          Pendaftaranmu sudah masuk kembali ke antrean review. Tim StudyDate akan
          mengirim email lagi jika akses disetujui atau masih ada data yang perlu diperbaiki.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[22px] border border-brand-border bg-white p-6 sm:p-8">
      <div className="grid gap-5">
        <label className="text-sm font-semibold text-brand-navy">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border px-4 font-normal"
            placeholder="nama@student.kampus.ac.id"
          />
        </label>
        <label className="text-sm font-semibold text-brand-navy">
          Nama kampus lengkap
          <input
            name="campus"
            required
            maxLength={120}
            className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border px-4 font-normal"
            placeholder="Contoh: Universitas Indonesia"
          />
          <span className="mt-2 block text-xs font-normal leading-5 text-brand-muted">
            Gunakan nama resmi kampus, bukan hanya singkatan.
          </span>
        </label>
        <fieldset>
          <legend className="text-sm font-semibold text-brand-navy">Minat (opsional)</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {interests.map((interest) => (
              <label
                key={interest.value}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-brand-border px-4 text-sm"
              >
                <input type="checkbox" name="interests" value={interest.value} className="size-4" />
                {interest.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="sr-only" aria-hidden="true">
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-brand-error">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="focus-ring mt-6 min-h-12 rounded-xl bg-brand-blue px-6 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Mengirim…" : "Kirim perbaikan"}
      </button>
    </form>
  );
}
