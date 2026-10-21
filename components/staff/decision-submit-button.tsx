"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { useFormStatus } from "react-dom";

/** Tombol kirim biasa yang menampilkan "Mengirim..." dan terkunci selama proses. */
export function PendingSubmitButton({
  className,
  pendingLabel = "Mengirim...",
  children,
}: {
  className: string;
  pendingLabel?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={`${className} disabled:cursor-wait disabled:opacity-70`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * Panel keputusan (Tolak, Minta perbaikan) melayang di atas baris lain. Komponen ini
 * menutup panel yang terbuka saat klik di luar panel atau tombol Escape, supaya
 * panel tidak menghalangi tombol di baris lain.
 */
export function DecisionPanelCloser({ group }: { group: string }) {
  const resultState = useSearchParams().get("state");

  // Setelah keputusan diproses halaman memuat ulang dengan ?state=...; tutup panel
  // yang masih terbuka dan tampilkan pesan hasilnya.
  useEffect(() => {
    if (!resultState) return;
    document
      .querySelectorAll<HTMLDetailsElement>(`details[name="${group}"][open]`)
      .forEach((panel) => {
        panel.open = false;
      });
    document.getElementById("hasil-pemeriksaan")?.scrollIntoView({ block: "center" });
  }, [group, resultState]);

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
  const { pending } = useFormStatus();

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
        <button
          type="submit"
          onClick={check}
          disabled={pending}
          aria-busy={pending || undefined}
          className={`flex-1 ${className} disabled:cursor-wait disabled:opacity-70`}
        >
          {pending ? "Mengirim..." : children}
        </button>
        {cancelLabel ? (
          <button
            type="button"
            onClick={close}
            disabled={pending}
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
