import { z } from "zod";

const telegramInteger = z.union([
  z.number().int().safe(),
  z.string().regex(/^-?[1-9][0-9]{0,18}$/),
]);

const telegramUser = z
  .object({
    id: telegramInteger,
    is_bot: z.boolean(),
  })
  .passthrough();

const telegramChat = z
  .object({
    id: telegramInteger,
    type: z.string().max(32),
  })
  .passthrough();

const telegramMessage = z
  .object({
    message_id: z.number().int().nonnegative(),
    from: telegramUser.optional(),
    chat: telegramChat,
    text: z.string().max(4_096).optional(),
  })
  .passthrough();

export const telegramUpdateSchema = z
  .object({
    update_id: z.number().int().nonnegative(),
    message: telegramMessage.optional(),
  })
  .passthrough();

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;

export function telegramIntegerString(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }
  if (typeof value === "string" && /^-?[1-9][0-9]{0,18}$/.test(value)) {
    return value;
  }
  return null;
}

export function parseTelegramCommand(text: string | undefined) {
  const normalized = text?.trim() ?? "";
  const match = /^\/([a-z]+)(?:@[A-Za-z0-9_]+)?(?:\s+(\S+))?$/i.exec(
    normalized,
  );
  if (!match) return null;
  return {
    command: match[1]?.toLowerCase() ?? "",
    argument: match[2] ?? null,
  };
}
