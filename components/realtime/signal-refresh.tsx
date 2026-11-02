"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { STUDYDATE_SIGNAL_EVENT, type StudyDateSignal } from "@/components/realtime/private-channel";

/**
 * Memuat ulang data halaman (tanpa reload penuh) saat sinyal pribadi dengan jenis
 * tertentu masuk, misalnya pengumuman acara baru. Ditunda sebentar supaya beberapa
 * sinyal beruntun cukup satu kali muat ulang, dan ditahan selama tab tersembunyi.
 */
export function SignalRefresh({ types, delayMs = 1200 }: { types: string[]; delayMs?: number }) {
  const router = useRouter();
  const key = types.join(",");

  useEffect(() => {
    const wanted = new Set(key.split(","));
    let timer: number | undefined;
    let pending = false;

    function refreshSoon() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.hidden) {
          pending = true;
          return;
        }
        router.refresh();
      }, delayMs);
    }
    function onSignal(event: Event) {
      const signal = (event as CustomEvent<StudyDateSignal>).detail;
      if (signal && wanted.has(signal.type)) refreshSoon();
    }
    function onVisibility() {
      if (!document.hidden && pending) {
        pending = false;
        router.refresh();
      }
    }
    window.addEventListener(STUDYDATE_SIGNAL_EVENT, onSignal);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(STUDYDATE_SIGNAL_EVENT, onSignal);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [key, delayMs, router]);

  return null;
}
