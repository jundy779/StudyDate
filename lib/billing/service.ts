import "server-only";

import {
  cancelAutoGoPayQris,
  generateAutoGoPayQris,
  getAutoGoPayQrisStatus,
  isAutoGoPayEnabled,
} from "@/lib/billing/autogopay";
import type { PlusPackageCode } from "@/lib/membership/limits";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type BillingOffer = {
  packageCode: PlusPackageCode;
  amountIdr: number;
  durationDays: number;
  isActive?: boolean;
  updatedAt?: string;
};

export type PaymentOrder = {
  publicId: string;
  amountIdr: number;
  durationDays: number;
  status: "creating" | "pending" | "paid" | "expired" | "cancelled" | "generation_failed";
  providerTransactionId: string | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
  paidAt?: string | null;
};

type OrderRow = {
  public_id: string;
  amount_idr: number;
  duration_days: number;
  status: PaymentOrder["status"];
  provider_transaction_id: string | null;
  checkout_url: string | null;
  provider_expires_at: string | null;
  paid_at?: string | null;
  should_generate?: boolean;
};

function mapOrder(row: OrderRow): PaymentOrder {
  return {
    publicId: row.public_id,
    amountIdr: row.amount_idr,
    durationDays: row.duration_days,
    status: row.status,
    providerTransactionId: row.provider_transaction_id,
    checkoutUrl: row.checkout_url,
    expiresAt: row.provider_expires_at,
    paidAt: row.paid_at ?? null,
  };
}

export async function getMyBillingOffers(): Promise<BillingOffer[]> {
  if (!isAutoGoPayEnabled()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_membership_billing_offer");
  if (error) return [];
  return ((data ?? []) as {
    package_code: PlusPackageCode;
    amount_idr: number;
    duration_days: number;
  }[]).map((row) => ({
    packageCode: row.package_code,
    amountIdr: row.amount_idr,
    durationDays: row.duration_days,
  }));
}

export async function getOwnerBillingOffers(): Promise<BillingOffer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_membership_billing_offer_ops");
  if (error) return [];
  return ((data ?? []) as {
    package_code: PlusPackageCode;
    amount_idr: number;
    duration_days: number;
    is_active: boolean;
    updated_at: string;
  }[]).map((row) => ({
    packageCode: row.package_code,
    amountIdr: row.amount_idr,
    durationDays: row.duration_days,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  }));
}

export async function saveOwnerBillingOffer(
  offer: Pick<BillingOffer, "packageCode" | "amountIdr" | "isActive">,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("manage_membership_billing_offer", {
    p_package_code: offer.packageCode,
    p_amount_idr: offer.amountIdr,
    p_is_active: offer.isActive ?? false,
  });
  if (error) throw new Error("Konfigurasi penawaran belum dapat disimpan.");
}

export async function getMyPaymentOrder(publicId?: string): Promise<PaymentOrder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_membership_payment_order", {
    p_public_id: publicId ?? null,
  });
  if (error) return null;
  const row = (data ?? [])[0] as OrderRow | undefined;
  return row ? mapOrder(row) : null;
}

export async function createCheckout(packageCode: PlusPackageCode): Promise<PaymentOrder> {
  if (!isAutoGoPayEnabled()) throw new Error("Pembayaran sedang tidak tersedia.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_or_reuse_my_membership_payment_order", {
    p_package_code: packageCode,
  });
  const row = (data ?? [])[0] as OrderRow | undefined;
  if (error || !row) throw new Error("Pembayaran sedang tidak tersedia.");
  if (!row.should_generate) return mapOrder(row);

  const admin = createServerAdminClient();
  if (!admin) throw new Error("Pembayaran sedang tidak tersedia.");
  try {
    const generated = await generateAutoGoPayQris(row.amount_idr);
    const { data: attached, error: attachError } = await admin.rpc(
      "attach_membership_payment_provider",
      {
        p_public_id: row.public_id,
        p_provider_transaction_id: generated.transactionId,
        p_provider_order_id: generated.orderId,
        p_checkout_url: generated.checkoutUrl,
        p_provider_expires_at: generated.expiresAt,
      },
    );
    if (attachError || attached !== true) throw new Error("AUTOGOPAY_INVALID_RESPONSE");
    return {
      ...mapOrder(row),
      status: "pending",
      providerTransactionId: generated.transactionId,
      checkoutUrl: generated.checkoutUrl,
      expiresAt: generated.expiresAt,
    };
  } catch (error) {
    await admin.rpc("fail_membership_payment_generation", {
      p_public_id: row.public_id,
      p_failure_code:
        error instanceof Error && error.message === "AUTOGOPAY_INVALID_RESPONSE"
          ? "provider_invalid"
          : "provider_unavailable",
    });
    throw new Error("Pembayaran sedang tidak tersedia.");
  }
}

export async function refreshMyPaymentStatus(publicId: string) {
  const order = await getMyPaymentOrder(publicId);
  if (!order || !order.providerTransactionId || order.status !== "pending") return order;
  const providerStatus = await getAutoGoPayQrisStatus(order.providerTransactionId);
  if (providerStatus === "expire" || providerStatus === "cancel") {
    const supabase = await createClient();
    await supabase.rpc("cancel_my_membership_payment", { p_public_id: publicId });
  }
  return getMyPaymentOrder(publicId);
}

export async function cancelMyPayment(publicId: string) {
  const order = await getMyPaymentOrder(publicId);
  if (!order || !order.providerTransactionId || order.status !== "pending") return order;
  const cancelled = await cancelAutoGoPayQris(order.providerTransactionId);
  if (!cancelled) throw new Error("Pembayaran belum dapat dibatalkan.");
  const supabase = await createClient();
  await supabase.rpc("cancel_my_membership_payment", { p_public_id: publicId });
  return getMyPaymentOrder(publicId);
}
