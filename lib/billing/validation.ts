import { z } from "zod";
import { PLUS_PACKAGE_CODES } from "../membership/limits.ts";

export const billingOfferSchema = z
  .object({
    packageCode: z.enum(PLUS_PACKAGE_CODES),
    amountIdr: z.coerce.number().int().min(1).max(10_000_000),
    isActive: z.preprocess((value) => value === "true" || value === true, z.boolean()),
  })
  .strict();

export const plusPackageCodeSchema = z.enum(PLUS_PACKAGE_CODES);

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
