import type { NextRequest } from "next/server";
import { consumeEarlyAccessAttempt as consumeDurable } from "@/lib/security/rate-limit";

/** @deprecated Prefer importing from `@/lib/security/rate-limit` directly. */
export async function consumeEarlyAccessAttempt(request: NextRequest) {
  return consumeDurable(request);
}
