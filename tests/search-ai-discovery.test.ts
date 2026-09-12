import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const robotsSource = read("app/robots.ts");
const sitemapSource = read("app/sitemap.ts");

test("production canonical origin never falls back to localhost or preview", () => {
  const origin = read("lib/marketing/site-origin.ts");
  const root = read("app/layout.tsx");
  assert.match(origin, /PRODUCTION_SITE_ORIGIN = "https:\/\/studydate\.id"/);
  assert.doesNotMatch(origin, /VERCEL_URL|localhost|127\.0\.0\.1/);
  assert.match(root, /metadataBase: new URL\(getPublicSiteOrigin\(\)\)/);
});

test("homepage and every indexable public page define a canonical", () => {
  for (const file of [
    "app/page.tsx",
    "app/(public-docs)/privacy/page.tsx",
    "app/(public-docs)/terms/page.tsx",
    "app/(public-docs)/community-guidelines/page.tsx",
    "app/(public-docs)/safety/page.tsx",
    "app/(public-docs)/help/page.tsx",
    "app/(public-docs)/insight/page.tsx",
    "app/(public-docs)/insight/[slug]/page.tsx",
  ]) {
    assert.match(read(file), /alternates:\s*\{\s*canonical:/, file);
  }
});

test("public navbar links homepage sections and Insight with crawlable anchors", () => {
  const landingPage = read("components/marketing/landing-page.tsx");
  const publicDocs = read("components/marketing/public-doc-shell.tsx");
  const expectedNavigation = [
    '{ label: "Cari Teman", href: "/#people" }',
    '{ label: "Circle Belajar", href: "/#groups" }',
    '{ label: "Acara Kampus", href: "/events" }',
    '{ label: "Cara Kerja", href: "/#cara-kerja" }',
    '{ label: "Tentang", href: "/about" }',
    '{ label: "Keamanan", href: "/safety" }',
  ];

  for (const item of expectedNavigation) {
    assert.ok(landingPage.includes(item), item);
  }
  assert.match(landingPage, /<a[\s\S]*href={item\.href}/);
  assert.match(landingPage, /<MobileNav items={navigation} \/>/);
  assert.match(publicDocs, /<PublicNavbar static \/>/);
  assert.match(publicDocs, /getAuthenticatedUser/);
  assert.match(landingPage, />\s*Ikut Akses Awal\s*</);
});

test("sitemap contains only canonical public URLs", () => {
  assert.match(sitemapSource, /url: `\$\{origin\}\/`/);
  assert.match(sitemapSource, /PUBLIC_DOC_ROUTES\.map/);
  assert.match(sitemapSource, /insightArticles\.map/);
  assert.match(sitemapSource, /`\$\{origin\}\/insight\/\$\{article\.slug\}`/);
  assert.doesNotMatch(
    sitemapSource,
    /["'`]\/(?:app|staff|owner|admin|api|auth|login|onboarding|account|protected)(?:\/|["'`])/,
  );
  assert.doesNotMatch(sitemapSource, /localhost|vercel\.app/);
  assert.doesNotMatch(sitemapSource, /url:.*\?/);
});

test("robots exposes public content and excludes private surfaces", () => {
  assert.match(
    robotsSource,
    /sitemap: `\$\{PRODUCTION_SITE_ORIGIN\}\/sitemap\.xml`/,
  );
  for (const path of [
    "/app",
    "/app/",
    "/api",
    "/api/",
    "/staff",
    "/staff/",
    "/owner",
    "/owner/",
    "/admin",
    "/admin/",
    "/auth",
    "/auth/",
    "/account",
    "/account/",
  ]) {
    assert.ok(robotsSource.includes(`"${path}"`), path);
  }
  const searchAgents = ["Googlebot", "Bingbot", "OAI-SearchBot", "PerplexityBot"];
  for (const agent of searchAgents) {
    assert.ok(robotsSource.includes(`"${agent}"`), agent);
  }
  assert.match(robotsSource, /allow: "\/"/);
  assert.doesNotMatch(robotsSource, /GPTBot/);
});

test("private routes receive defense-in-depth noindex headers", () => {
  const proxy = read("lib/supabase/proxy.ts");
  assert.match(proxy, /X-Robots-Tag/);
  assert.match(proxy, /noindex, nofollow, noarchive/);
  for (const prefix of [
    "/app",
    "/api",
    "/admin",
    "/owner",
    "/staff",
    "/auth",
  ]) {
    assert.ok(proxy.includes(`"${prefix}"`), prefix);
  }
  assert.match(read("app/app/layout.tsx"), /index: false, follow: false/);
  assert.match(
    read("next.config.ts"),
    /Cache-Control[\s\S]*private, no-store/,
  );
  assert.match(
    read("app/verification-audit/page.tsx"),
    /NODE_ENV === "production"[\s\S]*notFound\(\)/,
  );
});

test("Organization and WebSite structured data use verified public facts", () => {
  const serialized = read("lib/marketing/structured-data.ts");
  assert.match(serialized, /"@type": "Organization"/);
  assert.match(serialized, /"@type": "WebSite"/);
  assert.match(serialized, /name: "StudyDate ID"/);
  assert.match(serialized, /url: getPublicSiteUrl\(\)/);
  assert.doesNotMatch(
    serialized,
    /\/(?:app|api|admin|owner|staff)|AggregateRating|Review|Person|SearchAction|localhost|vercel\.app/i,
  );
});

test("Article schema exists only for real public insight content", () => {
  const structuredData = read("lib/marketing/structured-data.ts");
  const articlePage = read("app/(public-docs)/insight/[slug]/page.tsx");
  assert.match(structuredData, /"@type": "Article"/);
  assert.match(articlePage, /articleJsonLd/);
  assert.match(articlePage, /notFound\(\)/);
  assert.doesNotMatch(
    articlePage + structuredData,
    /AggregateRating|Review|ratingValue|reviewCount/,
  );
});

test("public structured data and metadata contain no private identifiers", () => {
  const sources = [
    read("lib/marketing/structured-data.ts"),
    read("app/page.tsx"),
    read("app/(public-docs)/insight/[slug]/page.tsx"),
    read("content/insight/articles.ts"),
  ].join("\n");
  assert.doesNotMatch(
    sources,
    /SUPABASE_SERVICE_ROLE_KEY|TELEGRAM_BOT_TOKEN|nim_|legalName|signedUrl|storage_path|@[A-Za-z0-9._%+-]+\.[A-Za-z]{2,}|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i,
  );
  assert.doesNotMatch(read("lib/marketing/structured-data.ts"), /\bNIM\b/i);
});

test("analytics is public-only and privacy copy discloses aggregate measurement", () => {
  assert.doesNotMatch(read("app/layout.tsx"), /<Analytics/);
  assert.doesNotMatch(read("app/app/layout.tsx"), /Analytics/);
  assert.match(read("app/page.tsx"), /<Analytics \/>/);
  assert.match(read("app/(public-docs)/layout.tsx"), /<Analytics \/>/);
  assert.match(read("content/public-docs/privacy.ts"), /Vercel Web Analytics/);
});
