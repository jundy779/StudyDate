/**
 * Browser-safe / build-time site origin for metadata, sitemap, and robots.
 * Prefers NEXT_PUBLIC_SITE_URL so production canonicals track studydate.id
 * without breaking local/dev when only localhost is configured.
 */
export function getPublicSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      const isLocalHttp =
        url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1");
      if (url.protocol === "https:" || isLocalHttp) {
        return url.origin;
      }
    } catch {
      // fall through
    }
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3010";
}

export function getPublicSiteUrl(pathname = "/"): string {
  const origin = getPublicSiteOrigin();
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${origin}${path === "/" ? "/" : path}`;
}
