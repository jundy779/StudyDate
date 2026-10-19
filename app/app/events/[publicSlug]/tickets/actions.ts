"use server";

import { randomUUID } from "node:crypto";
import { createCampusEventTicketOrder, saveCampusEventTicketType } from "@/lib/events/ticketing-service";
import { ticketOrderSchema, ticketTypeSchema } from "@/lib/events/ticketing";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function requiredFlag() {
  if (process.env.EVENT_TICKETING_ENABLED !== "true") throw new Error("Tiket acara belum diaktifkan.");
}

function optional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function saveTicketTypeAction(publicSlug: string, formData: FormData) {
  requiredFlag();
  const parsed = ticketTypeSchema.safeParse({
    ticketPublicId: optional(formData.get("ticketPublicId")), name: formData.get("name"),
    description: formData.get("description"), accessType: formData.get("accessType"),
    priceAmount: formData.get("priceAmount"), quantityTotal: formData.get("quantityTotal"),
    minPerOrder: formData.get("minPerOrder"), maxPerOrder: formData.get("maxPerOrder"),
    salesStartAt: optional(formData.get("salesStartAt")), salesEndAt: optional(formData.get("salesEndAt")),
    status: formData.get("status"),
  });
  if (!parsed.success) redirect(`/app/events/${publicSlug}/manage/tickets?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Periksa data tiket.")}`);
  try { await saveCampusEventTicketType(publicSlug, parsed.data); }
  catch (error) { redirect(`/app/events/${publicSlug}/manage/tickets?error=${encodeURIComponent(error instanceof Error ? error.message : "Tiket belum tersimpan.")}`); }
  revalidatePath(`/app/events/${publicSlug}/manage/tickets`);
  revalidatePath(`/app/events/${publicSlug}/tickets`);
  redirect(`/app/events/${publicSlug}/manage/tickets?saved=1`);
}

export async function createTicketOrderAction(publicSlug: string, formData: FormData) {
  requiredFlag();
  const parsed = ticketOrderSchema.safeParse({ eventPublicSlug: publicSlug, ticketPublicId: formData.get("ticketPublicId"), quantity: formData.get("quantity"), code: formData.get("code"), idempotencyKey: formData.get("idempotencyKey") || randomUUID() });
  if (!parsed.success) redirect(`/app/events/${publicSlug}/tickets?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Periksa pilihan tiket.")}`);
  let state: "free" | "pending";
  try {
    const order = await createCampusEventTicketOrder(parsed.data);
    if (!order) throw new Error("Pesanan belum terbentuk.");
    state = order.order_status === "free" ? "free" : "pending";
  } catch (error) {
    redirect(`/app/events/${publicSlug}/tickets?error=${encodeURIComponent(error instanceof Error ? error.message : "Pesanan belum berhasil.")}`);
  }
  revalidatePath(`/app/events/${publicSlug}/tickets`);
  revalidatePath(`/app/events/${publicSlug}`);
  redirect(`/app/events/${publicSlug}/tickets?order=${state}`);
}
