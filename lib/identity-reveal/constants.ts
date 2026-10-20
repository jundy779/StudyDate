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
    "Nama depan dan foto baru terbuka setelah kalian berdua sama-sama setuju.",
  privacyNote:
    "Pilihanmu tidak terlihat oleh teman ngobrol sampai dia juga setuju. Nama lengkap dan kontak tetap tertutup.",
  prepareCta: "Pilih nama dan foto",
  firstNameLabel: "Nama depan yang ingin kamu tampilkan",
  firstNameHint:
    "Gunakan nama depan yang nyaman kamu bagikan. Nama ini tidak harus sama dengan nama resmi dan tidak diperiksa sebagai nama resmi.",
  photoLabel: "Foto profil",
  photoHint:
    "Unggah foto wajah yang jelas (JPEG, PNG, atau WebP, maks. 5 MB). Foto ini tidak dipakai untuk mengenali wajah secara otomatis.",
  saveProfileCta: "Simpan nama dan foto",
  consentCta: "Bagikan jika dia juga setuju",
  withdrawCta: "Batalkan pilihan",
  selectedNote:
    "Pilihanmu tersimpan dan belum terlihat oleh teman ngobrol.",
  completedTitle: "Nama dan foto sudah dibagikan",
  completedBody:
    "Kalian sekarang dapat melihat nama depan dan foto profil satu sama lain. Informasi kontak tetap tertutup.",
  completedBlockedBody:
    "Nama dan foto teman ngobrolmu tidak lagi tersedia setelah pemblokiran. Informasi yang sudah sempat dilihat tidak dapat dihapus dari perangkat lain.",
  closedNote: "Berbagi nama dan foto tidak tersedia untuk percakapan ini.",
  notReadyNote:
    "Nama dan foto bisa dibagikan setelah kalian sama-sama memilih Kenal Lebih Jauh.",
  genericError: "Nama dan foto belum dapat dibagikan. Coba lagi sebentar.",
  photoError: "Foto belum dapat diproses. Periksa format dan ukuran, lalu coba lagi.",
  loading: "Memuat nama dan foto…",
  mineLabel: "Nama dan fotomu",
  counterpartLabel: "Nama dan foto teman ngobrolmu",
  counterpartUnavailable: "Tidak tersedia",
} as const;

export const IDENTITY_REVEAL_PHOTO_BUCKET = "identity-reveal-photos";
export const IDENTITY_REVEAL_MAX_BYTES = 5 * 1024 * 1024;
export const IDENTITY_REVEAL_MIN_DIMENSION = 64;
export const IDENTITY_REVEAL_MAX_DIMENSION = 4096;
export const IDENTITY_REVEAL_OUTPUT_MAX_EDGE = 1280;
