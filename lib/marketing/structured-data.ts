import { getPublicSiteUrl } from "./site-origin";

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "StudyDate ID",
  url: getPublicSiteUrl(),
  logo: getPublicSiteUrl("/brand/logo-horizontal-color.png"),
  description:
    "StudyDate ID membantu mahasiswa menemukan teman belajar, circle kecil, dan acara kampus tanpa langsung membagikan nama asli atau kontak pribadi.",
} as const;

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "StudyDate ID",
  url: getPublicSiteUrl(),
  inLanguage: "id-ID",
  description: organizationJsonLd.description,
  publisher: {
    "@type": "Organization",
    name: organizationJsonLd.name,
    url: organizationJsonLd.url,
  },
} as const;

export function breadcrumbJsonLd(
  items: readonly { name: string; path: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getPublicSiteUrl(item.path),
    })),
  };
}

export function articleJsonLd(article: {
  title: string;
  description: string;
  path: string;
  publishedAt: string;
  modifiedAt: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    url: getPublicSiteUrl(article.path),
    mainEntityOfPage: getPublicSiteUrl(article.path),
    datePublished: article.publishedAt,
    dateModified: article.modifiedAt,
    inLanguage: "id-ID",
    author: {
      "@type": "Organization",
      name: organizationJsonLd.name,
      url: organizationJsonLd.url,
    },
    publisher: {
      "@type": "Organization",
      name: organizationJsonLd.name,
      url: organizationJsonLd.url,
      logo: {
        "@type": "ImageObject",
        url: organizationJsonLd.logo,
      },
    },
  };
}
