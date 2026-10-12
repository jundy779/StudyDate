import type {
  ChatReactionValue,
  ChatStickerId,
} from "@/features/chat/types";

export const chatReactions: Array<{
  value: ChatReactionValue;
  emoji: string;
  label: string;
}> = [
  { value: "like", emoji: "👍", label: "Suka" },
  { value: "love", emoji: "❤️", label: "Suka banget" },
  { value: "laugh", emoji: "😂", label: "Lucu" },
  { value: "support", emoji: "🙌", label: "Dukung" },
  { value: "celebrate", emoji: "🎉", label: "Rayakan" },
];

export const chatStickers: Array<{
  id: ChatStickerId;
  emoji: string;
  label: string;
  fallbackText: string;
}> = [
  { id: "studydate_hello", emoji: "👋", label: "Halo", fallbackText: "Stiker StudyDate: Halo 👋" },
  { id: "studydate_study", emoji: "📚", label: "Semangat belajar", fallbackText: "Stiker StudyDate: Semangat belajar 📚" },
  { id: "studydate_chat", emoji: "💬", label: "Yuk ngobrol", fallbackText: "Stiker StudyDate: Yuk ngobrol 💬" },
  { id: "studydate_ready", emoji: "✨", label: "Siap", fallbackText: "Stiker StudyDate: Siap ✨" },
];

export function getChatReaction(value: ChatReactionValue) {
  return chatReactions.find((reaction) => reaction.value === value) ?? null;
}

export function getChatSticker(id: string | null) {
  return chatStickers.find((sticker) => sticker.id === id) ?? null;
}
