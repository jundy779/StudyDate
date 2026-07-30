import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, RateLimitEntry>();

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwardedFor || request.headers.get("x-real-ip") || "unknown";

  return createHash("sha256").update(address).digest("hex");
}

export function consumeEarlyAccessAttempt(request: NextRequest) {
  const now = Date.now();

  if (attempts.size > 5_000) {
    for (const [key, entry] of attempts) {
      if (entry.resetAt <= now) {
        attempts.delete(key);
      }
    }
  }

  const key = getClientKey(request);
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (current.count >= MAX_ATTEMPTS) {
    return false;
  }

  current.count += 1;
  return true;
}
