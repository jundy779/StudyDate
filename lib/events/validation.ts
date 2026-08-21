import { z } from "zod";
import {
  EVENT_CAPACITY_MAX,
  EVENT_CAPACITY_MIN,
  EVENT_CATEGORIES,
  EVENT_DESCRIPTION_MAX,
  EVENT_DESCRIPTION_MIN,
  EVENT_REPORT_REASONS,
  EVENT_SCOPES,
  EVENT_TIMEZONES,
  EVENT_TITLE_MAX,
  EVENT_TITLE_MIN,
  EVENT_VENUE_AREA_MAX,
  EVENT_VENUE_AREA_MIN,
  EVENT_VENUE_CATEGORIES,
  EVENT_VENUE_NAME_MAX,
  EVENT_VENUE_NAME_MIN,
  EVENT_CITY_MAX,
  EVENT_CITY_MIN,
} from "./constants.ts";

const localDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const plainText = (message: string) =>
  z.string().trim().refine((value) => !/<[^>]+>/.test(value), message);

export const eventSlugSchema = z.string().regex(/^event-[0-9a-f]{24}$/);
export const eventMessageSchema = z
  .object({
    publicSlug: eventSlugSchema,
    body: plainText("Pesan harus berupa teks biasa.").min(1).max(800),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,80}$/),
  })
  .strict();

export const eventCircleLinkSchema = z
  .object({
    eventPublicSlug: eventSlugSchema,
    circlePublicSlug: z
      .union([z.string().regex(/^circle-[0-9a-f]{24}$/), z.literal("")])
      .transform((value) => value || null),
  })
  .strict();

export const eventTicketCheckInSchema = z
  .object({
    publicSlug: eventSlugSchema,
    ticketToken: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

const eventFields = {
  title: plainText("Judul harus berupa teks biasa.")
      .min(EVENT_TITLE_MIN, `Judul minimal ${EVENT_TITLE_MIN} karakter.`)
      .max(EVENT_TITLE_MAX, `Judul maksimal ${EVENT_TITLE_MAX} karakter.`),
  description: plainText("Deskripsi harus berupa teks biasa.")
      .min(
        EVENT_DESCRIPTION_MIN,
        `Deskripsi minimal ${EVENT_DESCRIPTION_MIN} karakter.`,
      )
      .max(
        EVENT_DESCRIPTION_MAX,
        `Deskripsi maksimal ${EVENT_DESCRIPTION_MAX} karakter.`,
      ),
  category: z.enum(EVENT_CATEGORIES),
  scope: z.enum(EVENT_SCOPES),
    startsAtLocal: z
      .string()
      .regex(localDateTime, "Waktu mulai tidak valid."),
    endsAtLocal: z
      .string()
      .regex(localDateTime, "Waktu selesai tidak valid."),
  timezone: z.enum(EVENT_TIMEZONES),
  venueCategory: z.enum(EVENT_VENUE_CATEGORIES),
  venueName: plainText("Nama tempat harus berupa teks biasa.")
      .min(EVENT_VENUE_NAME_MIN, "Nama tempat terlalu pendek.")
      .max(EVENT_VENUE_NAME_MAX, "Nama tempat terlalu panjang."),
  venueArea: plainText("Area/alamat publik harus berupa teks biasa.")
      .min(EVENT_VENUE_AREA_MIN, "Alamat atau area publik terlalu pendek.")
      .max(EVENT_VENUE_AREA_MAX, "Alamat atau area publik terlalu panjang."),
  city: plainText("Kota harus berupa teks biasa.")
      .min(EVENT_CITY_MIN, "Nama kota terlalu pendek.")
      .max(EVENT_CITY_MAX, "Nama kota terlalu panjang."),
  capacity: z.coerce
    .number()
    .int()
    .min(EVENT_CAPACITY_MIN)
    .max(EVENT_CAPACITY_MAX),
  confirmsPublicPlace: z.literal(true),
  confirmsExpectedOperating: z.literal(true),
  confirmsNotPrivateResidence: z.literal(true),
  confirmsNoPrivateLocationDisclosure: z.literal(true),
};

const validTimeOrder = (value: {
  startsAtLocal: string;
  endsAtLocal: string;
}) => value.startsAtLocal < value.endsAtLocal;

const eventObjectSchema = z.object(eventFields).strict();

export const eventFormSchema = eventObjectSchema
  .refine(validTimeOrder, "Waktu selesai harus setelah waktu mulai.");

export const eventUpdateSchema = eventObjectSchema
  .omit({ scope: true })
  .refine(validTimeOrder, "Waktu selesai harus setelah waktu mulai.");

export const eventFiltersSchema = z
  .object({
    search: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim()
          ? value.trim().replace(/\s+/g, " ")
          : undefined,
      z.string().max(100).optional(),
    ),
    category: z.enum(EVENT_CATEGORIES).optional(),
    scope: z.enum(EVENT_SCOPES).optional(),
    before: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() ? value.trim() : undefined,
      z.iso.datetime({ offset: true }).optional(),
    ),
    cursor: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() ? value.trim() : undefined,
      eventSlugSchema.optional(),
    ),
  })
  .strict()
  .refine(
    (value) => Boolean(value.before) === Boolean(value.cursor),
    "Cursor Event tidak valid.",
  );

export const eventReportSchema = z
  .object({
    publicSlug: eventSlugSchema,
    reasonCode: z.enum(EVENT_REPORT_REASONS),
    details: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() ? value.trim() : undefined,
      plainText("Detail laporan harus berupa teks biasa.").max(300).optional(),
    ),
  })
  .strict();

export const eventMessageReportSchema = eventReportSchema.extend({
  messagePublicId: z.string().regex(/^[0-9a-f]{32}$/),
}).strict();

export type EventFormInput = z.infer<typeof eventFormSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
export type EventFilters = z.infer<typeof eventFiltersSchema>;
export type EventReportInput = z.infer<typeof eventReportSchema>;
export type EventMessageReportInput = z.infer<typeof eventMessageReportSchema>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseEventFilters(
  values: Record<string, string | string[] | undefined>,
) {
  return eventFiltersSchema.safeParse({
    search: firstValue(values.search),
    category: firstValue(values.category),
    scope: firstValue(values.scope),
    before: firstValue(values.before),
    cursor: firstValue(values.cursor),
  });
}
