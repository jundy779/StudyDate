"use client";

import { PublicEventCard } from "@/components/events/public-event-card";
import {
  SAVED_EVENTS_CHANGED_EVENT,
  readSavedEventSlugs,
} from "@/lib/events/saved-events";
import type { PublicCampusEvent } from "@/lib/events/public-service";
import { Bookmark, CalendarDays } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

function subscribeToSavedEvents(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(SAVED_EVENTS_CHANGED_EVENT, listener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(SAVED_EVENTS_CHANGED_EVENT, listener);
  };
}

function readSavedSnapshot() {
  try {
    return readSavedEventSlugs(window.localStorage).join("\n");
  } catch {
    return "";
  }
}

export function PublicEventList({
  events,
  savedOnly,
  categorySelected,
}: {
  events: PublicCampusEvent[];
  savedOnly: boolean;
  categorySelected: boolean;
}) {
  const savedSnapshot = useSyncExternalStore(
    subscribeToSavedEvents,
    readSavedSnapshot,
    () => "",
  );
  const savedSlugs = new Set(savedSnapshot ? savedSnapshot.split("\n") : []);
  const visibleEvents = savedOnly
    ? events.filter((event) => savedSlugs.has(event.public_slug))
    : events;

  if (visibleEvents.length) {
    return (
      <div className="mt-9">
        {savedOnly ? (
          <p className="mb-6 text-sm leading-6 text-brand-muted">
            Menampilkan acara tersimpan yang masih akan datang. Daftar ini tersimpan
            di perangkat yang sedang kamu gunakan.
          </p>
        ) : null}
        {visibleEvents.map((event) => (
          <PublicEventCard key={event.public_slug} event={event} />
        ))}
      </div>
    );
  }

  const Icon = savedOnly ? Bookmark : CalendarDays;

  return (
    <div className="py-16 text-center">
      <Icon className="mx-auto h-10 w-10 text-brand-blue" aria-hidden="true" />
      <h2 className="mt-5 font-heading text-2xl font-semibold text-brand-navy">
        {savedOnly
          ? "Belum ada acara yang kamu simpan"
          : "Belum ada acara resmi pada pilihan ini"}
      </h2>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-brand-muted">
        {savedOnly
          ? "Saat menemukan acara yang menarik, tekan Simpan acara. Acara itu akan muncul di sini selama masih berlangsung."
          : "Kami hanya menampilkan acara yang benar-benar tersedia. Coba kategori lain atau kembali lagi setelah ada kegiatan baru."}
      </p>
      {savedOnly || categorySelected ? (
        <Link
          href="/events"
          className="focus-ring mt-6 inline-flex min-h-11 items-center font-semibold text-brand-blue"
        >
          {savedOnly ? "Cari acara untuk disimpan" : "Lihat semua acara"}
        </Link>
      ) : null}
    </div>
  );
}
