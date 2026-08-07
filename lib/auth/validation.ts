import { z } from "zod";
import {
  isAllowedStudentEmail,
  STUDENT_EMAIL_DOMAIN_ERROR,
} from "./allowed-email-domains.ts";

const emailField = z
  .string()
  .trim()
  .max(254)
  .email("Masukkan alamat email yang valid.")
  .transform((value) => value.toLowerCase());

/** Student magic-link / public signup email (domain allowlist enforced). */
export const magicLinkRequestSchema = z
  .object({
    email: emailField.refine(isAllowedStudentEmail, {
      message: STUDENT_EMAIL_DOMAIN_ERROR,
    }),
  })
  .strict();

/** Staff magic-link — no student domain allowlist. */
export const staffMagicLinkRequestSchema = z
  .object({
    email: emailField,
  })
  .strict();
