import "server-only";

export {
  createTelegramLinkToken,
  decryptTelegramRoute,
  encryptTelegramRoute,
  fingerprintTelegramIdentity,
  hashTelegramLinkToken,
  isTelegramCompanionCryptoConfigured,
  normalizeTelegramBytea,
  TELEGRAM_DEFAULT_KEY_VERSION,
  TELEGRAM_ENCRYPTION_KEY_ENV,
  TELEGRAM_HMAC_KEY_ENV,
  TELEGRAM_KEY_VERSION_ENV,
  type TelegramEncryptedRoute,
} from "@/lib/telegram/crypto-core";
