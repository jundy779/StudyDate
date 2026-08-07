import type { MetadataRoute } from "next";
import { getPublicSiteOrigin } from "@/lib/marketing/site-origin";

export default function robots(): MetadataRoute.Robots {
  const origin = getPublicSiteOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms", "/community-guidelines", "/safety", "/help"],
        disallow: [
          "/app/",
          "/onboarding",
          "/owner/",
          "/admin/",
          "/api/",
          "/auth/",
          "/staff/",
          "/protected",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
