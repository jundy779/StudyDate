import type { MetadataRoute } from "next";
import { PRODUCTION_SITE_ORIGIN } from "../lib/marketing/site-origin";

export default function robots(): MetadataRoute.Robots {
  const privatePaths = [
    "/account",
    "/account/",
    "/admin",
    "/admin/",
    "/api",
    "/api/",
    "/app",
    "/app/",
    "/auth",
    "/auth/",
    "/certificates/",
    "/email",
    "/email/",
    "/login",
    "/onboarding",
    "/owner",
    "/owner/",
    "/protected",
    "/staff",
    "/staff/",
    "/telegram-companion-audit",
    "/verification-audit",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: privatePaths,
      },
      {
        userAgent: ["Googlebot", "Bingbot", "OAI-SearchBot", "PerplexityBot"],
        allow: "/",
        disallow: privatePaths,
      },
    ],
    sitemap: `${PRODUCTION_SITE_ORIGIN}/sitemap.xml`,
    host: PRODUCTION_SITE_ORIGIN,
  };
}
