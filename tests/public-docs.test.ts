import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRODUCTION_PUBLIC_URLS,
  PUBLIC_DOC_ROUTES,
} from "../lib/marketing/public-routes.ts";

const root = process.cwd();

test("public doc routes cover privacy terms community safety help", () => {
  const paths = PUBLIC_DOC_ROUTES.map((route) => route.path);
  assert.deepEqual(paths, [
    "/privacy",
    "/terms",
    "/community-guidelines",
    "/safety",
    "/help",
  ]);
});

test("production URL list matches studydate.id public docs", () => {
  assert.ok(PRODUCTION_PUBLIC_URLS.includes("https://studydate.id/privacy"));
  assert.ok(PRODUCTION_PUBLIC_URLS.includes("https://studydate.id/terms"));
  assert.equal(PRODUCTION_PUBLIC_URLS[0], "https://studydate.id/");
});

test("footer links point at English public doc paths", () => {
  const landing = readFileSync(
    join(root, "components/marketing/landing-page.tsx"),
    "utf8",
  );
  for (const route of PUBLIC_DOC_ROUTES) {
    assert.match(landing, new RegExp(`href: "${route.path}"`));
  }
  assert.match(
    landing,
    /© 2026 StudyDate ID · Mulai dari belajar\. Kenal perlahan\./,
  );
});

test("privacy content states verification disabled and contact channels", () => {
  const privacy = readFileSync(
    join(root, "content/public-docs/privacy.ts"),
    "utf8",
  );
  assert.match(privacy, /dinonaktifkan secara global/i);
  assert.match(privacy, /Telegram/);
  assert.match(privacy, /Instagram/);
  assert.match(privacy, /LinkedIn/);
  assert.match(privacy, /tidak mendukung pembukaan WhatsApp/i);
  assert.match(privacy, /Masuk dengan Google/);
  assert.match(privacy, /@gmail\.com/);
  assert.doesNotMatch(privacy, /Masuk dengan Google \(belum aktif\)/i);
});

test("sitemap and robots modules exist", () => {
  const sitemap = readFileSync(join(root, "app/sitemap.ts"), "utf8");
  const robots = readFileSync(join(root, "app/robots.ts"), "utf8");
  assert.match(sitemap, /PUBLIC_DOC_ROUTES/);
  assert.match(robots, /\/privacy/);
  assert.match(robots, /disallow:[\s\S]*\/app\//i);
});
