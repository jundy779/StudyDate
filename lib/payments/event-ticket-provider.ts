import "server-only";

export type VerifiedEventTicketPayment = {
  provider: "autogopay" | "midtrans" | "xendit";
  providerEventId: string;
  providerReference: string;
  orderPublicId: string;
  status: "paid" | "failed" | "expired" | "refunded";
  amount: number;
};

export interface EventTicketPaymentProvider {
  readonly name: VerifiedEventTicketPayment["provider"];
  createCheckout(input: { orderPublicId: string; amount: number; expiresAt: string }): Promise<{ checkoutUrl: string; providerReference: string }>;
  verifyWebhook(input: { rawBody: string; headers: Headers }): Promise<VerifiedEventTicketPayment>;
}

export function getEventTicketPaymentProvider(): EventTicketPaymentProvider {
  if (process.env.EVENT_TICKET_PAYMENTS_ENABLED !== "true") {
    throw new Error("Pembayaran tiket belum diaktifkan.");
  }
  throw new Error("Penyedia pembayaran tiket belum dipilih.");
}
