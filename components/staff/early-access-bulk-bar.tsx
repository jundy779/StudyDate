"use client";

import { bulkApproveEarlyAccess } from "@/app/staff/early-access/actions";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

export const EARLY_ACCESS_BULK_FORM_ID = "early-access-bulk";
const LIMIT = 20;

function boxes() {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `input[type="checkbox"][form="${EARLY_ACCESS_BULK_FORM_ID}"][name="emails"]`,
    ),
  );
}

function ConfirmButton({ count, onBack }: { count: number; onBack: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={onBack}
        disabled={pending}
        className="focus-ring min-h-11 rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy"
      >
        Kembali
      </button>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="focus-ring min-h-11 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Memproses..." : `Ya, setujui ${count}`}
      </button>
    </div>
  );
}

/**
 * Bilah "Setujui yang dicentang". Kotak centang ada di tiap baris dan terhubung ke form
 * ini lewat atribut form, jadi tidak ada form bertumpuk.
 */
export function EarlyAccessBulkBar({ returnTo }: { returnTo: string }) {
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const allRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const sync = useCallback(() => {
    const list = boxes();
    const checked = list.filter((box) => box.checked).length;
    setCount(checked);
    setTotal(list.length);
    if (allRef.current) {
      allRef.current.checked = list.length > 0 && checked === Math.min(list.length, LIMIT);
      allRef.current.indeterminate = checked > 0 && checked < Math.min(list.length, LIMIT);
    }
  }, []);

  useEffect(() => {
    sync();
    function onChange(event: Event) {
      const target = event.target as HTMLInputElement | null;
      if (target?.getAttribute("form") === EARLY_ACCESS_BULK_FORM_ID) sync();
    }
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, [sync]);

  function toggleAll(checked: boolean) {
    boxes().forEach((box, index) => {
      box.checked = checked && index < LIMIT;
    });
    sync();
  }

  if (total === 0) return null;
  const tooMany = count > LIMIT;

  return (
    <form
      id={EARLY_ACCESS_BULK_FORM_ID}
      action={bulkApproveEarlyAccess}
      className="flex flex-col gap-3 border-b border-brand-border bg-[#F6F9FF] px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-brand-navy">
        <input
          ref={allRef}
          type="checkbox"
          className="size-5 accent-brand-blue"
          onChange={(event) => toggleAll(event.currentTarget.checked)}
        />
        Pilih semua di halaman ini{total > LIMIT ? ` (maksimal ${LIMIT})` : ""}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-brand-muted" aria-live="polite">
          {tooMany
            ? `Terpilih ${count}. Maksimal ${LIMIT} sekali proses.`
            : count > 0
              ? `${count} pendaftar dipilih`
              : "Centang pendaftar untuk disetujui bersamaan"}
        </p>
        <button
          type="button"
          disabled={count === 0 || tooMany}
          onClick={() => dialogRef.current?.showModal()}
          className="focus-ring min-h-11 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Setujui yang dicentang
        </button>
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[22px] border border-brand-border bg-white p-0 text-brand-navy shadow-2xl backdrop:bg-brand-navy/45"
      >
        <div className="p-6 sm:p-7">
          <h2 id={titleId} className="font-heading text-2xl font-semibold">
            Setujui {count} pendaftar?
          </h2>
          <p className="mt-3 text-sm leading-6 text-brand-muted">
            Setiap pendaftar mendapat email undangan login sendiri. Pastikan datanya sudah kamu cek,
            termasuk tanda email mirip. Pendaftar yang sudah diputuskan orang lain akan dilewati.
          </p>
          <ConfirmButton count={count} onBack={() => dialogRef.current?.close()} />
        </div>
      </dialog>
    </form>
  );
}
