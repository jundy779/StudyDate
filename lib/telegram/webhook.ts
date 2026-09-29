import "server-only";

import { createServerAdminClient } from "@/lib/supabase/admin";
import { sendTelegramText } from "@/lib/telegram/bot-api";
import {
  encryptTelegramRoute,
  fingerprintTelegramIdentity,
  hashTelegramLinkToken,
} from "@/lib/telegram/crypto";
import {
  parseTelegramCommand,
  telegramIntegerString,
  type TelegramUpdate,
} from "@/lib/telegram/validation";

const COPY = {
  pending: "Kembali ke StudyDate untuk menyelesaikan koneksi.",
  privateOnly: "StudyDateBot hanya digunakan melalui chat pribadi.",
  help:
    "StudyDateBot meneruskan pesan teks ke percakapan StudyDate yang sudah ada. Gunakan /unlink untuk memutuskan koneksi Telegram. Atur privasi dan informasi yang ingin dibagikan melalui StudyDate.",
  unlinked:
    "Koneksi Telegram telah diputus. Riwayat percakapan StudyDate tetap tersimpan.",
  unsupported:
    "Untuk sekarang, fitur lanjut lewat Telegram hanya mendukung pesan teks.",
  unavailable: "Percakapan ini tidak lagi tersedia melalui Telegram.",
  relayed: "Pesan diteruskan ke percakapan StudyDate.",
} as const;

async function recordOutcome(updateId: number, outcome: string) {
  const admin = createServerAdminClient();
  if (!admin) throw new Error("Telegram webhook is unavailable.");
  const { data, error } = await admin.rpc("record_telegram_update_outcome", {
    p_update_id: updateId,
    p_outcome: outcome,
  });
  if (error) throw new Error("Telegram webhook is unavailable.");
  return data === true;
}

async function reply(chatId: string, text: string) {
  await sendTelegramText(chatId, text);
}

export async function processTelegramUpdate(update: TelegramUpdate) {
  const message = update.message;
  if (!message) {
    await recordOutcome(update.update_id, "unsupported");
    return;
  }

  const chatId = telegramIntegerString(message.chat.id);
  if (!chatId) {
    await recordOutcome(update.update_id, "invalid");
    return;
  }
  if (message.chat.type !== "private") {
    await recordOutcome(update.update_id, "private_chat_required");
    return;
  }

  const telegramUserId = telegramIntegerString(message.from?.id);
  if (!telegramUserId || message.from?.is_bot) {
    await recordOutcome(update.update_id, "invalid");
    return;
  }

  const command = parseTelegramCommand(message.text);
  const identityFingerprint = fingerprintTelegramIdentity(telegramUserId);
  const admin = createServerAdminClient();
  if (!admin) throw new Error("Telegram webhook is unavailable.");

  if (command?.command === "start" && command.argument) {
    let tokenHash: string;
    try {
      tokenHash = hashTelegramLinkToken(command.argument);
    } catch {
      if (await recordOutcome(update.update_id, "invalid")) {
        await reply(chatId, COPY.unavailable);
      }
      return;
    }
    const encrypted = encryptTelegramRoute(chatId);
    const { data, error } = await admin.rpc("accept_telegram_link_token", {
      p_update_id: update.update_id,
      p_token_hash: tokenHash,
      p_identity_fingerprint: identityFingerprint,
      p_route_ciphertext: encrypted.ciphertext,
      p_route_iv: encrypted.iv,
      p_route_auth_tag: encrypted.authTag,
      p_key_version: encrypted.keyVersion,
    });
    if (error) throw new Error("Telegram webhook is unavailable.");
    if (!error && data === "link_pending") await reply(chatId, COPY.pending);
    else if (!error && data !== "duplicate") await reply(chatId, COPY.unavailable);
    return;
  }

  if (command?.command === "help" || command?.command === "start") {
    if (await recordOutcome(update.update_id, "help")) {
      await reply(chatId, COPY.help);
    }
    return;
  }

  if (command?.command === "unlink") {
    const { data, error } = await admin.rpc(
      "unlink_telegram_companion_by_fingerprint",
      {
        p_update_id: update.update_id,
        p_identity_fingerprint: identityFingerprint,
      },
    );
    if (error) throw new Error("Telegram webhook is unavailable.");
    if (!error && data === "unlinked") await reply(chatId, COPY.unlinked);
    return;
  }

  if (command) {
    if (await recordOutcome(update.update_id, "unsupported")) {
      await reply(chatId, COPY.help);
    }
    return;
  }

  if (typeof message.text !== "string") {
    if (await recordOutcome(update.update_id, "unsupported")) {
      await reply(chatId, COPY.unsupported);
    }
    return;
  }

  const { data, error } = await admin.rpc(
    "send_anonymous_message_from_telegram",
    {
      p_update_id: update.update_id,
      p_identity_fingerprint: identityFingerprint,
      p_body: message.text,
    },
  );
  if (error) throw new Error("Telegram webhook is unavailable.");
  if (!error && data === "message_created") await reply(chatId, COPY.relayed);
  else if (!error && data === "invalid") await reply(chatId, COPY.unsupported);
  else if (!error && data !== "duplicate") await reply(chatId, COPY.unavailable);
}
