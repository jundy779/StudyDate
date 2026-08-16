export const PRODUCTION_SITE_ORIGIN = "https://studydate.id";

/** Canonical public origin. Preview and local deployments must point to production. */
export function getPublicSiteOrigin(): string {
  return PRODUCTION_SITE_ORIGIN;
}

export function getPublicSiteUrl(pathname = "/"): string {
  const origin = getPublicSiteOrigin();
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${origin}${path === "/" ? "/" : path}`;
}
