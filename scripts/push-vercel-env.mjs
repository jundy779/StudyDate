/**
 * Push selected .env.local keys to a linked Vercel project (no secret printing).
 *
 * Usage (from studydate-web, after `npx vercel link`):
 *   node scripts/push-vercel-env.mjs
 *
 * Requires: `vercel` CLI authenticated. Sets Production + Preview.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CONTACT_REVEAL_ENCRYPTION_KEY",
  "CONTACT_REVEAL_KEY_VERSION",
  "STUDYDATE_EMAIL_FROM",
  "STUDYDATE_SMTP_HOST",
  "STUDYDATE_SMTP_PORT",
  "STUDYDATE_SMTP_SECURE",
  "STUDYDATE_SMTP_USER",
  "STUDYDATE_SMTP_PASSWORD",
  "STUDENT_VERIFICATION_ENCRYPTION_KEY",
  "STUDENT_VERIFICATION_HMAC_KEY",
  "STUDENT_VERIFICATION_ENABLED",
  "STUDENT_VERIFICATION_TEST_USER_IDS",
  "STUDENT_VERIFICATION_REVIEWER_USER_ID",
  "STUDENT_VERIFICATION_CLEANUP_SECRET",
  "STUDENT_VERIFICATION_CLEANUP_SCHEDULED",
  "CRON_SECRET",
  "PDDIKTI_LOOKUP_PROVIDER_ENABLED",
  "PDDIKTI_PROVIDER_BASE_URL",
  "PDDIKTI_PROVIDER_ACCESS_KEY",
];

const DEFAULTS = {
  CONTACT_REVEAL_KEY_VERSION: "1",
  STUDENT_VERIFICATION_ENABLED: "false",
  STUDENT_VERIFICATION_CLEANUP_SCHEDULED: "false",
  PDDIKTI_LOOKUP_PROVIDER_ENABLED: "false",
};

function parseEnv(raw) {
  const map = new Map();
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

const env = parseEnv(fs.readFileSync(envPath, "utf8"));
const report = [];

for (const key of KEYS) {
  let value = env.get(key) ?? DEFAULTS[key] ?? "";
  if (key === "NEXT_PUBLIC_SITE_URL" && /localhost|127\.0\.0\.1/i.test(value)) {
    report.push({ key, status: "SKIP_LOCAL_SITE_URL" });
    continue;
  }
  if (!value) {
    report.push({ key, status: "SKIP_EMPTY" });
    continue;
  }

  for (const target of ["production", "preview"]) {
    try {
      execFileSync(
        "npx",
        ["vercel", "env", "add", key, target, "--force", "--yes"],
        {
          cwd: root,
          input: `${value}\n`,
          stdio: ["pipe", "pipe", "pipe"],
          encoding: "utf8",
          shell: true,
        },
      );
      report.push({ key, target, status: "SET" });
    } catch (err) {
      const msg = String(err?.stderr || err?.message || err);
      report.push({
        key,
        target,
        status: "ERROR",
        detail: msg.slice(0, 160).replace(/[A-Za-z0-9_\-]{24,}/g, "[redacted]"),
      });
    }
  }
}

console.log(JSON.stringify({ ok: true, results: report }, null, 2));
