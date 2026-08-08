import { normalizeContactValue } from "@/lib/contact-reveal/validation";
import { z } from "zod";

export const profileSocialContactsSchema = z.object({
  linkedinUrl: z
    .string({ error: "LinkedIn wajib diisi." })
    .trim()
    .min(1, "LinkedIn wajib diisi.")
    .transform((value, ctx) => {
      try {
        return normalizeContactValue("linkedin", value);
      } catch {
        ctx.addIssue({
          code: "custom",
          message:
            "Pakai URL profil LinkedIn, contoh https://www.linkedin.com/in/namamu",
        });
        return z.NEVER;
      }
    }),
  instagramUsername: z
    .union([z.string(), z.null()])
    .transform((value, ctx) => {
      if (value == null) return null;
      const trimmed = value.trim();
      if (!trimmed) return null;
      try {
        return normalizeContactValue("instagram", trimmed);
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "Username Instagram tidak valid.",
        });
        return z.NEVER;
      }
    }),
});

export type ProfileSocialContactsInput = z.infer<
  typeof profileSocialContactsSchema
>;

export type StudentSocialContacts = {
  linkedinUrl: string | null;
  instagramUsername: string | null;
};
