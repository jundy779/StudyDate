export const CHAT_MESSAGE_MIN = 1;
export const CHAT_MESSAGE_MAX = 1000;

export const CHAT_RATE_LIMITS = {
  perMinute: 20,
  perDay: 300,
  duplicateWindowSeconds: 8,
} as const;

export const CONVERSATION_STATUSES = [
  "awaiting_chat",
  "active",
  "ended",
  "blocked",
] as const;

export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  awaiting_chat: "Siap dimulai",
  active: "Aktif",
  ended: "Berakhir",
  blocked: "Tidak tersedia",
};

export const CHAT_CONTACT_MESSAGE =
  "Simpan informasi kontak untuk tahap berikutnya. Kenali satu sama lain lewat percakapan anonim terlebih dahulu.";

export const CHAT_RATE_LIMIT_MESSAGE =
  "Kamu sudah mengirim beberapa pesan. Tunggu sebentar agar percakapan tetap nyaman.";

export const GENERIC_CHAT_ERROR =
  "Pesan belum dapat diproses. Coba lagi sebentar.";

export const CONVERSATION_CLOSED_MESSAGE =
  "Percakapan ini telah berakhir. Pesan baru tidak dapat dikirim.";

export const CONVERSATION_PRIVACY_NOTE =
  "Kalian masih menggunakan identitas anonim. Nama lengkap, foto jelas, dan kontak tetap tertutup sampai keduanya memilih untuk mengenal lebih jauh.";

export {
  REPORT_REASON_CODES,
  REPORT_REASON_LABELS,
  type ReportReasonCode,
} from "../introductions/constants.ts";
