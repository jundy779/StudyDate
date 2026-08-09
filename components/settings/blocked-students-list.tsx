"use client";

import { unblockStudentAction } from "@/app/app/settings/actions";
import type { BlockedStudent } from "@/lib/account/blocks";
import { mascotImageSrc } from "@/lib/profile/validation";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";

export function BlockedStudentsList({
  students,
}: {
  students: BlockedStudent[];
}) {
  const [selected, setSelected] = useState<BlockedStudent | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!selected) return;
    cancelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        event.preventDefault();
        setSelected(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [isPending, selected]);

  function unblock() {
    if (!selected) return;
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await unblockStudentAction(selected.publicAlias);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSelected(null);
      setMessage(result.message);
    });
  }

  if (!students.length) {
    return (
      <p className="text-sm leading-6 text-brand-muted">
        Belum ada akun yang kamu blokir.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-brand-border">
        {students.map((student) => (
          <li
            key={student.publicAlias}
            className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0"
          >
            <Image
              src={mascotImageSrc(student.avatarMascot) ?? "/brand/mascot/front.png"}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-xl border border-brand-border bg-brand-surface object-contain"
            />
            <div className="min-w-0 flex-1">
              <p className="font-heading font-semibold text-brand-navy">
                {student.publicAlias}
              </p>
              <p className="mt-1 break-words text-sm leading-6 text-brand-muted">
                {student.campus} · {student.studyProgram}
                {student.semester ? ` · Semester ${student.semester}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setSelected(student);
              }}
              className="focus-ring min-h-11 rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-navy hover:border-brand-blue hover:text-brand-blue"
            >
              Buka blokir
            </button>
          </li>
        ))}
      </ul>

      {message ? (
        <p role="status" className="mt-4 text-sm font-semibold text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm font-semibold text-brand-error">
          {error}
        </p>
      ) : null}

      {selected ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="unblock-title"
          aria-describedby="unblock-description"
          className="fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/50 p-3 sm:items-center sm:p-6"
        >
          <div className="max-h-[calc(100svh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[20px] bg-white p-5 shadow-2xl sm:p-6">
            <h3
              id="unblock-title"
              className="font-heading text-xl font-semibold text-brand-navy"
            >
              Buka blokir {selected.publicAlias}?
            </h3>
            <p
              id="unblock-description"
              className="mt-3 text-sm leading-6 text-brand-muted"
            >
              Membuka blokir tidak otomatis memulihkan percakapan atau data
              yang sebelumnya tidak dapat diakses. Aturan cooldown dan
              eligibility tetap berlaku.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isPending}
                onClick={unblock}
                className="focus-ring min-h-11 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isPending ? "Memproses…" : "Buka blokir"}
              </button>
              <button
                ref={cancelRef}
                type="button"
                disabled={isPending}
                onClick={() => setSelected(null)}
                className="focus-ring min-h-11 rounded-xl border border-brand-border px-5 text-sm font-semibold text-brand-navy disabled:opacity-60"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
