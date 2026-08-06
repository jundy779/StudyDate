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
  mutualTitle: "Mutual interest tercapai",
  mutualBody:
    "Kalian sama-sama ingin kenal lebih jauh. Lanjutkan dengan tetap menjaga privasi. Pengungkapan identitas akan tersedia di tahap terpisah.",
  notReadyNote:
    "Kenal lebih jauh tersedia setelah kalian saling membalas pesan.",
  closedNote: "Pilihan kenal lebih jauh tidak tersedia untuk percakapan ini.",
  genericError: "Pilihan belum dapat diproses. Coba lagi sebentar.",
  loading: "Memuat pilihan…",
} as const;
