import { z } from "zod";
import {
  EVENT_CITY_MAX,
  EVENT_CITY_MIN,
  EVENT_VENUE_AREA_MAX,
  EVENT_VENUE_AREA_MIN,
  EVENT_VENUE_NAME_MAX,
  EVENT_VENUE_NAME_MIN,
} from "../events/constants.ts";
import {
  MEETING_TIMEZONES,
  MEETING_VENUE_CATEGORIES,
} from "./constants.ts";
import { conversationPublicIdSchema } from "../messages/validation.ts";

const localDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const noPreciseLocation =
  /(?:https?:\/\/|maps\.|[-+]?\d{1,3}\.\d{3,}[, ]+[-+]?\d{1,3}\.\d{3,})/i;
const plainLocation = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !/<[^>]+>/.test(value) && !noPreciseLocation.test(value));

export const meetingPlanPublicIdSchema = z.string().regex(/^[0-9a-f]{32}$/);

export const proposeMeetingPlanSchema = z
  .object({
    publicId: conversationPublicIdSchema,
    venueCategory: z.enum(MEETING_VENUE_CATEGORIES),
    venueName: plainLocation(EVENT_VENUE_NAME_MIN, EVENT_VENUE_NAME_MAX),
    venueArea: plainLocation(EVENT_VENUE_AREA_MIN, EVENT_VENUE_AREA_MAX),
    city: plainLocation(EVENT_CITY_MIN, EVENT_CITY_MAX),
    startsAtLocal: z.string().regex(localDateTime),
    expectedEndAtLocal: z.string().regex(localDateTime),
    timezone: z.enum(MEETING_TIMEZONES),
    confirmsPublicPlace: z.literal(true),
    confirmsExpectedOperating: z.literal(true),
    confirmsNotPrivateResidence: z.literal(true),
    confirmsNoPrivateLocationDisclosure: z.literal(true),
  })
  .strict()
  .refine(
    (value) => value.startsAtLocal < value.expectedEndAtLocal,
    "Waktu selesai harus setelah waktu mulai.",
  );

export const meetingPlanActionSchema = z
  .object({ publicId: conversationPublicIdSchema, planPublicId: meetingPlanPublicIdSchema })
  .strict();

export const meetingPostcheckSchema = meetingPlanActionSchema
  .extend({ status: z.enum(["safe", "report_started"]) })
  .strict();
