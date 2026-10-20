import { z } from "zod";

/**
 * Aturan setelah acara. Harus sama dengan migration 202610210004:
 * ulasan 14 hari, komentar 3 sampai 800 karakter, rekap 20 sampai 3000 karakter,
 * nama sertifikat 2 sampai 80 karakter tanpa angka dan simbol.
 */
export const EVENT_FEEDBACK_WINDOW_DAYS = 14;
export const EVENT_FEEDBACK_COMMENT_MIN = 3;
export const EVENT_FEEDBACK_COMMENT_MAX = 800;
export const EVENT_FEEDBACK_COMMENTS_THRESHOLD = 3;
export const EVENT_RECAP_MIN = 20;
export const EVENT_RECAP_MAX = 3000;
export const CERTIFICATE_NAME_MIN = 2;
export const CERTIFICATE_NAME_MAX = 80;
export const CERTIFICATE_CODE_PATTERN =
  /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;

const slug = z.string().regex(/^event-[0-9a-f]{24}$/);
const noHtml = (value: string) => !/<[^>]+>/.test(value);

export function normalizeCertificateName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isValidCertificateName(value: string) {
  return (
    value.length >= CERTIFICATE_NAME_MIN &&
    value.length <= CERTIFICATE_NAME_MAX &&
    !/[\u0000-\u001f\u007f]/.test(value) &&
    !/[0-9<>{}[\]\\/@#$%^&*_=+|~`":;?!]/.test(value) &&
    !/\s{2,}/.test(value)
  );
}

export function normalizeCertificateCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export const eventFeedbackSchema = z
  .object({
    publicSlug: slug,
    rating: z.coerce.number().int().min(1, "Pilih nilai 1 sampai 5.").max(5),
    comment: z
      .string()
      .trim()
      .max(EVENT_FEEDBACK_COMMENT_MAX, "Komentar maksimal 800 karakter.")
      .refine(noHtml, "Komentar harus berupa teks biasa.")
      .refine(
        (value) => value === "" || value.length >= EVENT_FEEDBACK_COMMENT_MIN,
        "Komentar terlalu pendek.",
      ),
    wouldAttendAgain: z.enum(["yes", "no", ""]),
  })
  .strict();

export const eventRecapSchema = z
  .object({
    publicSlug: slug,
    body: z
      .string()
      .trim()
      .max(EVENT_RECAP_MAX, "Rekap maksimal 3000 karakter.")
      .refine(noHtml, "Rekap harus berupa teks biasa.")
      .refine(
        (value) => value === "" || value.length >= EVENT_RECAP_MIN,
        "Rekap minimal 20 karakter.",
      ),
  })
  .strict();

export const eventCertificateSettingsSchema = z
  .object({
    publicSlug: slug,
    enabled: z.boolean(),
    eligibility: z.enum(["checked_in", "registered"]),
    requiresFeedback: z.boolean(),
  })
  .strict();

export const eventCertificateClaimSchema = z
  .object({
    publicSlug: slug,
    recipientName: z
      .string()
      .transform(normalizeCertificateName)
      .refine(
        isValidCertificateName,
        "Tulis nama 2 sampai 80 huruf, tanpa angka atau simbol.",
      ),
    confirmsPublicName: z.literal(true, {
      error: "Centang persetujuan bahwa nama ini tampil di halaman cek sertifikat.",
    }),
  })
  .strict();

export type CertificateBlocker =
  | "disabled"
  | "not_ended"
  | "window_closed"
  | "organizer"
  | "not_registered"
  | "revoked_by_organizer"
  | "not_checked_in"
  | "feedback_required";

export const CERTIFICATE_BLOCKER_COPY: Record<CertificateBlocker, string> = {
  disabled: "Penyelenggara tidak menyediakan sertifikat untuk acara ini.",
  not_ended: "Sertifikat bisa diambil setelah acara selesai.",
  window_closed: "Masa pengambilan sertifikat sudah lewat 180 hari.",
  organizer: "Penyelenggara tidak menerima sertifikat peserta.",
  not_registered: "Sertifikat hanya untuk peserta yang terdaftar.",
  revoked_by_organizer: "Sertifikatmu dicabut penyelenggara. Hubungi penyelenggara lewat chat acara.",
  not_checked_in: "Sertifikat acara ini hanya untuk peserta yang tercatat hadir saat check-in.",
  feedback_required: "Isi ulasan dulu, lalu sertifikat bisa diambil.",
};

export const CERTIFICATE_BASIS_LABELS = {
  checked_in: "Hadir dan tercatat check-in",
  registered: "Terdaftar sebagai peserta",
} as const;

export function ratingDistributionPercent(counts: number[]) {
  const total = counts.reduce((sum, value) => sum + value, 0);
  return counts.map((value) => (total ? Math.round((value / total) * 100) : 0));
}
