export const TELEGRAM_BOT_USERNAME = "StudyDateBot";
export const TELEGRAM_LINK_TTL_SECONDS = 600;
export const TELEGRAM_WEBHOOK_MAX_BYTES = 16_384;
export const TELEGRAM_MESSAGE =
  "Fitur lanjut lewat Telegram belum dapat digunakan. Coba lagi beberapa saat.";

export type TelegramCompanionState =
  | "not_connected"
  | "link_created"
  | "telegram_pending"
  | "connected"
  | "switch_required"
  | "unavailable";

export type TelegramSafeState = {
  state: TelegramCompanionState;
  linkSessionPublicId: string | null;
  expiresAt: string | null;
  connected: boolean;
  activeOnThisConversation: boolean;
  activeOnAnotherConversation: boolean;
};
