import { CONNECTION_GOALS, INTERESTS } from "./constants.ts";
import { z } from "zod";

const goalValues = CONNECTION_GOALS.map((goal) => goal.value) as [
  (typeof CONNECTION_GOALS)[number]["value"],
  ...(typeof CONNECTION_GOALS)[number]["value"][],
];
const interestValues = INTERESTS.map((interest) => interest.value) as [
  (typeof INTERESTS)[number]["value"],
  ...(typeof INTERESTS)[number]["value"][],
];

const optionalTrimmedString = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => (value === "" ? null : value))
    .nullable();

export const onboardingSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    campus: z.string().trim().min(2).max(120),
    studyProgram: z.string().trim().min(2).max(120),
    semester: z
      .union([z.number().int().min(1).max(16), z.null()])
      .default(null),
    cityRegion: optionalTrimmedString(120),
    shortIntro: optionalTrimmedString(300).default(null),
    interests: z
      .array(z.enum(interestValues))
      .min(1)
      .max(6)
      .transform((values) => [...new Set(values)]),
    connectionGoals: z
      .array(z.enum(goalValues))
      .min(1)
      .max(6)
      .transform((values) => [...new Set(values)]),
    preferences: z
      .object({
        onlineFirst: z.boolean(),
        groupFirst: z.boolean(),
        verifiedUsersOnly: z.boolean(),
        sameCampusPreferred: z.boolean(),
        crossCampusAllowed: z.boolean(),
      })
      .strict(),
    consents: z
      .object({
        terms: z.literal(true),
        privacy: z.literal(true),
        communityGuidelines: z.literal(true),
      })
      .strict(),
  })
  .strict();

export type OnboardingInput = z.infer<typeof onboardingSchema>;
