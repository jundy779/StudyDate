import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  hasTelegramBotConfiguration,
  isTelegramCompanionEnabled,
} from "@/lib/telegram/bot-api";
import {
  TELEGRAM_WEBHOOK_MAX_BYTES,
} from "@/lib/telegram/constants";
import { isTelegramCompanionCryptoConfigured } from "@/lib/telegram/crypto";
import { telegramUpdateSchema } from "@/lib/telegram/validation";
import { processTelegramUpdate } from "@/lib/telegram/webhook";

function response(status: number) {
  return NextResponse.json(
    { ok: status >= 200 && status < 300 },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function hasValidSecret(request: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const provided = request.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || expected.length < 32 || !provided) return false;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export async function POST(request: NextRequest) {
  if (
    !isTelegramCompanionEnabled() ||
    !hasTelegramBotConfiguration() ||
    !isTelegramCompanionCryptoConfigured()
  ) {
    return response(404);
  }
  if (!hasValidSecret(request)) return response(404);
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return response(415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(declaredLength) || declaredLength > TELEGRAM_WEBHOOK_MAX_BYTES) {
    return response(413);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > TELEGRAM_WEBHOOK_MAX_BYTES) {
    return response(413);
  }

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return response(400);
  }
  const parsed = telegramUpdateSchema.safeParse(input);
  if (!parsed.success) return response(400);

  try {
    await processTelegramUpdate(parsed.data);
    return response(200);
  } catch {
    return response(503);
  }
}
