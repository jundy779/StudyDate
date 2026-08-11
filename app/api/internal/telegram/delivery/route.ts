import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  hasTelegramDeliveryConfiguration,
  isTelegramCompanionEnabled,
} from "@/lib/telegram/bot-api";
import { isTelegramCompanionCryptoConfigured } from "@/lib/telegram/crypto";
import { runTelegramDeliveryBatch } from "@/lib/telegram/delivery-runner";

const ERROR = "Telegram delivery belum dapat dijalankan.";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization");
  if (!secret || secret.length < 32 || !provided) return false;
  const expectedBuffer = Buffer.from(`Bearer ${secret}`, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { message: ERROR },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (
    !isTelegramCompanionEnabled() ||
    !hasTelegramDeliveryConfiguration() ||
    !isTelegramCompanionCryptoConfigured()
  ) {
    return NextResponse.json(
      { message: ERROR },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await runTelegramDeliveryBatch();
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { message: ERROR },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
