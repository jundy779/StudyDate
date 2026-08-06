export type IdentityRevealState = {
  eligible: boolean;
  hasProfile: boolean;
  selectedByMe: boolean;
  completed: boolean;
  completedAt: string | null;
  canWithdraw: boolean;
};

export type IdentityRevealProfilePreview = {
  profileVersionId: string;
  firstName: string;
  photoReady: boolean;
  createdAt: string;
};

export type IdentityRevealCompleted = {
  completed: boolean;
  completedAt: string | null;
  mineFirstName: string | null;
  counterpartFirstName: string | null;
};

export const IDENTITY_REVEAL_COPY = {
  heading: "Buka identitas secara bertahap",
  description:
    "Bagikan nama depan dan foto profil hanya setelah kalian berdua memberikan persetujuan.",
  privacyNote:
    "Persetujuanmu tetap privat sampai proses selesai. Nama lengkap dan kontak tidak ikut dibuka.",
  prepareCta: "Siapkan identitas yang ingin dibagikan",
  firstNameLabel: "Nama depan yang ingin kamu tampilkan",
  firstNameHint:
    "Ini bukan nama legal terverifikasi. Pakai nama depan yang kamu nyaman bagikan.",
  photoLabel: "Foto profil",
  photoHint:
    "Unggah foto wajah yang jelas (JPEG, PNG, atau WebP, maks. 5 MB). Bukan verifikasi biometrik.",
  saveProfileCta: "Simpan identitas",
  consentCta: "Setujui Pembukaan Identitas",
  withdrawCta: "Batalkan persetujuan",
  selectedNote:
    "Persetujuanmu tersimpan. Persetujuan tetap privat sampai proses selesai.",
  completedTitle: "Identitas telah dibuka",
  completedBody:
    "Kalian sekarang dapat melihat nama depan dan foto profil satu sama lain. Informasi kontak tetap tertutup.",
  closedNote: "Pembukaan identitas tidak tersedia untuk percakapan ini.",
  notReadyNote:
    "Pembukaan identitas tersedia setelah Mutual Interest selesai dan percakapan masih aktif.",
  genericError: "Pembukaan identitas belum dapat diproses. Coba lagi sebentar.",
  photoError: "Foto belum dapat diproses. Periksa format dan ukuran, lalu coba lagi.",
  loading: "Memuat pembukaan identitas…",
  mineLabel: "Identitasmu",
  counterpartLabel: "Identitas lawan bicara",
} as const;

export const IDENTITY_REVEAL_PHOTO_BUCKET = "identity-reveal-photos";
export const IDENTITY_REVEAL_MAX_BYTES = 5 * 1024 * 1024;
export const IDENTITY_REVEAL_MIN_DIMENSION = 64;
export const IDENTITY_REVEAL_MAX_DIMENSION = 4096;
export const IDENTITY_REVEAL_OUTPUT_MAX_EDGE = 1280;
