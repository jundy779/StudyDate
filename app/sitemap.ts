import type { MetadataRoute } from "next";
import { PUBLIC_DOC_ROUTES } from "@/lib/marketing/public-routes";
import { getPublicSiteOrigin } from "@/lib/marketing/site-origin";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getPublicSiteOrigin();
  const lastModified = new Date("2026-08-07T00:00:00.000Z");

  const home: MetadataRoute.Sitemap[number] = {
    url: `${origin}/`,
    lastModified,
    changeFrequency: "weekly",
    priority: 1,
  };

  const docs: MetadataRoute.Sitemap = PUBLIC_DOC_ROUTES.map((route) => ({
    url: `${origin}${route.path}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [home, ...docs];
}
