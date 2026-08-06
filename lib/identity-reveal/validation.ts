import { z } from "zod";
import { conversationPublicIdSchema } from "../messages/validation.ts";

const firstNameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2)
      .max(40)
      .refine(
        (value) =>
          !/(https?:\/\/|www\.|@|\+?\d{8,}|<[^>]+>)/i.test(value) &&
          /^[\p{L}\p{M}][\p{L}\p{M}'’\- ]*[\p{L}\p{M}]$/u.test(value),
        "invalid first name",
      ),
  );

export const identityRevealConsentSchema = z.object({
  publicId: conversationPublicIdSchema,
  profileVersionId: z.string().uuid(),
});

export const identityRevealWithdrawSchema = z.object({
  publicId: conversationPublicIdSchema,
});

export const identityRevealProfileSchema = z.object({
  publicId: conversationPublicIdSchema,
  firstName: firstNameSchema,
});

export type IdentityRevealConsentInput = z.infer<
  typeof identityRevealConsentSchema
>;
export type IdentityRevealProfileInput = z.infer<
  typeof identityRevealProfileSchema
>;
