import { z } from "zod";

export const earlyAccessInterests = ["people", "groups", "events"] as const;
export const earlyAccessSources = ["navbar", "hero", "final-cta"] as const;

export const earlyAccessPayloadSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Email wajib diisi.")
      .max(254, "Email terlalu panjang.")
      .email("Masukkan alamat email yang valid."),
    campus: z
      .string()
      .trim()
      .max(120, "Nama kampus maksimal 120 karakter.")
      .transform((value) => value || null),
    interests: z.array(z.enum(earlyAccessInterests)).max(3),
    source: z.enum(earlyAccessSources),
    consent: z
      .boolean()
      .refine((value) => value, "Persetujuan diperlukan untuk bergabung."),
    website: z.string().max(200),
  })
  .strict();

export type EarlyAccessInput = z.input<typeof earlyAccessPayloadSchema>;
export type EarlyAccessPayload = z.output<typeof earlyAccessPayloadSchema>;
export type EarlyAccessSource = (typeof earlyAccessSources)[number];

export type EarlyAccessFieldErrors = Partial<
  Record<keyof EarlyAccessInput, string>
>;

export function getEarlyAccessFieldErrors(
  error: z.ZodError,
): EarlyAccessFieldErrors {
  const fieldErrors: EarlyAccessFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field === "string" && !(field in fieldErrors)) {
      fieldErrors[field as keyof EarlyAccessInput] = issue.message;
    }
  }

  return fieldErrors;
}
