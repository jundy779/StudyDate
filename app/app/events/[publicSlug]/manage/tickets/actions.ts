"use server";

import { saveTicketDiscountCode } from "@/lib/events/ticketing-operations";
import { publishPaidEventTicket } from "@/lib/events/paid-ticket-checkout";
import { publishCampusEventCodeTicket } from "@/lib/events/ticketing-service";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const schema = z.object({
  code: z.string().trim().min(4).max(40), purpose: z.enum(["discount", "unlock"]),
  discountType: z.enum(["fixed", "percent"]).nullable(), discountValue: z.coerce.number().int().min(0).max(50_000_000),
  maxRedemptions: z.coerce.number().int().min(1).max(10_000).nullable(),
  startsAt: z.string().trim().nullable(), endsAt: z.string().trim().nullable(),
}).superRefine((value, context) => {
  if (value.purpose === "discount" && value.discountValue < 1) context.addIssue({ code: "custom", path: ["discountValue"], message: "Nilai potongan harus diisi." });
  if (value.discountType === "percent" && value.discountValue > 100) context.addIssue({ code: "custom", path: ["discountValue"], message: "Persentase maksimal 100%." });
});

const optional = (value: FormDataEntryValue | null) => String(value ?? "").trim() || null;

export async function createTicketCodeAction(publicSlug: string, formData: FormData) {
  if (process.env.EVENT_TICKETING_ENABLED !== "true") throw new Error("Tiket acara belum diaktifkan.");
  const parsed = schema.safeParse({ code: formData.get("code"), purpose: formData.get("purpose"),
    discountType: optional(formData.get("discountType")), discountValue: formData.get("discountValue"),
    maxRedemptions: optional(formData.get("maxRedemptions")), startsAt: optional(formData.get("startsAt")), endsAt: optional(formData.get("endsAt")) });
  if (!parsed.success) redirect(`/app/events/${publicSlug}/manage/tickets/codes?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Periksa kode.")}`);
  try { await saveTicketDiscountCode(publicSlug, { codePublicId: null, code: parsed.data.code,
    purpose: parsed.data.purpose, discountType: parsed.data.discountType,
    discountValue: parsed.data.discountValue, maxRedemptions: parsed.data.maxRedemptions,
    startsAt: parsed.data.startsAt, endsAt: parsed.data.endsAt, status: "active" }); }
  catch (error) { redirect(`/app/events/${publicSlug}/manage/tickets/codes?error=${encodeURIComponent(error instanceof Error ? error.message : "Kode belum tersimpan.")}`); }
  revalidatePath(`/app/events/${publicSlug}/manage/tickets/codes`);
  redirect(`/app/events/${publicSlug}/manage/tickets/codes?saved=1`);
}

export async function publishPaidTicketAction(publicSlug: string, formData: FormData) {
  const ticketPublicId = String(formData.get("ticketPublicId") ?? "");
  if (!/^ett_[0-9a-f]{24}$/.test(ticketPublicId)) {
    redirect(`/app/events/${publicSlug}/manage/tickets?error=Periksa%20jenis%20tiket.`);
  }
  try {
    await publishPaidEventTicket(ticketPublicId);
  } catch (error) {
    redirect(`/app/events/${publicSlug}/manage/tickets?error=${encodeURIComponent(error instanceof Error ? error.message : "Tiket belum bisa dibuka.")}`);
  }
  revalidatePath(`/app/events/${publicSlug}/manage/tickets`);
  revalidatePath(`/app/events/${publicSlug}/tickets`);
  redirect(`/app/events/${publicSlug}/manage/tickets?saved=1`);
}

export async function publishCodeTicketAction(publicSlug: string, formData: FormData) {
  if (process.env.EVENT_TICKETING_ENABLED !== "true") throw new Error("Tiket acara belum diaktifkan.");
  const ticketPublicId = String(formData.get("ticketPublicId") ?? "");
  if (!/^ett_[0-9a-f]{24}$/.test(ticketPublicId)) {
    redirect(`/app/events/${publicSlug}/manage/tickets?error=Periksa%20jenis%20tiket.`);
  }
  try {
    await publishCampusEventCodeTicket(ticketPublicId);
  } catch (error) {
    redirect(`/app/events/${publicSlug}/manage/tickets?error=${encodeURIComponent(error instanceof Error ? error.message : "Tiket belum bisa dibuka.")}`);
  }
  revalidatePath(`/app/events/${publicSlug}/manage/tickets`);
  revalidatePath(`/app/events/${publicSlug}/tickets`);
  redirect(`/app/events/${publicSlug}/manage/tickets?saved=1`);
}

