import { z } from "zod";
import { conversationPublicIdSchema } from "../messages/validation.ts";
import {
  CONTACT_REVEAL_CHANNELS,
  type ContactRevealChannel,
} from "./constants.ts";

const channelSchema = z.enum(CONTACT_REVEAL_CHANNELS);

const telegramUsernameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@+/, ""))
  .pipe(
    z
      .string()
      .min(5)
      .max(32)
      .regex(/^[A-Za-z0-9_]+$/, "invalid telegram"),
  );

const instagramUsernameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@+/, ""))
  .pipe(
    z
      .string()
      .min(1)
      .max(30)
      .regex(/^[A-Za-z0-9._]+$/, "invalid instagram")
      .refine((value) => !value.includes(".."), "invalid instagram"),
  );

function normalizeLinkedInUrl(raw: string): string {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("invalid linkedin");
  }
  if (url.protocol !== "https:") {
    throw new Error("invalid linkedin");
  }
  const host = url.hostname.toLowerCase();
  if (host !== "www.linkedin.com" && host !== "linkedin.com") {
    throw new Error("invalid linkedin");
  }
  const match = url.pathname.match(/^\/in\/([A-Za-z0-9][A-Za-z0-9_-]{0,99})\/?$/);
  if (!match) {
    throw new Error("invalid linkedin");
  }
  return `https://www.linkedin.com/in/${match[1]}`;
}

const linkedInUrlSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    try {
      return normalizeLinkedInUrl(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "invalid linkedin" });
      return z.NEVER;
    }
  });

export function normalizeContactValue(
  channel: ContactRevealChannel,
  raw: string,
): string {
  if (channel === "telegram") {
    return telegramUsernameSchema.parse(raw);
  }
  if (channel === "instagram") {
    return instagramUsernameSchema.parse(raw);
  }
  return linkedInUrlSchema.parse(raw);
}

export function formatContactDisplay(
  channel: ContactRevealChannel,
  stored: string,
): string {
  if (channel === "linkedin") return stored;
  return stored.startsWith("@") ? stored : `@${stored}`;
}

export function formatContactHref(
  channel: ContactRevealChannel,
  stored: string,
): string {
  if (channel === "telegram") {
    return `https://t.me/${stored.replace(/^@/, "")}`;
  }
  if (channel === "instagram") {
    return `https://instagram.com/${stored.replace(/^@/, "")}`;
  }
  return stored;
}

export const contactRevealPrepareSchema = z.object({
  publicId: conversationPublicIdSchema,
  channel: channelSchema,
  value: z.string().min(1).max(200),
});

export const contactRevealConsentSchema = z.object({
  publicId: conversationPublicIdSchema,
  channel: channelSchema,
  contactVersionId: z.string().uuid(),
});

export const contactRevealWithdrawSchema = z.object({
  publicId: conversationPublicIdSchema,
  channel: channelSchema,
});

export type ContactRevealPrepareInput = z.infer<
  typeof contactRevealPrepareSchema
>;
