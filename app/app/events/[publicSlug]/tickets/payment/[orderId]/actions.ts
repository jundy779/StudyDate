"use server";

import { cancelMyPaidEventTicket } from "@/lib/events/paid-ticket-checkout";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function cancelPaidTicketAction(publicSlug: string, orderId: string) {
  if (process.env.EVENT_TICKETING_ENABLED !== "true") throw new Error("Tiket acara belum tersedia.");
  if (!/^eto_[0-9a-f]{24}$/.test(orderId)) throw new Error("Nomor pesanan tidak valid.");
  try {
    await cancelMyPaidEventTicket(orderId);
  } catch (error) {
    redirect(`/app/events/${publicSlug}/tickets/payment/${orderId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Pesanan belum bisa dibatalkan.")}`);
  }
  revalidatePath(`/app/events/${publicSlug}/tickets`);
  revalidatePath(`/app/events/${publicSlug}/tickets/payment/${orderId}`);
  redirect(`/app/events/${publicSlug}/tickets/payment/${orderId}?cancelled=1`);
}
