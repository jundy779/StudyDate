import { z } from "zod";

export const magicLinkRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .max(254)
      .email("Masukkan alamat email yang valid.")
      .transform((value) => value.toLowerCase()),
  })
  .strict();
