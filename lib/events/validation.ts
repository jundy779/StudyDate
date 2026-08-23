import { z } from "zod";
import {
  EVENT_CAPACITY_MAX,
  EVENT_CAPACITY_MIN,
  EVENT_CATEGORIES,
  EVENT_CHECKIN_STATUSES,
  EVENT_CITY_MAX,
  EVENT_CITY_MIN,
  EVENT_DESCRIPTION_MAX,
  EVENT_DESCRIPTION_MIN,
  EVENT_QUESTION_OPTION_MAX,
  EVENT_QUESTION_OPTIONS_MAX,
  EVENT_QUESTION_PROMPT_MAX,
  EVENT_QUESTION_PROMPT_MIN,
  EVENT_QUESTION_TYPES,
  EVENT_REGISTRATION_ANSWER_MAX_BYTES,
  EVENT_REGISTRATION_MODES,
  EVENT_REGISTRATION_STATUSES,
  EVENT_REPORT_REASONS,
  EVENT_SCOPES,
  EVENT_SHORT_ANSWER_MAX,
  EVENT_TEAM_ROLES,
  EVENT_TICKET_TOKEN_PATTERN,
  EVENT_TIMEZONES,
  EVENT_TITLE_MAX,
  EVENT_TITLE_MIN,
  EVENT_VENUE_AREA_MAX,
  EVENT_VENUE_AREA_MIN,
  EVENT_VENUE_CATEGORIES,
  EVENT_VENUE_NAME_MAX,
  EVENT_VENUE_NAME_MIN,
} from "./constants.ts";

const localDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const opaqueId = /^[0-9a-f]{32}$/;
const plainText = (message: string) =>
  z.string().trim().refine((value) => !/<[^>]+>/.test(value), message);
const optionalTimestamp = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.iso.datetime({ offset: true }).optional(),
);
const safeAlias = plainText("Alias tidak valid.")
  .min(1)
  .max(80)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Alias tidak valid.");
const sensitiveQuestionWords =
  /(^|[^a-z0-9_])(password|kata sandi|otp|one.?time password|nim|nomor induk|nik|ktp|passport|paspor|government id|legal id|alamat rumah|alamat pribadi|private address|home address|auth credential|kredensial|contact reveal|email|e-mail|nomor telepon|nomor hp|phone number|whatsapp|telegram|instagram|linkedin|social handle|username|kampus|campus|program studi|study program|semester|minat|interests)([^a-z0-9_]|$)/i;
const contactAnswerPattern =
  /(?:[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|https?:\/\/|www\.|t\.me\/|telegram\.me\/|wa\.me\/|instagram\.com\/|linkedin\.com\/|@[a-z0-9_]{3,})/i;

export const eventSlugSchema = z.string().regex(/^event-[0-9a-f]{24}$/);
export const eventPublicIdSchema = z.string().regex(opaqueId);
export const eventTicketTokenSchema = z.string().regex(EVENT_TICKET_TOKEN_PATTERN);
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
    ticketToken: eventTicketTokenSchema,
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
  registrationMode: z.enum(EVENT_REGISTRATION_MODES),
  waitlistEnabled: z.boolean(),
  registrationClosesAt: optionalTimestamp,
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
  .refine(validTimeOrder, "Waktu selesai harus setelah waktu mulai.")
  .refine(
    (value) =>
      !value.registrationClosesAt ||
      new Date(value.registrationClosesAt).getTime() <
        new Date(`${value.startsAtLocal}:00${timezoneOffset(value.timezone)}`).getTime(),
    "Penutupan registrasi harus sebelum waktu mulai.",
  );

export const eventUpdateSchema = eventObjectSchema
  .omit({ scope: true })
  .refine(validTimeOrder, "Waktu selesai harus setelah waktu mulai.");

function timezoneOffset(timezone: (typeof EVENT_TIMEZONES)[number]) {
  switch (timezone) {
    case "Asia/Jakarta":
      return "+07:00";
    case "Asia/Makassar":
      return "+08:00";
    case "Asia/Jayapura":
      return "+09:00";
    default: {
      const exhaustive: never = timezone;
      return exhaustive;
    }
  }
}

export const eventQuestionPromptSchema = plainText(
  "Pertanyaan harus berupa teks biasa.",
)
  .min(EVENT_QUESTION_PROMPT_MIN)
  .max(EVENT_QUESTION_PROMPT_MAX)
  .refine(
    (value) => !sensitiveQuestionWords.test(value),
    "Pertanyaan tidak boleh meminta data profil, identitas, kontak, atau kredensial.",
  );

const eventQuestionOptionSchema = plainText(
  "Opsi harus berupa teks biasa.",
)
  .min(1)
  .max(EVENT_QUESTION_OPTION_MAX);

export const eventQuestionCreateSchema = z
  .object({
    publicSlug: eventSlugSchema,
    questionType: z.enum(EVENT_QUESTION_TYPES),
    prompt: eventQuestionPromptSchema,
    options: z.array(eventQuestionOptionSchema).max(EVENT_QUESTION_OPTIONS_MAX),
    isRequired: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    const selection =
      value.questionType === "single_select" ||
      value.questionType === "multi_select";
    if (selection && value.options.length < 2) {
      context.addIssue({
        code: "custom",
        message: "Pertanyaan pilihan memerlukan minimal dua opsi.",
        path: ["options"],
      });
    }
    if (!selection && value.options.length !== 0) {
      context.addIssue({
        code: "custom",
        message: "Jenis pertanyaan ini tidak menerima opsi.",
        path: ["options"],
      });
    }
    if (new Set(value.options).size !== value.options.length) {
      context.addIssue({
        code: "custom",
        message: "Opsi pertanyaan tidak boleh duplikat.",
        path: ["options"],
      });
    }
  });

export const eventQuestionDeleteSchema = z
  .object({
    publicSlug: eventSlugSchema,
    questionPublicId: eventPublicIdSchema,
  })
  .strict();

const registrationAnswerValueSchema = z.union([
  plainText("Jawaban harus berupa teks biasa.")
    .max(EVENT_SHORT_ANSWER_MAX)
    .refine(
      (value) =>
        !contactAnswerPattern.test(value) &&
        !/(?:\D*\d){8,}/.test(value) &&
        !/\b(?:whatsapp|telegram|instagram|linkedin|discord)\b/i.test(value),
      "Jawaban tidak boleh memuat kontak privat.",
    ),
  z.boolean(),
  z
    .array(plainText("Pilihan jawaban tidak valid.").max(EVENT_QUESTION_OPTION_MAX))
    .max(EVENT_QUESTION_OPTIONS_MAX),
]);

export const eventRegistrationAnswersSchema = z
  .record(eventPublicIdSchema, registrationAnswerValueSchema)
  .refine(
    (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      EVENT_REGISTRATION_ANSWER_MAX_BYTES,
    "Jawaban registrasi terlalu besar.",
  );

export const eventRegistrationSchema = z
  .object({
    publicSlug: eventSlugSchema,
    answers: eventRegistrationAnswersSchema,
  })
  .strict();

export const eventRegistrationManageSchema = z
  .object({
    publicSlug: eventSlugSchema,
    registrationPublicId: eventPublicIdSchema,
    action: z.enum(["approve", "decline"]),
  })
  .strict();

export const eventRegistrationSettingsSchema = z
  .object({
    publicSlug: eventSlugSchema,
    registrationMode: z.enum(EVENT_REGISTRATION_MODES),
    waitlistEnabled: z.boolean(),
    registrationClosesAt: optionalTimestamp,
  })
  .strict();

export const eventRegistrationListSchema = z
  .object({
    publicSlug: eventSlugSchema,
    status: z.enum(EVENT_REGISTRATION_STATUSES).optional(),
    beforeRsvpedAt: z.iso.datetime({ offset: true }).optional(),
    beforePublicId: eventPublicIdSchema.optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.beforeRsvpedAt) === Boolean(value.beforePublicId),
    "Cursor registrasi tidak valid.",
  );

export const eventTeamInviteSchema = z
  .object({
    publicSlug: eventSlugSchema,
    publicAlias: safeAlias,
    role: z.enum(EVENT_TEAM_ROLES),
  })
  .strict();

export const eventTeamResponseSchema = z
  .object({
    publicSlug: eventSlugSchema,
    response: z.enum(["accept", "decline"]),
  })
  .strict();

export const eventTeamRemoveSchema = z
  .object({
    publicSlug: eventSlugSchema,
    publicAlias: safeAlias,
  })
  .strict();

export const eventManualCheckInSchema = z
  .object({
    publicSlug: eventSlugSchema,
    registrationPublicId: eventPublicIdSchema,
  })
  .strict();

export const eventCheckInResultSchema = z
  .object({
    status: z.enum(EVENT_CHECKIN_STATUSES),
    attendeeAlias: z.string().max(80).nullable(),
    checkedInAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict();

export const eventOrganizerEligibilityLookupSchema = z
  .object({ publicAlias: safeAlias })
  .strict();

export const eventOrganizerEligibilityManageSchema = z
  .object({
    publicAlias: safeAlias,
    action: z.enum(["grant", "revoke"]),
  })
  .strict();

export const eventOfficialFlagSchema = z
  .object({
    publicSlug: eventSlugSchema,
    isOfficial: z.boolean(),
  })
  .strict();

export const eventTicketIssueSchema = z
  .object({
    publicSlug: eventSlugSchema,
    regenerate: z.boolean(),
  })
  .strict();

export function parseBoundedJson(
  value: FormDataEntryValue | null,
  maxBytes: number,
): unknown {
  if (
    typeof value !== "string" ||
    new TextEncoder().encode(value).byteLength > maxBytes
  ) {
    throw new Error("Payload JSON tidak valid.");
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Payload JSON tidak valid.");
  }
}

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
export type EventQuestionCreateInput = z.infer<typeof eventQuestionCreateSchema>;
export type EventRegistrationInput = z.infer<typeof eventRegistrationSchema>;
export type EventRegistrationManageInput = z.infer<
  typeof eventRegistrationManageSchema
>;
export type EventRegistrationSettingsInput = z.infer<
  typeof eventRegistrationSettingsSchema
>;
export type EventRegistrationListInput = z.infer<
  typeof eventRegistrationListSchema
>;
export type EventTeamInviteInput = z.infer<typeof eventTeamInviteSchema>;

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
