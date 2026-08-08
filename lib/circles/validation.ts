import {
  CIRCLE_DESCRIPTION_MAX,
  CIRCLE_DESCRIPTION_MIN,
  CIRCLE_MEMBER_MAX,
  CIRCLE_MEMBER_MIN,
  CIRCLE_MESSAGE_MAX,
  CIRCLE_NAME_MAX,
  CIRCLE_NAME_MIN,
  CIRCLE_TOPICS,
} from "./constants.ts";
import { z } from "zod";

const topicValues = CIRCLE_TOPICS.map((topic) => topic.value);
const plainText = (message: string) =>
  z.string().trim().refine((value) => !/<[^>]+>/.test(value), message);

export const circleSlugSchema = z
  .string()
  .regex(/^circle-[0-9a-f]{24}$/);

export const circleFormSchema = z
  .object({
    name: plainText("Nama Circle harus berupa teks biasa.")
      .min(CIRCLE_NAME_MIN, `Nama minimal ${CIRCLE_NAME_MIN} karakter.`)
      .max(CIRCLE_NAME_MAX, `Nama maksimal ${CIRCLE_NAME_MAX} karakter.`),
    description: plainText("Deskripsi harus berupa teks biasa.")
      .min(
        CIRCLE_DESCRIPTION_MIN,
        `Deskripsi minimal ${CIRCLE_DESCRIPTION_MIN} karakter.`,
      )
      .max(
        CIRCLE_DESCRIPTION_MAX,
        `Deskripsi maksimal ${CIRCLE_DESCRIPTION_MAX} karakter.`,
      ),
    topic: z.enum(topicValues),
    scope: z.enum(["open", "campus"]),
    memberLimit: z.coerce
      .number()
      .int()
      .min(CIRCLE_MEMBER_MIN)
      .max(CIRCLE_MEMBER_MAX),
  })
  .strict();

export const circleFiltersSchema = z
  .object({
    search: z
      .preprocess(
        (value) =>
          typeof value === "string" && value.trim()
            ? value.trim().replace(/\s+/g, " ")
            : undefined,
        z.string().max(80).optional(),
      ),
    topic: z.enum(topicValues).optional(),
    scope: z.enum(["open", "campus"]).optional(),
    before: z
      .preprocess(
        (value) =>
          typeof value === "string" && value.trim() ? value.trim() : undefined,
        z.iso.datetime({ offset: true }).optional(),
      ),
    cursor: z
      .preprocess(
        (value) =>
          typeof value === "string" && value.trim() ? value.trim() : undefined,
        circleSlugSchema.optional(),
      ),
  })
  .strict()
  .refine(
    (value) => Boolean(value.before) === Boolean(value.cursor),
    "Cursor Circle tidak valid.",
  );

export const circleMessageSchema = z
  .object({
    publicSlug: circleSlugSchema,
    body: plainText("Pesan harus berupa teks biasa.")
      .min(1, "Tulis pesan terlebih dahulu.")
      .max(CIRCLE_MESSAGE_MAX, `Pesan maksimal ${CIRCLE_MESSAGE_MAX} karakter.`),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,80}$/),
  })
  .strict();

export const circleMemberActionSchema = z
  .object({
    publicSlug: circleSlugSchema,
    memberAlias: z.string().regex(/^Partner #[0-9]{6}$/),
  })
  .strict();

export const circleReportSchema = z
  .object({
    publicSlug: circleSlugSchema,
    memberAlias: z.string().regex(/^Partner #[0-9]{6}$/).optional(),
    messagePublicId: z.string().regex(/^[0-9a-f]{32}$/).optional(),
    reasonCode: z.enum([
      "harassment",
      "spam",
      "contact_pressure",
      "fake_or_misleading",
      "other",
    ]),
    details: z
      .preprocess(
        (value) =>
          typeof value === "string" && value.trim() ? value.trim() : undefined,
        z.string().max(300).optional(),
      ),
  })
  .strict()
  .refine(
    (value) => !value.messagePublicId || Boolean(value.memberAlias),
    "Pesan yang dilaporkan harus memiliki anggota terkait.",
  );

export type CircleFormInput = z.infer<typeof circleFormSchema>;
export type CircleFilters = z.infer<typeof circleFiltersSchema>;
export type CircleReportInput = z.infer<typeof circleReportSchema>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCircleFilters(
  values: Record<string, string | string[] | undefined>,
) {
  return circleFiltersSchema.safeParse({
    search: firstValue(values.search),
    topic: firstValue(values.topic),
    scope: firstValue(values.scope),
    before: firstValue(values.before),
    cursor: firstValue(values.cursor),
  });
}
