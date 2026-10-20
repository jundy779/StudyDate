"use client";

import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { EventCover } from "@/components/events/event-cover";
import {
  EVENT_COVER_MAX_BYTES,
  type EventCategory,
} from "@/lib/events/constants";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function EventCoverUploader({
  publicSlug,
  category,
  title,
  city,
  coverUrl,
}: {
  publicSlug: string;
  category: EventCategory;
  title: string;
  city: string;
  coverUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const shown = preview ?? coverUrl;

  async function send(method: "POST" | "DELETE", body?: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/events/${publicSlug}/cover`, {
        method,
        body,
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setPreview(null);
        setMessage({ tone: "error", text: payload.error ?? "Foto sampul belum dapat disimpan." });
        return;
      }
      setMessage({
        tone: "ok",
        text: method === "POST" ? "Foto sampul tersimpan." : "Foto sampul dihapus. Acara memakai sampul kategori lagi.",
      });
      if (method === "DELETE") setPreview(null);
      startTransition(() => router.refresh());
    } catch {
      setPreview(null);
      setMessage({ tone: "error", text: "Koneksi terputus. Coba lagi sebentar." });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type) || file.size > EVENT_COVER_MAX_BYTES) {
      setMessage({ tone: "error", text: "Pakai JPG, PNG, atau WebP dengan ukuran maksimal 5 MB." });
      return;
    }
    setPreview(URL.createObjectURL(file));
    const body = new FormData();
    body.set("cover", file);
    void send("POST", body);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
      <div className="relative">
        <EventCover category={category} title={title} city={city} coverUrl={shown} />
        {busy ? (
          <div className="absolute inset-0 grid place-items-center rounded-[22px] bg-[#0F1B33]/45">
            <LoaderCircle className="h-8 w-8 animate-spin text-white motion-reduce:animate-none" aria-hidden="true" />
          </div>
        ) : null}
      </div>
      <div>
        <p className="text-sm leading-6 text-brand-muted">
          Foto dipotong otomatis ke 16:9 dan ukurannya dikecilkan. Data lokasi dan kamera
          di dalam foto dibuang. Jangan pakai foto yang memperlihatkan wajah orang lain
          tanpa izin.
        </p>
        <input
          ref={inputRef}
          id={`cover-${publicSlug}`}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          disabled={busy}
          onChange={(event) => onFile(event.target.files?.[0])}
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <label
            htmlFor={`cover-${publicSlug}`}
            aria-disabled={busy}
            className="inline-flex focus-within:ring-2 focus-within:ring-brand-blue focus-within:ring-offset-2 min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 border-brand-navy bg-brand-blue px-5 text-sm font-semibold text-white shadow-[3px_3px_0_#0F1B33] transition-transform hover:-translate-y-0.5 aria-disabled:cursor-wait aria-disabled:opacity-70 motion-reduce:transition-none"
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            {coverUrl ? "Ganti foto" : "Unggah foto"}
          </label>
          {coverUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void send("DELETE")}
              className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-brand-navy bg-white px-5 text-sm font-semibold text-brand-navy disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Hapus
            </button>
          ) : null}
        </div>
        <p
          aria-live="polite"
          className={`mt-3 min-h-5 text-sm ${message?.tone === "error" ? "text-brand-error" : "text-brand-blue"}`}
        >
          {message?.text ?? ""}
        </p>
      </div>
    </div>
  );
}
