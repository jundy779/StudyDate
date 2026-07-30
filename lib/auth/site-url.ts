import "server-only";

import type { NextRequest } from "next/server";

export function getSiteOrigin(request: NextRequest) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      const isLocalHttp =
        url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1");
      if (url.protocol === "https:" || isLocalHttp) {
        return url.origin;
      }
    } catch {
      // Invalid configuration is handled below.
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL_REQUIRED");
  }

  return request.nextUrl.origin;
}
