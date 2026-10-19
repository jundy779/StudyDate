import "server-only";

import { createHash } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { hashTicketCode, mapTicketingError, normalizeTicketCode } from "@/lib/events/ticketing";

export type TicketDiscountCode = {
  code_public_id: string; code_hint: string; purpose: "discount" | "unlock";
  discount_type: "fixed" | "percent" | null; discount_value: number;
  max_redemptions: number | null; redemption_count: number;
  starts_at: string | null; ends_at: string | null; status: "active" | "paused" | "expired"; created_at: string;
};

export type ManagedTicketOrder = {
  order_public_id: string; ticket_name: string; quantity: number;
  status: string; subtotal_amount: number; discount_amount: number; total_amount: number;
  currency: "IDR"; created_at: string; expires_at: string | null; paid_at: string | null; refunded_amount: number;
};

export async function listTicketDiscountCodes(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_campus_event_discount_codes", { p_event_public_slug: publicSlug });
  if (error) throw new Error(mapTicketingError(error.message));
  return (data ?? []) as TicketDiscountCode[];
}

export async function saveTicketDiscountCode(publicSlug: string, input: {
  codePublicId: string | null; code: string | null; purpose: "discount" | "unlock";
  discountType: "fixed" | "percent" | null; discountValue: number;
  maxRedemptions: number | null; startsAt: string | null; endsAt: string | null;
  status: "active" | "paused" | "expired";
}) {
  const normalized = input.code ? normalizeTicketCode(input.code) : null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_campus_event_discount_code", {
    p_event_public_slug: publicSlug, p_code_public_id: input.codePublicId,
    p_code_hash: normalized ? hashTicketCode(normalized) : null,
    p_code_hint: normalized ? `${normalized.slice(0, 2)}••${normalized.slice(-2)}` : "••••",
    p_purpose: input.purpose, p_discount_type: input.purpose === "unlock" ? null : input.discountType,
    p_discount_value: input.purpose === "unlock" ? 0 : input.discountValue,
    p_max_redemptions: input.maxRedemptions, p_starts_at: input.startsAt,
    p_ends_at: input.endsAt, p_status: input.status,
  });
  if (error) throw new Error(mapTicketingError(error.message));
  return data as string;
}

export async function listManagedTicketOrders(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_campus_event_ticket_orders", { p_event_public_slug: publicSlug });
  if (error) throw new Error(mapTicketingError(error.message));
  return (data ?? []) as ManagedTicketOrder[];
}

export async function cancelMyTicketOrder(orderPublicId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_my_campus_event_ticket_order", { p_order_public_id: orderPublicId });
  if (error) throw new Error(mapTicketingError(error.message));
  return Boolean(data);
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service belum dikonfigurasi.");
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function expireTicketOrders(limit = 500) {
  const { data, error } = await serviceClient().rpc("expire_campus_event_ticket_orders", { p_limit: limit });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export function hashPaymentPayload(rawBody: string) {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}
