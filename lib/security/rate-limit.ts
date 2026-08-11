import "server-only";

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { createServerAdminClient } from "@/lib/supabase/admin";

export type RateLimitBucket =
  | "early_access_ip"
  | "magic_link_ip"
  | "magic_link_email"
  | "staff_magic_link_ip"
  | "staff_magic_link_email"
  | "verification_lookup_hour"
  | "verification_lookup_day"
  | "verification_manual_day";

type MemoryEntry = {
  count: number;
  resetAt: number;
};

const memoryAttempts = new Map<string, MemoryEntry>();

function hashSubject(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function getClientIpHash(request: NextRequest) {
  const forwardedFor = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const address =
    forwardedFor || request.headers.get("x-real-ip") || "unknown";
  return hashSubject(`ip:${address.toLowerCase()}`);
}

export function getEmailHash(email: string) {
  return hashSubject(`email:${email.trim().toLowerCase()}`);
}

function consumeMemoryFallback(
  bucket: string,
  subjectHash: string,
  limit: number,
  windowSeconds: number,
) {
  const now = Date.now();
  const key = `${bucket}:${subjectHash}`;

  if (memoryAttempts.size > 8_000) {
    for (const [entryKey, entry] of memoryAttempts) {
      if (entry.resetAt <= now) {
        memoryAttempts.delete(entryKey);
      }
    }
  }

  const current = memoryAttempts.get(key);
  if (!current || current.resetAt <= now) {
    memoryAttempts.set(key, {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    });
    return true;
  }

  if (current.count >= limit) {
    return false;
  }

  current.count += 1;
  return true;
}

/**
 * Durable rate limit via Supabase RPC (service role).
 * Falls back to in-process memory only outside production when RPC is unavailable
 * (local without migration). Production fails closed.
 */
export async function consumeApiRateLimit(options: {
  bucket: RateLimitBucket;
  subjectHash: string;
  limit: number;
  windowSeconds: number;
}): Promise<boolean> {
  const { bucket, subjectHash, limit, windowSeconds } = options;

  if (
    !subjectHash ||
    subjectHash.length < 16 ||
    limit < 1 ||
    windowSeconds < 1
  ) {
    return false;
  }

  const admin = createServerAdminClient();
  if (!admin) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    return consumeMemoryFallback(bucket, subjectHash, limit, windowSeconds);
  }

  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    p_bucket: bucket,
    p_subject_hash: subjectHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    return consumeMemoryFallback(bucket, subjectHash, limit, windowSeconds);
  }

  return data === true;
}

/** Early Access: 5 attempts / 10 minutes per IP. */
export async function consumeEarlyAccessAttempt(request: NextRequest) {
  return consumeApiRateLimit({
    bucket: "early_access_ip",
    subjectHash: getClientIpHash(request),
    limit: 5,
    windowSeconds: 10 * 60,
  });
}

/** Student magic link: IP 8/15m and email 3/hour. */
export async function consumeMagicLinkAttempts(
  request: NextRequest,
  email: string,
) {
  const ipOk = await consumeApiRateLimit({
    bucket: "magic_link_ip",
    subjectHash: getClientIpHash(request),
    limit: 8,
    windowSeconds: 15 * 60,
  });
  if (!ipOk) {
    return false;
  }

  return consumeApiRateLimit({
    bucket: "magic_link_email",
    subjectHash: getEmailHash(email),
    limit: 3,
    windowSeconds: 60 * 60,
  });
}

/** Staff magic link: slightly stricter IP, same email cadence. */
export async function consumeStaffMagicLinkAttempts(
  request: NextRequest,
  email: string,
) {
  const ipOk = await consumeApiRateLimit({
    bucket: "staff_magic_link_ip",
    subjectHash: getClientIpHash(request),
    limit: 5,
    windowSeconds: 15 * 60,
  });
  if (!ipOk) {
    return false;
  }

  return consumeApiRateLimit({
    bucket: "staff_magic_link_email",
    subjectHash: getEmailHash(email),
    limit: 3,
    windowSeconds: 60 * 60,
  });
}
