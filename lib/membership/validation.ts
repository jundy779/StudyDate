import { z } from "zod";
import { MEMBERSHIP_GRANT_DAYS } from "./limits";
export { billingOfferSchema } from "@/lib/billing/validation";

export const membershipEmailLookupSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(254)
      .email("Masukkan alamat email yang valid."),
  })
  .strict();

export const membershipGrantSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(254)
      .email("Masukkan alamat email yang valid."),
    durationDays: z.coerce
      .number()
      .int()
      .refine(
        (value): value is (typeof MEMBERSHIP_GRANT_DAYS)[number] =>
          (MEMBERSHIP_GRANT_DAYS as readonly number[]).includes(value),
        "Durasi tidak valid.",
      ),
  })
  .strict();

export const membershipRevokeSchema = membershipEmailLookupSchema;
