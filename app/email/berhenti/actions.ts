"use server";

import { unsubscribeEventEmail } from "@/lib/events/announcement-email";
import { redirect } from "next/navigation";

/** Dijalankan hanya lewat tombol konfirmasi, bukan saat tautan dibuka, supaya pemindai tautan email tidak ikut memberhentikan. */
export async function unsubscribeEventEmailAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim().toLowerCase();
  const ok = await unsubscribeEventEmail(token).catch(() => false);
  redirect(`/email/berhenti?state=${ok ? "done" : "invalid"}`);
}
