export const CHAT_STICKERS = [
  {
    id: "studydate_hello",
    label: "Halo",
    src: "/brand/mascot/hello.png",
    alt: "Maskot StudyDate melambaikan tangan",
    fallbackText: "Stiker StudyDate: Halo 👋",
  },
  {
    id: "studydate_study",
    label: "Semangat belajar",
    src: "/brand/mascot/study.png",
    alt: "Maskot StudyDate sedang belajar dengan laptop dan buku",
    fallbackText: "Stiker StudyDate: Semangat belajar 📚",
  },
  {
    id: "studydate_chat",
    label: "Yuk ngobrol",
    src: "/brand/mascot/chat.png",
    alt: "Maskot StudyDate memegang ponsel untuk mengobrol",
    fallbackText: "Stiker StudyDate: Yuk ngobrol 💬",
  },
  {
    id: "studydate_ready",
    label: "Siap",
    src: "/brand/mascot/front.png",
    alt: "Maskot StudyDate berdiri siap",
    fallbackText: "Stiker StudyDate: Siap ✨",
  },
] as const;

export type ChatStickerId = (typeof CHAT_STICKERS)[number]["id"];

export const CHAT_STICKER_IDS = CHAT_STICKERS.map((sticker) => sticker.id) as [
  ChatStickerId,
  ...ChatStickerId[],
];

const CHAT_STICKER_BY_ID = new Map(
  CHAT_STICKERS.map((sticker) => [sticker.id, sticker] as const),
);

export function getChatStickerById(id: string | null | undefined) {
  if (!id) return null;
  return CHAT_STICKER_BY_ID.get(id as ChatStickerId) ?? null;
}

export const CHAT_EMOJI_SHORTLIST = [
  "😀",
  "😂",
  "🥹",
  "😊",
  "😍",
  "🤝",
  "👍",
  "🙏",
  "👏",
  "🔥",
  "✨",
  "🎉",
  "💬",
  "📚",
  "💡",
  "☕",
  "💙",
  "😴",
] as const;
