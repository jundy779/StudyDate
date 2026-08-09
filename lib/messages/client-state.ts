export type ClientChatMessage = {
  message_id: string;
  body: string;
  is_mine: boolean;
  created_at: string;
  read_at: string | null;
  moderation_status: "visible" | "removed";
};

export const CHAT_NEAR_BOTTOM_PX = 100;

export function mergeChatMessages(
  current: ClientChatMessage[],
  incoming: ClientChatMessage[],
) {
  const unique = new Map(current.map((message) => [message.message_id, message]));
  for (const message of incoming) {
    unique.set(message.message_id, message);
  }
  return [...unique.values()].sort(
    (left, right) =>
      Date.parse(left.created_at) - Date.parse(right.created_at) ||
      left.message_id.localeCompare(right.message_id),
  );
}

export function isNearChatBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
) {
  return scrollHeight - scrollTop - clientHeight <= CHAT_NEAR_BOTTOM_PX;
}

export function getCharacterThresholdAnnouncement(
  length: number,
  maximum: number,
) {
  const remaining = maximum - length;
  if (remaining === 100) return "100 karakter tersisa.";
  if (remaining === 20) return "20 karakter tersisa.";
  if (remaining === 0) return "Batas karakter tercapai.";
  return "";
}

export function nextPollDelay(
  failures: number,
  baseDelay: number,
  maximumDelay: number,
) {
  return Math.min(baseDelay * 2 ** Math.max(0, failures), maximumDelay);
}
