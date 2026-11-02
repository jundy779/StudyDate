"use client";

import { useEffect, useRef, useState } from "react";

import {
  STUDYDATE_SIGNAL_EVENT,
  getMyRealtimeTopic,
  subscribePrivateChannel,
  type StudyDateSignal,
} from "@/components/realtime/private-channel";

/**
 * Satu koneksi pribadi per pengguna. Dipasang sekali (di lonceng notifikasi), lalu
 * diteruskan sebagai event jendela supaya komponen lain tidak membuka channel baru.
 */
export function useUserSignals(onSignal: (signal: StudyDateSignal) => void) {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onSignal);

  useEffect(() => {
    handler.current = onSignal;
  }, [onSignal]);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    void getMyRealtimeTopic().then((topic) => {
      if (cancelled || !topic) return;
      stop = subscribePrivateChannel({
        topic,
        events: ["notification"],
        onStatus: setConnected,
        onSignal: (_event, payload) => {
          const type = typeof payload.type === "string" ? payload.type.slice(0, 64) : "";
          const signal = { type };
          handler.current(signal);
          window.dispatchEvent(new CustomEvent<StudyDateSignal>(STUDYDATE_SIGNAL_EVENT, { detail: signal }));
        },
      });
    });
    return () => {
      cancelled = true;
      stop?.();
      setConnected(false);
    };
  }, []);

  return connected;
}
