import { createOnboardingOptions } from "./shared.ts";

/**
 * Seed / fallback study-program labels when DB catalog is empty or unavailable.
 */
export const SEED_STUDY_PROGRAM_LABELS = [
  "Administrasi Bisnis",
  "Akuntansi",
  "Arsitektur",
  "Biologi",
  "Desain Komunikasi Visual",
  "Ekonomi Pembangunan",
  "Farmasi",
  "Fisika",
  "Gizi",
  "Hubungan Internasional",
  "Hukum",
  "Ilmu Komputer",
  "Ilmu Komunikasi",
  "Kedokteran",
  "Keperawatan",
  "Kimia",
  "Manajemen",
  "Matematika",
  "Pendidikan Bahasa Inggris",
  "Pendidikan Guru Sekolah Dasar",
  "Perencanaan Wilayah dan Kota",
  "Psikologi",
  "Sastra Indonesia",
  "Sastra Inggris",
  "Sistem Informasi",
  "Statistika",
  "Teknik Elektro",
  "Teknik Industri",
  "Teknik Informatika",
  "Teknik Kimia",
  "Teknik Lingkungan",
  "Teknik Mesin",
  "Teknik Sipil",
  "Teknologi Informasi",
] as const;

/** @deprecated Prefer loadApprovedStudyProgramOptions(); kept for tests/fallback. */
export const STUDY_PROGRAM_OPTIONS = createOnboardingOptions(
  SEED_STUDY_PROGRAM_LABELS,
);

export function mergeStudyProgramLabels(
  ...labelGroups: readonly (readonly string[])[]
) {
  return createOnboardingOptions(labelGroups.flat());
}
