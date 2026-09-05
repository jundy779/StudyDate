export const EARLY_ACCESS_REVIEW_REASONS = [
  {
    code: "use_campus_email",
    label: "Gunakan email kampus",
    description: "Gunakan alamat email resmi yang diterbitkan kampus jika tersedia.",
  },
  {
    code: "campus_full_name",
    label: "Tuliskan nama resmi kampus",
    description: "Jangan hanya memakai singkatan; tuliskan nama kampus dengan jelas.",
  },
  {
    code: "incomplete_information",
    label: "Data pendaftaran belum lengkap",
    description: "Lengkapi informasi yang diperlukan agar pendaftaran dapat ditinjau.",
  },
  {
    code: "email_campus_mismatch",
    label: "Email dan kampus perlu dicocokkan",
    description: "Pastikan email dan nama kampus yang dicantumkan konsisten.",
  },
  {
    code: "duplicate_application",
    label: "Pendaftaran terindikasi duplikat",
    description: "Gunakan satu pendaftaran yang paling sesuai dan aktif.",
  },
  {
    code: "eligibility_not_met",
    label: "Belum memenuhi kriteria Early Access",
    description: "Pendaftaran belum sesuai dengan kriteria peserta Beta StudyDate saat ini.",
  },
  {
    code: "other",
    label: "Alasan lainnya",
    description: "Lihat catatan dari tim StudyDate pada email pemberitahuan.",
  },
] as const;

export type EarlyAccessReviewReasonCode =
  (typeof EARLY_ACCESS_REVIEW_REASONS)[number]["code"];

export const EARLY_ACCESS_REVIEW_REASON_CODES = EARLY_ACCESS_REVIEW_REASONS.map(
  (reason) => reason.code,
) as [EarlyAccessReviewReasonCode, ...EarlyAccessReviewReasonCode[]];

export function getEarlyAccessReviewReasonLabel(code: string) {
  return (
    EARLY_ACCESS_REVIEW_REASONS.find((reason) => reason.code === code)?.label ??
    "Informasi pendaftaran perlu ditinjau"
  );
}
