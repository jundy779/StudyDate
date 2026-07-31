import { z } from "zod";

const trimmed = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

export const degreeLevels = [
  "diploma",
  "sarjana",
  "magister",
  "doktor",
  "profesi",
  "spesialis",
] as const;

export const verificationSubmissionSchema = z
  .object({
    nim: z
      .string()
      .trim()
      .min(4)
      .max(32)
      .regex(/^[A-Za-z0-9./-]+$/)
      .refine((value) => normalizeNim(value).length >= 4),
    legalName: trimmed(2, 160),
    campus: trimmed(2, 120),
    studyProgram: trimmed(2, 120),
    degreeLevel: z.enum(degreeLevels),
    method: z.enum(["campus_email", "student_card"]),
    consent: z.literal("true"),
  })
  .strict();

export const campusEmailSchema = z
  .object({
    requestId: z.uuid(),
    email: z.email().trim().max(254),
  })
  .strict()
  .transform((value) => ({
    ...value,
    email: value.email.toLowerCase(),
  }));

export const campusEmailCodeSchema = z
  .object({
    requestId: z.uuid(),
    code: z.string().regex(/^\d{6}$/),
  })
  .strict();

export function normalizeNim(value: string) {
  return value.trim().toUpperCase().replace(/[\s./-]+/g, "");
}
