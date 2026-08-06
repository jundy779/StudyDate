export const INTRODUCTION_MESSAGE_MIN = 12;
export const INTRODUCTION_MESSAGE_MAX = 300;

export const INTRODUCTION_RATE_LIMITS = {
  perHour: 5,
  perDay: 15,
  maxPendingOutgoing: 5,
  cooldownDays: 7,
  expiryDays: 14,
} as const;

export const INTRODUCTION_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "expired",
] as const;

export type IntroductionStatus = (typeof INTRODUCTION_STATUSES)[number];

export const INTRODUCTION_STATUS_LABELS: Record<IntroductionStatus, string> = {
  pending: "Menunggu jawaban",
  accepted: "Perkenalan diterima",
  declined: "Perkenalan ditolak",
  cancelled: "Dibatalkan",
  expired: "Kedaluarsa",
};

export const REPORT_REASON_CODES = [
  "harassment",
  "spam",
  "contact_pressure",
  "fake_or_misleading",
  "other",
] as const;

export type ReportReasonCode = (typeof REPORT_REASON_CODES)[number];

export const REPORT_REASON_LABELS: Record<ReportReasonCode, string> = {
  harassment: "Perilaku tidak nyaman",
  spam: "Spam atau berulang",
  contact_pressure: "Mendesak untuk berbagi kontak",
  fake_or_misleading: "Profil atau pesan menyesatkan",
  other: "Alasan lain",
};

export const CONTACT_DISCLOSURE_MESSAGE =
  "Simpan informasi kontak untuk nanti. Mulai dengan perkenalan singkat tentang minat atau tujuanmu.";

export const RATE_LIMIT_MESSAGE =
  "Kamu sudah mengirim beberapa perkenalan. Coba lagi nanti agar percakapan tetap nyaman untuk semua.";

export const GENERIC_INTRODUCTION_ERROR =
  "Perkenalan belum dapat diproses. Coba lagi sebentar.";
