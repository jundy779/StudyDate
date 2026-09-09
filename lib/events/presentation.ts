import {
  EVENT_CATEGORIES,
  EVENT_VENUE_CATEGORIES,
} from "@/lib/events/constants";

export const EVENT_CATEGORY_LABELS: Record<
  (typeof EVENT_CATEGORIES)[number],
  string
> = {
  study_together: "Belajar bareng",
  coding_tech: "Teknologi & coding",
  design: "Desain",
  languages: "Bahasa",
  thesis: "Skripsi & tesis",
  exam_prep: "Persiapan ujian",
  workshop: "Workshop",
  discussion: "Diskusi",
  networking: "Karier & jejaring",
  community: "Komunitas",
  other: "Lainnya",
};

export const EVENT_VENUE_LABELS: Record<
  (typeof EVENT_VENUE_CATEGORIES)[number],
  string
> = {
  campus_public_area: "Area publik kampus",
  cafe: "Kafe",
  library: "Perpustakaan",
  coworking_space: "Coworking space",
  community_space: "Ruang komunitas",
  other_public_place: "Tempat umum lainnya",
};

export function formatEventDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function formatEventDay(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: timezone,
  }).formatToParts(new Date(value));
}

export function eventTimezoneLabel(timezone: string) {
  if (timezone === "Asia/Makassar") return "WITA";
  if (timezone === "Asia/Jayapura") return "WIT";
  return "WIB";
}
