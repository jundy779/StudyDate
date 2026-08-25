import "server-only";

import type { NextRequest } from "next/server";

function parseConfiguredOrigin() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    const isLocalHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (url.protocol === "https:" || isLocalHttp) {
      return url.origin;
    }
  } catch {
    // Invalid configuration is handled by callers.
  }

  return null;
}

export function getConfiguredSiteOrigin() {
  const configured = parseConfiguredOrigin();
  if (!configured) {
    throw new Error("NEXT_PUBLIC_SITE_URL_REQUIRED");
  }
  return configured;
}

export function getSiteOrigin(request: NextRequest) {
  const configured = parseConfiguredOrigin();
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL_REQUIRED");
  }

  return request.nextUrl.origin;
}
