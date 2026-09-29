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
  heading: "Bagikan nama dan foto",
  description:
    "Bagikan nama depan dan foto profil hanya setelah kalian berdua memberikan persetujuan.",
  privacyNote:
    "Persetujuanmu tetap privat sampai proses selesai. Nama lengkap dan kontak tidak ikut dibuka.",
  prepareCta: "Siapkan identitas yang ingin dibagikan",
  firstNameLabel: "Nama depan yang ingin kamu tampilkan",
  firstNameHint:
    "Gunakan nama depan yang nyaman kamu bagikan. Nama ini tidak diperiksa sebagai nama resmi.",
  photoLabel: "Foto profil",
  photoHint:
    "Unggah foto wajah yang jelas (JPEG, PNG, atau WebP, maks. 5 MB). Bukan verifikasi biometrik.",
  saveProfileCta: "Simpan nama dan foto",
  consentCta: "Setuju bagikan nama dan foto",
  withdrawCta: "Batalkan persetujuan",
  selectedNote:
    "Persetujuanmu tersimpan. Persetujuan tetap privat sampai proses selesai.",
  completedTitle: "Nama dan foto sudah dibagikan",
  completedBody:
    "Kalian sekarang dapat melihat nama depan dan foto profil satu sama lain. Informasi kontak tetap tertutup.",
  completedBlockedBody:
    "Identitas lawan bicara tidak lagi tersedia setelah pemblokiran. Informasi yang sudah sempat dilihat tidak dapat dihapus dari perangkat lain.",
  closedNote: "Berbagi nama dan foto tidak tersedia untuk percakapan ini.",
  notReadyNote:
    "Kamu dapat berbagi nama dan foto setelah kalian sama-sama ingin kenal lebih jauh dan percakapan masih aktif.",
  genericError: "Nama dan foto belum dapat dibagikan. Coba lagi sebentar.",
  photoError: "Foto belum dapat diproses. Periksa format dan ukuran, lalu coba lagi.",
  loading: "Memuat nama dan foto…",
  mineLabel: "Nama dan fotomu",
  counterpartLabel: "Nama dan foto teman bicaramu",
  counterpartUnavailable: "Tidak tersedia",
} as const;

export const IDENTITY_REVEAL_PHOTO_BUCKET = "identity-reveal-photos";
export const IDENTITY_REVEAL_MAX_BYTES = 5 * 1024 * 1024;
export const IDENTITY_REVEAL_MIN_DIMENSION = 64;
export const IDENTITY_REVEAL_MAX_DIMENSION = 4096;
export const IDENTITY_REVEAL_OUTPUT_MAX_EDGE = 1280;
