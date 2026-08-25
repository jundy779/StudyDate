import { z } from "zod";
import {
  CHAT_CONTACT_MESSAGE,
  CHAT_MESSAGE_MAX,
  CHAT_MESSAGE_MIN,
  REPORT_REASON_CODES,
} from "./constants.ts";
import { openingMessageHasContact } from "../introductions/validation.ts";
import { CHAT_STICKER_IDS } from "./stickers.ts";

export function normalizeChatMessage(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const conversationPublicIdSchema = z
  .string()
  .regex(/^[0-9a-f]{32}$/, "Percakapan tidak ditemukan.");

export const chatMessageSchema = z
  .string()
  .transform(normalizeChatMessage)
  .pipe(
    z
      .string()
      .min(CHAT_MESSAGE_MIN, { message: "Tulis pesan singkat terlebih dahulu." })
      .max(CHAT_MESSAGE_MAX, {
        message: `Maksimal ${CHAT_MESSAGE_MAX} karakter.`,
      })
      .refine((value) => !openingMessageHasContact(value), {
        message: CHAT_CONTACT_MESSAGE,
      }),
  );

export const sendChatMessageSchema = z.object({
  publicId: conversationPublicIdSchema,
  body: chatMessageSchema,
  idempotencyKey: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,64}$/)
    .optional(),
});

export const sendChatStickerSchema = z.object({
  publicId: conversationPublicIdSchema,
  stickerId: z.enum(CHAT_STICKER_IDS),
  idempotencyKey: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,64}$/)
    .optional(),
});

export const reportConversationSchema = z.object({
  publicId: conversationPublicIdSchema,
  reasonCode: z.enum(REPORT_REASON_CODES),
  details: z.preprocess((value) => {
    if (typeof value !== "string") return undefined;
    const normalized = normalizeChatMessage(value);
    return normalized.length > 0 ? normalized : undefined;
  }, z
    .string()
    .max(300)
    .refine((value) => !openingMessageHasContact(value), {
      message: CHAT_CONTACT_MESSAGE,
    })
    .optional()),
  messageId: z.string().uuid().optional(),
});

export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;
export type SendChatStickerInput = z.infer<typeof sendChatStickerSchema>;
export type ReportConversationInput = z.infer<typeof reportConversationSchema>;
