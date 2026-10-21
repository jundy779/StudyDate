"use client";

import { useState, type MouseEvent } from "react";

/**
 * Tombol kirim untuk Tolak dan Minta perbaikan. Memeriksa alasan sebelum form
 * dikirim, supaya kesalahan terlihat tepat di panel, bukan di atas halaman.
 * Server tetap memvalidasi ulang.
 */
export function DecisionSubmitButton({
  revision,
  className,
  children,
}: {
  revision: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const [problem, setProblem] = useState("");

  function check(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    const reasons = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name="reasonCode"]:checked'),
    ).map((input) => input.value);
    const note = (form.querySelector<HTMLTextAreaElement>('textarea[name="userNote"]')?.value ?? "").trim();
    let message = "";
    if (!reasons.length) {
      message = "Centang minimal satu alasan di panel ini dulu.";
    } else if (revision && reasons.includes("other") && !note) {
      message = "Kamu memilih Alasan lainnya. Isi Catatan untuk pendaftar supaya mereka tahu yang perlu diperbaiki.";
    }
    setProblem(message);
    if (message) event.preventDefault();
  }

  return (
    <>
      <button type="submit" onClick={check} className={className}>
        {children}
      </button>
      <p role="alert" className="min-h-0 text-sm font-semibold text-brand-error empty:hidden">
        {problem}
      </p>
    </>
  );
}
