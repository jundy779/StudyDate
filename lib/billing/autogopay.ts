import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const BASE_URL = "https://v1-gateway.autogopay.site";
const CHECKOUT_ORIGIN = "https://autogopay.site";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 32_768;

const generateSchema = z
  .object({
    success: z.literal(true),
    data: z
      .object({
        transaction_id: z.string().min(1).max(160),
        order_id: z.string().min(1).max(160),
        amount: z.number().int().min(1).max(10_000_000),
        transaction_status: z.string().max(32),
        checkout_url: z.url(),
        expiry_time: z.string().min(1).max(64),
      })
      .passthrough(),
  })
  .passthrough();

const statusSchema = z
  .object({
    success: z.boolean(),
    data: z
      .object({
        transaction_status: z.string().max(32).optional(),
        status: z.string().max(32).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type AutoGoPayGeneratedPayment = {
  transactionId: string;
  orderId: string;
  amount: number;
  checkoutUrl: string;
  expiresAt: string;
};

function apiKey() {
  const value = process.env.AUTOGOPAY_API_KEY?.trim();
  if (!value) throw new Error("AUTOGOPAY_UNAVAILABLE");
  return value;
}

export function isAutoGoPayEnabled() {
  return process.env.AUTOGOPAY_ENABLED === "true" && Boolean(process.env.AUTOGOPAY_API_KEY?.trim());
}

async function request(path: "/qris/generate" | "/qris/status" | "/qris/cancel", body: object) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("AUTOGOPAY_UNAVAILABLE");
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_RESPONSE_BYTES || !response.body) {
    throw new Error("AUTOGOPAY_INVALID_RESPONSE");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("AUTOGOPAY_INVALID_RESPONSE");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("AUTOGOPAY_INVALID_RESPONSE");
  }
}

export async function generateAutoGoPayQris(amount: number): Promise<AutoGoPayGeneratedPayment> {
  if (!Number.isInteger(amount) || amount < 1 || amount > 10_000_000) {
    throw new Error("AUTOGOPAY_INVALID_AMOUNT");
  }
  const parsed = generateSchema.safeParse(await request("/qris/generate", { amount }));
  if (!parsed.success || parsed.data.data.amount !== amount) {
    throw new Error("AUTOGOPAY_INVALID_RESPONSE");
  }
  const checkout = new URL(parsed.data.data.checkout_url);
  if (checkout.origin !== CHECKOUT_ORIGIN || !/^\/pay\/[A-Za-z0-9_-]{1,200}$/.test(checkout.pathname)) {
    throw new Error("AUTOGOPAY_INVALID_RESPONSE");
  }
  const expiresAt = new Date(parsed.data.data.expiry_time.replace(" ", "T") + "+07:00");
  const now = Date.now();
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now || expiresAt.getTime() > now + 30 * 60_000) {
    throw new Error("AUTOGOPAY_INVALID_RESPONSE");
  }
  return {
    transactionId: parsed.data.data.transaction_id,
    orderId: parsed.data.data.order_id,
    amount,
    checkoutUrl: checkout.toString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getAutoGoPayQrisStatus(transactionId: string) {
  const parsed = statusSchema.safeParse(await request("/qris/status", { transaction_id: transactionId }));
  if (!parsed.success) throw new Error("AUTOGOPAY_INVALID_RESPONSE");
  return (parsed.data.data?.transaction_status ?? parsed.data.data?.status ?? "unknown").toLowerCase();
}

export async function cancelAutoGoPayQris(transactionId: string) {
  const parsed = statusSchema.safeParse(await request("/qris/cancel", { transaction_id: transactionId }));
  if (!parsed.success) throw new Error("AUTOGOPAY_INVALID_RESPONSE");
  return parsed.data.success;
}

export function verifyAutoGoPaySignature(rawBody: Uint8Array, signature: string | null) {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(createHmac("sha256", apiKey()).update(rawBody).digest("hex"), "ascii");
  const supplied = Buffer.from(signature.toLowerCase(), "ascii");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
