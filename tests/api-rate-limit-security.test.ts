import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

test("api rate limit migration is service-role only and hashes subjects", () => {
  const sql = readFileSync(
    join(
      root,
      "supabase/migrations/202608070001_create_api_rate_limits_v1.sql",
    ),
    "utf8",
  );
  assert.match(sql, /create table if not exists public\.api_rate_limits/);
  assert.match(sql, /consume_api_rate_limit/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /grant execute[\s\S]*to service_role/i);
  assert.match(sql, /revoke all[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /No raw IP\/email/i);
});

test("security rate-limit helper wires early access and magic link buckets", () => {
  const src = readFileSync(join(root, "lib/security/rate-limit.ts"), "utf8");
  assert.match(src, /early_access_ip/);
  assert.match(src, /magic_link_ip/);
  assert.match(src, /magic_link_email/);
  assert.match(src, /staff_magic_link_ip/);
  assert.match(src, /fail closed|NODE_ENV === "production"/);
});

test("public auth routes consume durable rate limits", () => {
  const student = readFileSync(
    join(root, "app/api/auth/magic-link/route.ts"),
    "utf8",
  );
  const staff = readFileSync(
    join(root, "app/api/auth/staff-magic-link/route.ts"),
    "utf8",
  );
  const early = readFileSync(
    join(root, "app/api/early-access/route.ts"),
    "utf8",
  );
  assert.match(student, /consumeMagicLinkAttempts/);
  assert.match(staff, /consumeStaffMagicLinkAttempts/);
  assert.match(early, /await consumeEarlyAccessAttempt/);
});

test("next.config sets baseline security headers and disables powered-by", () => {
  const cfg = readFileSync(join(root, "next.config.ts"), "utf8");
  assert.match(cfg, /X-Content-Type-Options/);
  assert.match(cfg, /X-Frame-Options/);
  assert.match(cfg, /Referrer-Policy/);
  assert.match(cfg, /Permissions-Policy/);
  assert.match(cfg, /Content-Security-Policy/);
  assert.match(cfg, /default-src 'self'/);
  assert.match(cfg, /frame-ancestors 'none'/);
  assert.match(cfg, /object-src 'none'/);
  assert.match(cfg, /script-src-attr 'none'/);
  assert.match(cfg, /Cross-Origin-Opener-Policy/);
  assert.match(cfg, /Cross-Origin-Resource-Policy/);
  assert.match(cfg, /https:\/\/\*\.supabase\.co/);
  assert.match(cfg, /wss:\/\/\*\.supabase\.co/);
  assert.doesNotMatch(cfg, /Access-Control-Allow-Origin/);
  assert.match(cfg, /camera=\(self\)/);
  assert.match(cfg, /microphone=\(\)/);
  assert.match(cfg, /X-DNS-Prefetch-Control/);
  assert.match(cfg, /value: "off"/);
  assert.match(cfg, /Strict-Transport-Security/);
  assert.match(cfg, /poweredByHeader:\s*false/);
});
