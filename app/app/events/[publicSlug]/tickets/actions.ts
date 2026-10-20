"use server";

import { randomUUID } from "node:crypto";
import { reservePaidEventTicket } from "@/lib/events/paid-ticket-checkout";
import { createCampusEventCodeTicketOrder, createCampusEventTicketOrder, saveCampusEventTicketType } from "@/lib/events/ticketing-service";
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

export async function createCodeTicketOrderAction(publicSlug: string, formData: FormData) {
  requiredFlag();
  const parsed = ticketOrderSchema.safeParse({
    eventPublicSlug: publicSlug, ticketPublicId: formData.get("ticketPublicId"),
    quantity: 1, code: formData.get("code"),
    idempotencyKey: formData.get("idempotencyKey") || randomUUID(),
  });
  if (!parsed.success) redirect(`/app/events/${publicSlug}/tickets?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Periksa kode tiket.")}`);
  try {
    const order = await createCampusEventCodeTicketOrder(parsed.data);
    if (!order) throw new Error("Tiket belum berhasil diambil.");
  } catch (error) {
    redirect(`/app/events/${publicSlug}/tickets?error=${encodeURIComponent(error instanceof Error ? error.message : "Tiket belum berhasil diambil.")}`);
  }
  revalidatePath(`/app/events/${publicSlug}/tickets`);
  revalidatePath(`/app/events/${publicSlug}`);
  redirect(`/app/events/${publicSlug}/tickets?order=free`);
}

export async function createPaidTicketOrderAction(publicSlug: string, formData: FormData) {
  requiredFlag();
  const parsed = ticketOrderSchema.safeParse({
    eventPublicSlug: publicSlug, ticketPublicId: formData.get("ticketPublicId"),
    quantity: 1, code: "", idempotencyKey: formData.get("idempotencyKey") || randomUUID(),
  });
  if (!parsed.success) redirect(`/app/events/${publicSlug}/tickets?error=Periksa%20pilihan%20tiket.`);
  let orderId: string;
  try {
    orderId = await reservePaidEventTicket({
      eventPublicSlug: publicSlug, ticketPublicId: parsed.data.ticketPublicId,
      idempotencyKey: parsed.data.idempotencyKey,
    });
  } catch (error) {
    redirect(`/app/events/${publicSlug}/tickets?error=${encodeURIComponent(error instanceof Error ? error.message : "Pembayaran belum tersedia.")}`);
  }
  revalidatePath(`/app/events/${publicSlug}/tickets`);
  redirect(`/app/events/${publicSlug}/tickets/payment/${orderId}`);
}

