/**
 * Bantuan tampilan antrean Akses Awal. Tidak memutuskan akses; keputusan tetap
 * di database (is_school_email_account, passes_student_verification_gate).
 */
export const EARLY_ACCESS_STALE_DAYS = 7;
export const EARLY_ACCESS_CLAIM_REMINDER_DAYS = 3;
export const EARLY_ACCESS_REMINDER_COOLDOWN_HOURS = 24;

export const EARLY_ACCESS_QUEUES = ["stale_waiting", "pending_claim", "unsent_invitation"] as const;
export type EarlyAccessQueue = (typeof EARLY_ACCESS_QUEUES)[number];
export const EARLY_ACCESS_SORTS = ["priority", "oldest", "newest"] as const;
export type EarlyAccessSort = (typeof EARLY_ACCESS_SORTS)[number];

export type EmailKind = "campus" | "school" | "personal" | "other";

export const EMAIL_KIND_COPY: Record<EmailKind, { label: string; help: string }> = {
  campus: { label: "Email kampus", help: "Verifikasi PDDikti opsional." },
  school: { label: "Email sekolah", help: "Hanya bisa ikut acara edukatif." },
  personal: { label: "Email pribadi", help: "Wajib verifikasi PDDikti saat saklar dinyalakan." },
  other: { label: "Domain lain", help: "Periksa lagi apakah domain ini diterima." },
};

export function classifyEmailDomain(email: string): EmailKind {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  if (domain === "ac.id" || domain.endsWith(".ac.id")) return "campus";
  if (domain === "sch.id" || domain.endsWith(".sch.id")) return "school";
  if (domain === "gmail.com" || domain === "vk.com") return "personal";
  return "other";
}

export function daysSince(value: string | null | undefined, now = Date.now()) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((now - time) / 86_400_000));
}

export function waitingAgeLabel(days: number) {
  if (days === 0) return "Menunggu sejak hari ini";
  if (days === 1) return "Menunggu 1 hari";
  return `Menunggu ${days} hari`;
}

export function isStaleWaiting(status: string, waitingSince: string | null | undefined, now = Date.now()) {
  const days = daysSince(waitingSince, now);
  return status === "waiting" && days !== null && days >= EARLY_ACCESS_STALE_DAYS;
}

/** Undangan sudah terkirim lebih dari 3 hari dan belum dipakai. */
export function needsClaimReminder(
  status: string,
  invitationSentAt: string | null | undefined,
  now = Date.now(),
) {
  const days = daysSince(invitationSentAt, now);
  return status === "approved" && days !== null && days >= EARLY_ACCESS_CLAIM_REMINDER_DAYS;
}

export function canSendReminder(invitationSentAt: string | null | undefined, now = Date.now()) {
  if (!invitationSentAt) return false;
  return now - new Date(invitationSentAt).getTime() >= EARLY_ACCESS_REMINDER_COOLDOWN_HOURS * 3_600_000;
}

/** Waktu acuan satu kali render halaman server antrean. */
export function queueReferenceTime() {
  return Date.now();
}
