import { createHash } from "node:crypto";
import {
  parseAutoGoPayTimestamp,
  verifyAutoGoPaySignature,
} from "@/lib/billing/autogopay";
import { autoGoPayWebhookSchema } from "@/lib/billing/validation";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const MAX_BODY_BYTES = 16_384;

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false }, { status: 413 });
  }

  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.byteLength === 0 || raw.byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false }, { status: 413 });
  }
  try {
    if (!verifyAutoGoPaySignature(raw, request.headers.get("x-signature"))) {
      return NextResponse.json({ success: false }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ success: false }, { status: 503 });
  }
  if (request.headers.get("x-callback-event") !== "transaction.received") {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  const parsed = autoGoPayWebhookSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  let paidAt: Date;
  try {
    paidAt = parseAutoGoPayTimestamp(parsed.data.transaction.paid_at);
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const admin = createServerAdminClient();
  if (!admin) return NextResponse.json({ success: false }, { status: 503 });
  const transaction = parsed.data.transaction;
  // Preserve the existing membership callback until ticket payments have been
  // enabled and their database migration has been verified.
  if (process.env.EVENT_TICKETING_ENABLED === "true" && process.env.EVENT_TICKET_PAYMENTS_ENABLED === "true") {
  const ticketResult = await admin.rpc("finalize_campus_event_autogopay_payment", {
    p_transaction_id: transaction.transaction_id,
    p_provider_order_id: transaction.order_id,
    p_amount_idr: transaction.amount,
    p_payload_hash: createHash("sha256").update(raw).digest("hex"),
    p_paid_at: paidAt.toISOString(),
  });
  if (!ticketResult.error && ticketResult.data !== "unknown") {
    if (ticketResult.data === "mismatch") return NextResponse.json({ success: false }, { status: 422 });
    if (["paid", "duplicate", "review"].includes(String(ticketResult.data))) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false }, { status: 503 });
  }
  if (ticketResult.error && ticketResult.error.code !== "PGRST202") {
    return NextResponse.json({ success: false }, { status: 503 });
  }
  }
  const { data, error } = await admin.rpc("finalize_membership_payment", {
    p_provider_transaction_id: transaction.transaction_id,
    p_provider_order_id: transaction.order_id,
    p_amount_idr: transaction.amount,
    p_paid_at: paidAt.toISOString(),
  });
  if (error) return NextResponse.json({ success: false }, { status: 503 });
  if (data === "mismatch" || data === "invalid_state") {
    return NextResponse.json({ success: false }, { status: 422 });
  }
  return NextResponse.json({ success: true });
}

