export type MutualInterestState = {
  eligible: boolean;
  selectedByMe: boolean;
  mutual: boolean;
  mutualAt: string | null;
  canWithdraw: boolean;
};

export const MUTUAL_INTEREST_COPY = {
  selectCta: "Kenal Lebih Jauh",
  privacyNote: "Pilihanmu tetap privat",
  selectedNote:
    "Pilihanmu tersimpan. Pilihan tetap privat sampai kalian sama-sama memilih.",
  withdrawCta: "Batalkan pilihan",
  mutualTitle: "Kalian sama-sama tertarik",
  mutualBody:
    "Kalian sama-sama ingin kenal lebih jauh. Tetap jaga privasi. Nama dan foto dapat dibagikan lewat pilihan terpisah setelah ini.",
  notReadyNote:
    "Kenal lebih jauh tersedia setelah kalian saling membalas pesan.",
  closedNote: "Pilihan kenal lebih jauh tidak tersedia untuk percakapan ini.",
  genericError: "Pilihan belum dapat diproses. Coba lagi sebentar.",
  loading: "Memuat pilihan…",
} as const;
