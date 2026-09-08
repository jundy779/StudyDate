export const MODERATION_STATUSES = [
  "submitted",
  "under_review",
  "resolved",
  "dismissed",
] as const;

export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const MODERATION_STATUS_LABELS: Record<ModerationStatus, string> = {
  submitted: "Baru",
  under_review: "Sedang diperiksa",
  resolved: "Selesai",
  dismissed: "Diabaikan",
};

export const MODERATION_TARGET_LABELS: Record<string, string> = {
  introduction: "Perkenalan",
  conversation: "Percakapan",
  message: "Pesan",
  circle: "Circle belajar",
  circle_message: "Pesan circle belajar",
  event: "Acara kampus",
  event_organizer: "Penyelenggara acara kampus",
  event_message: "Pesan acara kampus",
  other: "Lainnya",
};

export const MODERATION_COPY = {
  heading: "Laporan pengguna",
  description:
    "Periksa laporan yang masuk tanpa membuka seluruh riwayat percakapan atau kontak pribadi.",
  empty: "Tidak ada laporan pada filter ini.",
  loading: "Menyiapkan laporan…",
  genericError: "Laporan belum dapat diproses. Coba lagi sebentar.",
  noteLabel: "Catatan internal (opsional)",
  noteHint: "Teks biasa, maksimal 500 karakter. Tidak terlihat oleh mahasiswa.",
  unresolvedLabel: "Belum selesai",
} as const;

export const INTERNAL_NOTE_MAX = 500;
