export const MODERATION_STATUSES = [
  "submitted",
  "under_review",
  "resolved",
  "dismissed",
] as const;

export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const MODERATION_STATUS_LABELS: Record<ModerationStatus, string> = {
  submitted: "Baru",
  under_review: "Sedang ditinjau",
  resolved: "Selesai",
  dismissed: "Diabaikan",
};

export const MODERATION_TARGET_LABELS: Record<string, string> = {
  introduction: "Perkenalan",
  conversation: "Percakapan",
  message: "Pesan",
  other: "Lainnya",
};

export const MODERATION_COPY = {
  heading: "Moderasi laporan",
  description:
    "Antrean laporan peserta. Moderator tidak membaca seluruh riwayat chat atau Contact Reveal.",
  empty: "Tidak ada laporan pada filter ini.",
  loading: "Menyiapkan antrean moderasi…",
  genericError: "Laporan belum dapat diproses. Coba lagi sebentar.",
  noteLabel: "Catatan internal (opsional)",
  noteHint: "Teks biasa, maksimal 500 karakter. Tidak terlihat oleh mahasiswa.",
  unresolvedLabel: "Belum selesai",
} as const;

export const INTERNAL_NOTE_MAX = 500;
