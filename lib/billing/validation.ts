import { z } from "zod";

export const billingOfferSchema = z
  .object({
    amountIdr: z.coerce.number().int().min(1).max(10_000_000),
    durationDays: z.coerce.number().int().min(1).max(365),
    isActive: z.preprocess((value) => value === "true" || value === true, z.boolean()),
  })
  .strict();

export const paymentOrderPublicIdSchema = z.string().regex(/^[0-9a-f]{32}$/);

export const autoGoPayWebhookSchema = z
  .object({
    event: z.literal("transaction.received"),
    timestamp: z.string().min(1).max(64),
    transaction: z
      .object({
        transaction_id: z.string().min(1).max(160),
        order_id: z.string().min(1).max(160),
        amount: z.number().int().min(1).max(10_000_000),
        status: z.literal("PAID"),
        payment_method: z.literal("QRIS"),
        paid_at: z.string().min(1).max(64),
      })
      .strict(),
  })
  .strict();
