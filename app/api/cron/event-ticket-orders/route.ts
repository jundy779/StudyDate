import { expireTicketOrders } from "@/lib/events/ticketing-operations";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (process.env.EVENT_TICKETING_ENABLED !== "true") return NextResponse.json({ ok: false, error: "disabled" }, { status: 503 });
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try { const expired = await expireTicketOrders(); return NextResponse.json({ ok: true, expired }); }
  catch { return NextResponse.json({ ok: false, error: "processing_failed" }, { status: 500 }); }
}
