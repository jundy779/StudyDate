import { z } from "zod";

export const notificationPublicIdSchema = z
  .string()
  .regex(/^[0-9a-f]{32}$/);

export const notificationCursorSchema = z
  .object({
    beforeCreatedAt: z.iso.datetime({ offset: true }),
    beforePublicId: notificationPublicIdSchema,
  })
  .or(
    z.object({
      beforeCreatedAt: z.undefined(),
      beforePublicId: z.undefined(),
    }),
  );
