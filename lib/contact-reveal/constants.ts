export const CONTACT_REVEAL_CHANNELS = [
  "telegram",
  "instagram",
  "linkedin",
] as const;

export type ContactRevealChannel = (typeof CONTACT_REVEAL_CHANNELS)[number];

/** Display / preference order: LinkedIn first (required on profile), then IG, then Telegram. */
export const CONTACT_REVEAL_CHANNEL_DISPLAY_ORDER: readonly ContactRevealChannel[] =
  ["linkedin", "instagram", "telegram"];

export type ContactRevealChannelState = {
  channel: ContactRevealChannel;
  eligible: boolean;
  hasContact: boolean;
  selectedByMe: boolean;
  completed: boolean;
  completedAt: string | null;
  canWithdraw: boolean;
};

export type ContactRevealState = {
  channels: ContactRevealChannelState[];
};

export type ContactRevealPreview = {
  contactVersionId: string;
  channel: ContactRevealChannel;
  displayValue: string;
  createdAt: string;
};

export type ContactRevealCompletedChannel = {
  channel: ContactRevealChannel;
  completed: boolean;
  completedAt: string | null;
  mineDisplay: string | null;
  counterpartDisplay: string | null;
  mineHref: string | null;
  counterpartHref: string | null;
};

export const CONTACT_REVEAL_COPY = {
  heading: "Bagikan kontak secara bertahap",
  description:
    "LinkedIn diprioritaskan; Instagram dan Telegram opsional. Setiap jenis kontak membutuhkan persetujuan dua arah. Membagikan satu kontak tidak akan membuka kontak lainnya.",
  privacyNote:
    "Pilihanmu tetap privat sampai kalian berdua menyetujui jenis kontak yang sama.",
  addContactCta: "Tambahkan kontak",
  replaceCta: "Ganti kontak",
  withdrawCta: "Batalkan persetujuan",
  selectedNote: "Persetujuanmu tetap privat.",
  completedTitle: "Kontak telah dibagikan",
  completedBody:
    "Kalian sekarang dapat melihat kontak yang disetujui untuk saluran ini. Saluran lain tetap tertutup sampai ada persetujuan dua arah.",
  completedBlockedBody:
    "Kontak lawan bicara tidak lagi tersedia setelah pemblokiran. Informasi yang sudah sempat dilihat tidak dapat dihapus dari perangkat lain.",
  closedNote: "Pembagian kontak tidak tersedia untuk percakapan ini.",
  notReadyNote:
    "Pembagian kontak tersedia setelah Identity Reveal selesai dan percakapan masih aktif.",
  genericError: "Pembagian kontak belum dapat diproses. Coba lagi sebentar.",
  validationError:
    "Kontak belum dapat disimpan. Periksa formatnya, lalu coba lagi.",
  loading: "Memuat pembagian kontak…",
  mineLabel: "Kontakmu",
  counterpartLabel: "Kontak lawan bicara",
  counterpartUnavailable: "Tidak tersedia",
  channelLabels: {
    telegram: "Telegram",
    instagram: "Instagram",
    linkedin: "LinkedIn",
  },
  consentCtas: {
    telegram: "Setujui berbagi Telegram",
    instagram: "Setujui berbagi Instagram",
    linkedin: "Setujui berbagi LinkedIn",
  },
  inputLabels: {
    telegram: "Username Telegram",
    instagram: "Username Instagram",
    linkedin: "URL profil LinkedIn",
  },
  inputHints: {
    telegram: "Tanpa @. Huruf, angka, dan underscore (5–32 karakter).",
    instagram: "Tanpa @. Huruf, angka, titik, dan underscore (1–30 karakter).",
    linkedin: "URL HTTPS profil publik LinkedIn berbentuk /in/nama-profil.",
  },
} as const;

export function emptyContactRevealState(): ContactRevealState {
  return {
    channels: CONTACT_REVEAL_CHANNELS.map((channel) => ({
      channel,
      eligible: false,
      hasContact: false,
      selectedByMe: false,
      completed: false,
      completedAt: null,
      canWithdraw: false,
    })),
  };
}
