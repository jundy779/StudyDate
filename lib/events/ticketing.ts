import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

export const ticketTypeSchema = z.object({
  ticketPublicId: z.string().trim().min(1).nullable(),
  name: z.string().trim().min(2, "Nama tiket terlalu pendek.").max(60),
  description: z.string().trim().max(280),
  accessType: z.enum(["public", "code", "invite_only"]),
  priceAmount: z.coerce.number().int().min(0).max(50_000_000),
  quantityTotal: z.coerce.number().int().min(1).max(10_000),
  minPerOrder: z.coerce.number().int().min(1).max(10),
  maxPerOrder: z.coerce.number().int().min(1).max(10),
  salesStartAt: z.string().trim().nullable(),
  salesEndAt: z.string().trim().nullable(),
  status: z.enum(["draft", "on_sale", "paused", "ended", "archived"]),
}).superRefine((value, context) => {
  if (value.minPerOrder > value.maxPerOrder) {
    context.addIssue({ code: "custom", path: ["maxPerOrder"], message: "Batas maksimal harus sama atau lebih besar." });
  }
  if (value.salesStartAt && value.salesEndAt && new Date(value.salesEndAt) <= new Date(value.salesStartAt)) {
    context.addIssue({ code: "custom", path: ["salesEndAt"], message: "Waktu tutup harus setelah waktu mulai." });
  }
});

export const ticketOrderSchema = z.object({
  eventPublicSlug: z.string().trim().min(1).max(160),
  ticketPublicId: z.string().trim().min(1).max(80),
  quantity: z.coerce.number().int().min(1).max(10),
  code: z.string().trim().max(40).optional(),
  idempotencyKey: z.string().trim().min(16).max(100).default(() => randomUUID()),
});

export function normalizeTicketCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function hashTicketCode(value?: string) {
  if (!value?.trim()) return null;
  return createHash("sha256").update(normalizeTicketCode(value), "utf8").digest("hex");
}

export function formatTicketPrice(amount: number, currency = "IDR") {
  if (amount === 0) return "Gratis";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function mapTicketingError(message?: string) {
  const value = (message ?? "").toLowerCase();
  if (value.includes("access code required")) return "Tiket ini memerlukan kode akses.";
  if (value.includes("code invalid")) return "Kode akses atau promo tidak berlaku.";
  if (value.includes("capacity below sold")) return "Kuota tidak boleh lebih kecil dari tiket yang sudah terjual.";
  if (value.includes("type quota")) return "Maksimal 12 jenis tiket untuk satu acara.";
  if (value.includes("order unavailable")) return "Tiket tidak tersedia atau kuotanya baru saja habis.";
  if (value.includes("confirmed event registration required")) return "Daftar ke acara dulu dan tunggu sampai pendaftaranmu dikonfirmasi.";
  if (value.includes("ticket already held")) return "Kamu sudah punya tiket aktif untuk acara ini.";
  if (value.includes("paid or private ticket checkout unavailable")) return "Tiket berbayar dan undangan belum bisa dipesan.";
  if (value.includes("only free public tickets can go on sale")) return "Saat ini hanya tiket gratis yang terbuka untuk semua yang bisa dibuka. Simpan tiket lainnya sebagai rancangan.";
  if (value.includes("management required")) return "Kamu tidak memiliki izin mengelola tiket acara ini.";
  return "Tiket belum dapat diproses. Coba lagi sebentar.";
}
