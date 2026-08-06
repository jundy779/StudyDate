import { z } from "zod";
import { peopleAliasSchema } from "../people/validation.ts";
import {
  CONTACT_DISCLOSURE_MESSAGE,
  INTRODUCTION_MESSAGE_MAX,
  INTRODUCTION_MESSAGE_MIN,
  REPORT_REASON_CODES,
} from "./constants.ts";

const contactPatterns = [
  /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i,
  /https?:\/\/|www\.|t\.me\/|telegram\.me\/|wa\.me\/|bit\.ly\/|tinyurl\.com\/|instagram\.com\//i,
  /whatsapp|telegram|instagram|\binsta\b|discord\.gg/i,
  /@[a-z0-9_]{3,}/i,
];

export function normalizeIntroductionMessage(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function openingMessageHasContact(value: string) {
  const normalized = normalizeIntroductionMessage(value).toLowerCase();
  if (contactPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const digits = normalized.replace(/[^0-9]/g, "");
  return digits.length >= 8;
}

export const openingMessageSchema = z
  .string()
  .transform(normalizeIntroductionMessage)
  .pipe(
    z
      .string()
      .min(INTRODUCTION_MESSAGE_MIN, {
        message: `Tulis minimal ${INTRODUCTION_MESSAGE_MIN} karakter.`,
      })
      .max(INTRODUCTION_MESSAGE_MAX, {
        message: `Maksimal ${INTRODUCTION_MESSAGE_MAX} karakter.`,
      })
      .refine((value) => !openingMessageHasContact(value), {
        message: CONTACT_DISCLOSURE_MESSAGE,
      }),
  );

export const sendIntroductionSchema = z.object({
  recipientAlias: peopleAliasSchema,
  openingMessage: openingMessageSchema,
});

export const introductionRequestIdSchema = z.string().uuid();

export const reportIntroductionSchema = z.object({
  requestId: introductionRequestIdSchema,
  reasonCode: z.enum(REPORT_REASON_CODES),
  details: z.preprocess((value) => {
    if (typeof value !== "string") return undefined;
    const normalized = normalizeIntroductionMessage(value);
    return normalized.length > 0 ? normalized : undefined;
  }, z
    .string()
    .max(300)
    .refine((value) => !openingMessageHasContact(value), {
      message: CONTACT_DISCLOSURE_MESSAGE,
    })
    .optional()),
});

export type SendIntroductionInput = z.infer<typeof sendIntroductionSchema>;
export type ReportIntroductionInput = z.infer<typeof reportIntroductionSchema>;
