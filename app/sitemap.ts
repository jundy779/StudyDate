import type { MetadataRoute } from "next";
import {
  PUBLIC_DOC_LAST_UPDATED_ISO,
  PUBLIC_DOC_ROUTES,
} from "../lib/marketing/public-routes";
import { insightArticles } from "../content/insight/articles";
import { getPublicSiteOrigin } from "../lib/marketing/site-origin";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getPublicSiteOrigin();
  const docsLastModified = new Date(
    `${PUBLIC_DOC_LAST_UPDATED_ISO}T00:00:00.000Z`,
  );
  const insightLastModified = new Date(
    `${insightArticles[0].modifiedAt}T00:00:00.000Z`,
  );

  const home: MetadataRoute.Sitemap[number] = {
    url: `${origin}/`,
    lastModified: insightLastModified,
    changeFrequency: "weekly",
    priority: 1,
  };

  const docs: MetadataRoute.Sitemap = PUBLIC_DOC_ROUTES.map((route) => ({
    url: `${origin}${route.path}`,
    lastModified:
      route.path === "/insight" ? insightLastModified : docsLastModified,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const articles: MetadataRoute.Sitemap = insightArticles.map((article) => ({
    url: `${origin}/insight/${article.slug}`,
    lastModified: new Date(`${article.modifiedAt}T00:00:00.000Z`),
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  return [home, ...docs, ...articles];
}
