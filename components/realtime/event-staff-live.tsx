"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { subscribePrivateChannel } from "@/components/realtime/private-channel";

/**
 * Untuk penyelenggara dan petugas check-in: angka pendaftaran dan kehadiran ikut
 * berubah tanpa memuat ulang halaman. Hanya pengguna yang berhak mengelola acara
 * yang bisa masuk channel ini (dicek database). Kalau koneksi gagal, halaman tetap
 * bekerja seperti biasa.
 */
export function EventStaffLive({ publicSlug }: { publicSlug: string }) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!/^event-[0-9a-f]{24}$/.test(publicSlug)) return;
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
      }, 1000);
    }
    function onVisibility() {
      if (!document.hidden && pending) {
        pending = false;
        router.refresh();
      }
    }

    const stop = subscribePrivateChannel({
      topic: `event-staff:${publicSlug}`,
      events: ["registration_changed"],
      onStatus: setConnected,
      onSignal: refreshSoon,
    });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      setConnected(false);
    };
  }, [publicSlug, router]);

  if (!connected) return null;
  return (
    <p className="inline-flex items-center gap-2 text-xs font-semibold text-[#157F3B]" role="status">
      <span className="h-2 w-2 rounded-full bg-[#157F3B] motion-safe:animate-pulse" aria-hidden="true" />
      Angka diperbarui otomatis
    </p>
  );
}
