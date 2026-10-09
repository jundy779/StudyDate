"use client";

import { SavedEventButton as SavedEventButtonIcon } from "lucide-react";
import { Bookmark } from "lucide-react";
import {
  SAVED_EVENTS_CHANGED_EVENT,
  isEventSaved,
  toggleSavedEvent,
} from "@/lib/events/saved-events";
import { useCallback, useSyncExternalStore } from "react";

type SavedEventButtonProps = {
  eventSlug: string;
  variant?: "compact" | "full";
};

type SavedState = "saved" | "unsaved" | "unavailable";

function subscribeToSavedEvents(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(SAVED_EVENTS_CHANGED_EVENT, listener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(SAVED_EVENTS_CHANGED_EVENT, listener);
  };
}

function readState(eventSlug: string): SavedState {
  try {
    return isEventSaved(window.localStorage, eventSlug) ? "saved" : "unsaved";
  } catch {
    return "unavailable";
  }
}

export function SavedEventButton({
  eventSlug,
  variant = "compact",
}: SavedEventButtonProps) {
  const getSnapshot = useCallback(() => readState(eventSlug), [eventSlug]);
  const getServerSnapshot = useCallback((): SavedState => "unsaved", []);
  const state = useSyncExternalStore(
    subscribeToSavedEvents,
    getSnapshot,
    getServerSnapshot,
  );
  const saved = state === "saved";
  const unavailable = state === "unavailable";
  const Icon = saved ? SavedEventButtonIcon : Bookmark;

  function handleToggle() {
    if (unavailable) return;

    try {
      toggleSavedEvent(window.localStorage, eventSlug);
      window.dispatchEvent(new Event(SAVED_EVENTS_CHANGED_EVENT));
    } catch {
      // Mode privat tertentu dapat memblokir penyimpanan browser.
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={saved}
      disabled={unavailable}
      title={
        unavailable
          ? "Penyimpanan browser sedang tidak tersedia"
          : saved
            ? "Hapus dari acara tersimpan"
            : "Simpan acara di perangkat ini"
      }
      className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        saved
          ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
          : "border-brand-border bg-white text-brand-navy hover:border-brand-blue hover:text-brand-blue"
      } ${variant === "full" ? "w-full" : "w-full sm:w-auto"}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {saved ? "Tersimpan" : "Simpan acara"}
    </button>
  );
}
