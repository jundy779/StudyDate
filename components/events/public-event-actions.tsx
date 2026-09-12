"use client";

import { CalendarPlus, ExternalLink, Share2 } from "lucide-react";
import { useState } from "react";

type PublicEventActionsProps = {
  calendarDownloadHref: string;
  googleCalendarHref: string;
  shareUrl: string;
  title: string;
};

export function PublicEventActions({
  calendarDownloadHref,
  googleCalendarHref,
  shareUrl,
  title,
}: PublicEventActionsProps) {
  const [message, setMessage] = useState("");

  async function shareEvent() {
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `Lihat acara ${title} di StudyDate ID.`,
          url: shareUrl,
        });
        setMessage("Acara berhasil dibagikan.");
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setMessage("Tautan acara sudah disalin.");
        return;
      }

      setMessage("Salin alamat acara dari kolom alamat browser.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Tautan belum dapat disalin. Coba salin dari kolom alamat browser.");
    }
  }

  return (
    <div className="mt-5 border-t border-brand-border pt-5">
      <p className="text-sm font-semibold text-brand-navy">Simpan atau bagikan</p>
      <div className="mt-3 grid gap-2">
        <a
          href={calendarDownloadHref}
          download
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-navy"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          Simpan ke kalender
        </a>
        <a
          href={googleCalendarHref}
          target="_blank"
          rel="noreferrer"
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-navy"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Buka Google Calendar
        </a>
        <button
          type="button"
          onClick={shareEvent}
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-navy"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Bagikan acara
        </button>
      </div>
      <p className="mt-3 min-h-5 text-xs leading-5 text-brand-muted" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
