export const CHAT_REACTION_VALUES = [
  "like",
  "love",
  "laugh",
  "support",
  "celebrate",
] as const;

export type ChatReactionValue =
  (typeof CHAT_REACTION_VALUES)[number];

export const CHAT_REACTIONS: ReadonlyArray<{
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

export type ChatReactionSummary = {
  reaction: ChatReactionValue;
  count: number;
  reacted_by_me: boolean;
};

const reactionByValue = new Map(
  CHAT_REACTIONS.map((reaction) => [reaction.value, reaction]),
);

export function getChatReaction(value: ChatReactionValue) {
  return reactionByValue.get(value) ?? null;
}
