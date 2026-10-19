import "server-only";

import { createClient } from "@/lib/supabase/server";
import { hashTicketCode, mapTicketingError } from "@/lib/events/ticketing";
import type { z } from "zod";
import type { ticketOrderSchema, ticketTypeSchema } from "@/lib/events/ticketing";

export type CampusEventTicketType = {
  ticket_public_id: string;
  name: string;
  description: string;
  access_type: "public" | "code" | "invite_only";
  price_amount: number;
  currency: "IDR";
  quantity_total: number;
  quantity_available: number;
  min_per_order: number;
  max_per_order: number;
  sales_start_at: string | null;
  sales_end_at: string | null;
  status: "draft" | "on_sale" | "paused" | "ended" | "archived";
};

export type CampusEventTicketOrder = {
  order_public_id: string;
  ticket_name: string;
  quantity: number;
  status: "pending" | "paid" | "free" | "expired" | "cancelled" | "refunded" | "partially_refunded";
  total_amount: number;
  currency: "IDR";
  expires_at: string | null;
  created_at: string;
};

export async function listCampusEventTicketTypes(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_campus_event_ticket_types", { p_event_public_slug: publicSlug });
  if (error) throw new Error(mapTicketingError(error.message));
  return (data ?? []) as CampusEventTicketType[];
}

export async function saveCampusEventTicketType(publicSlug: string, input: z.infer<typeof ticketTypeSchema>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_campus_event_ticket_type", {
    p_event_public_slug: publicSlug,
    p_ticket_public_id: input.ticketPublicId,
    p_name: input.name,
    p_description: input.description,
    p_access_type: input.accessType,
    p_price_amount: input.priceAmount,
    p_quantity_total: input.quantityTotal,
    p_min_per_order: input.minPerOrder,
    p_max_per_order: input.maxPerOrder,
    p_sales_start_at: input.salesStartAt || null,
    p_sales_end_at: input.salesEndAt || null,
    p_status: input.status,
  });
  if (error) throw new Error(mapTicketingError(error.message));
  return data as string;
}

export async function createCampusEventTicketOrder(input: z.infer<typeof ticketOrderSchema>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_campus_event_ticket_order", {
    p_event_public_slug: input.eventPublicSlug,
    p_ticket_public_id: input.ticketPublicId,
    p_quantity: input.quantity,
    p_idempotency_key: input.idempotencyKey,
    p_code_hash: hashTicketCode(input.code),
  });
  if (error) throw new Error(mapTicketingError(error.message));
  return ((data ?? [])[0] ?? null) as { order_public_id: string; order_status: string; total_amount: number; expires_at: string | null } | null;
}

export async function listMyCampusEventTicketOrders(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_campus_event_ticket_orders", { p_event_public_slug: publicSlug });
  if (error) throw new Error(mapTicketingError(error.message));
  return (data ?? []) as CampusEventTicketOrder[];
}

export async function myCampusEventRequiresTicketOrder(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_campus_event_requires_ticket_order", { p_public_slug: publicSlug });
  if (error) throw new Error(mapTicketingError(error.message));
  return data === true;
}
