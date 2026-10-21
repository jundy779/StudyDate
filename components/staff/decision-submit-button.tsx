"use client";

import { useEffect, useState, type MouseEvent } from "react";

/**
 * Panel keputusan (Tolak, Minta perbaikan) melayang di atas baris lain. Komponen ini
 * menutup panel yang terbuka saat klik di luar panel atau tombol Escape, supaya
 * panel tidak menghalangi tombol di baris lain.
 */
export function DecisionPanelCloser({ group }: { group: string }) {
  useEffect(() => {
    const openPanels = () =>
      Array.from(document.querySelectorAll<HTMLDetailsElement>(`details[name="${group}"][open]`));

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      for (const panel of openPanels()) {
        if (target && !panel.contains(target)) panel.open = false;
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      for (const panel of openPanels()) {
        panel.open = false;
        panel.querySelector<HTMLElement>("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [group]);
  return null;
}

/**
 * Tombol kirim untuk Tolak dan Minta perbaikan. Memeriksa alasan sebelum form
 * dikirim, supaya kesalahan terlihat tepat di panel, bukan di atas halaman.
 * Server tetap memvalidasi ulang.
 */
export function DecisionSubmitButton({
  revision,
  className,
  cancelLabel,
  children,
}: {
  revision: boolean;
  className: string;
  cancelLabel?: string;
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

  function close(event: MouseEvent<HTMLButtonElement>) {
    const panel = event.currentTarget.closest("details");
    if (panel) {
      panel.open = false;
      panel.querySelector<HTMLElement>("summary")?.focus();
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <button type="submit" onClick={check} className={`flex-1 ${className}`}>
          {children}
        </button>
        {cancelLabel ? (
          <button
            type="button"
            onClick={close}
            className="focus-ring min-h-11 rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy"
          >
            {cancelLabel}
          </button>
        ) : null}
      </div>
      <p role="alert" className="text-sm font-semibold text-brand-error empty:hidden">
        {problem}
      </p>
    </>
  );
}
