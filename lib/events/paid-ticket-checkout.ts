import "server-only";

import { cancelAutoGoPayQris, generateAutoGoPayQris, getAutoGoPayQrisStatus, isAutoGoPayEnabled } from "@/lib/billing/autogopay";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Reservation = {
  order_public_id: string;
  amount_idr: number;
  should_generate: boolean;
  checkout_url: string | null;
};

export function paidTicketsEnabled() {
  return process.env.EVENT_TICKETING_ENABLED === "true"
    && process.env.EVENT_TICKET_PAYMENTS_ENABLED === "true"
    && isAutoGoPayEnabled();
}

export async function publishPaidEventTicket(ticketPublicId: string) {
  if (!paidTicketsEnabled()) throw new Error("Tiket berbayar belum tersedia.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_campus_event_paid_ticket", {
    p_ticket_public_id: ticketPublicId,
  });
  if (error || data !== true) throw new Error("Tiket berbayar belum bisa dibuka.");
}

export async function reservePaidEventTicket(input: {
  eventPublicSlug: string; ticketPublicId: string; idempotencyKey: string;
}) {
  if (!paidTicketsEnabled()) throw new Error("Pembayaran tiket belum tersedia.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reserve_my_campus_event_paid_ticket", {
    p_event_public_slug: input.eventPublicSlug,
    p_ticket_public_id: input.ticketPublicId,
    p_idempotency_key: input.idempotencyKey,
  });
  const reservation = ((data ?? []) as Reservation[])[0];
  if (error || !reservation) throw new Error("Tiket belum bisa dipesan. Coba periksa pendaftaran dan kuotanya.");
  if (!reservation.should_generate) return reservation.order_public_id;

  const admin = createServerAdminClient();
  if (!admin) throw new Error("Pembayaran belum siap. Pesananmu tersimpan, coba cek lagi nanti.");
  try {
    const generated = await generateAutoGoPayQris(reservation.amount_idr);
    const { data: attached, error: attachError } = await admin.rpc("attach_campus_event_autogopay_payment", {
      p_order_public_id: reservation.order_public_id,
      p_transaction_id: generated.transactionId,
      p_provider_order_id: generated.orderId,
      p_checkout_url: generated.checkoutUrl,
      p_expires_at: generated.expiresAt,
    });
    if (attachError || attached !== true) throw new Error("payment attachment failed");
  } catch {
    // The gateway may have created a payment before a timeout. Keep this order
    // reserved for reconciliation and never create a second attempt automatically.
    throw new Error("Pembayaran belum bisa ditampilkan. Pesananmu tersimpan untuk diperiksa.");
  }
  return reservation.order_public_id;
}

export async function getMyPaidEventTicket(orderPublicId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_campus_event_ticket_payment", {
    p_order_public_id: orderPublicId,
  });
  if (error) throw new Error("Status pembayaran belum bisa dibuka.");
  return ((data ?? []) as {
    order_public_id: string; status: string; total_amount: number;
    checkout_url: string | null; expires_at: string | null;
    provider_transaction_id: string | null; payment_status: string;
  }[])[0] ?? null;
}

export async function cancelMyPaidEventTicket(orderPublicId: string) {
  const payment = await getMyPaidEventTicket(orderPublicId);
  if (!payment || payment.status !== "pending" || !payment.provider_transaction_id) {
    throw new Error("Pesanan ini tidak bisa dibatalkan dari sini.");
  }
  const providerStatus = await getAutoGoPayQrisStatus(payment.provider_transaction_id);
  if (providerStatus === "settlement") {
    throw new Error("Pembayaran sedang diproses. Periksa status lagi sebentar.");
  }
  if (providerStatus !== "pending") {
    throw new Error("Status pembayaran belum jelas. Hubungi bantuan dengan nomor pesananmu.");
  }
  if (!await cancelAutoGoPayQris(payment.provider_transaction_id)) {
    throw new Error("Pembayaran belum bisa dibatalkan. Coba lagi nanti.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_my_campus_event_ticket_order", {
    p_order_public_id: orderPublicId,
  });
  if (error || data !== true) {
    throw new Error("Status pesanan berubah. Periksa halaman pembayaran lagi.");
  }
}
