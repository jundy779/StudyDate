import { createOnboardingOptions } from "./shared.ts";

/**
 * Seed / fallback campus labels when DB catalog is empty or unavailable.
 * Live list prefers approved rows from `campus_options` after migration.
 */
export const SEED_CAMPUS_LABELS = [
  "BINUS UNIVERSITY",
  "IPB University",
  "Institut Teknologi Bandung",
  "Institut Teknologi Sepuluh Nopember",
  "Sekolah Tinggi Teknologi Terpadu Nurul Fikri",
  "Telkom University",
  "Universitas Airlangga",
  "Universitas Andalas",
  "Universitas Atma Jaya Yogyakarta",
  "Universitas Brawijaya",
  "Universitas Diponegoro",
  "Universitas Gadjah Mada",
  "Universitas Gunadarma",
  "Universitas Hasanuddin",
  "Universitas Indonesia",
  "Universitas Indraprasta PGRI",
  "Universitas Islam Indonesia",
  "Universitas Islam Negeri Syarif Hidayatullah",
  "Universitas Mercu Buana",
  "Universitas Muhammadiyah Malang",
  "Universitas Multimedia Nusantara",
  "Universitas Negeri Jakarta",
  "Universitas Negeri Malang",
  "Universitas Negeri Semarang",
  "Universitas Negeri Surabaya",
  "Universitas Negeri Yogyakarta",
  "Universitas Padjadjaran",
  "Universitas Pelita Harapan",
  "Universitas Sebelas Maret",
  "Universitas Sriwijaya",
  "Universitas Sumatera Utara",
  "Universitas Trisakti",
] as const;

export const CAMPUS_PROVIDER_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "Sekolah Tinggi Teknologi Terpadu Nurul Fikri": [
    "STT Terpadu Nurul Fikri",
  ],
};

/** @deprecated Prefer loadApprovedCampusOptions(); kept for tests/fallback. */
export const CAMPUS_OPTIONS = createOnboardingOptions(SEED_CAMPUS_LABELS);

export function mergeCampusLabels(
  ...labelGroups: readonly (readonly string[])[]
) {
  return createOnboardingOptions(labelGroups.flat());
}
