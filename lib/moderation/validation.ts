import { z } from "zod";
import {
  INTERNAL_NOTE_MAX,
  MODERATION_STATUSES,
} from "./constants";

export const moderationStatusUpdateSchema = z.object({
  reportId: z.string().uuid(),
  newStatus: z.enum(["under_review", "resolved", "dismissed"]),
  internalNote: z
    .string()
    .max(INTERNAL_NOTE_MAX)
    .optional()
    .transform((value) => {
      const trimmed = value?.trim() ?? "";
      return trimmed.length ? trimmed : undefined;
    }),
});

export const moderationFilterSchema = z
  .enum(MODERATION_STATUSES)
  .optional()
  .or(z.literal("").transform(() => undefined));
