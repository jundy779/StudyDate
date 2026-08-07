/**
 * Smoke: Contact Reveal key gate + Owner moderation inbox + student denial.
 * Sanitized output only. Never prints keys, emails, tokens, or full UUIDs.
 *
 *   node --experimental-strip-types scripts/live-moderation-smoke.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import {
  isContactRevealKeyConfigured,
  getContactRevealCurrentKeyVersion,
} from "../lib/contact-reveal/crypto-core.ts";

const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3010";
const root = process.cwd();
const outDir = join(root, "audit-artifacts");
mkdirSync(outDir, { recursive: true });

function loadEnv() {
  const env = { ...process.env };
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    env[line.slice(0, i)] = line.slice(i + 1);
  }
  return env;
}

function suffix(id) {
  return typeof id === "string" && id.length >= 8 ? id.slice(-8) : "n/a";
}

async function sessionFromUserId(admin, url, anonKey, userId) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: (
      await admin.auth.admin.getUserById(userId)
    ).data.user?.email,
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error("generate_link_failed");
  }
  const userClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const verified = await userClient.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "email",
  });
  if (verified.error || !verified.data.session) {
    throw new Error("verify_otp_failed");
  }
  return { userClient, accessToken: verified.data.session.access_token };
}

async function httpGet(path, cookieHeader) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  return {
    status: res.status,
    location: res.headers.get("location"),
  };
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const ref = url ? new URL(url).hostname.split(".")[0] : null;

const report = {
  projectRefOk: ref === "ctbqudtvrfezuoqcecyj",
  verificationDisabled: env.STUDENT_VERIFICATION_ENABLED !== "true",
  contactKeyConfigured: isContactRevealKeyConfigured(env),
  contactKeyVersion: getContactRevealCurrentKeyVersion(env),
  baseUrl: BASE,
  ownerRpc: null,
  studentRpc: null,
  anonRpc: null,
  http: {},
  ownerSuffix: null,
  studentSuffix: null,
};

if (!url || !anon || !service) {
  console.log(JSON.stringify({ ok: false, error: "missing_env" }, null, 2));
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: owners, error: ownerErr } = await admin
  .from("staff_members")
  .select("user_id, role, status")
  .eq("role", "owner")
  .eq("status", "active")
  .limit(1);

if (ownerErr || !owners?.length) {
  report.ownerLookup = "missing_active_owner";
} else {
  const ownerId = owners[0].user_id;
  report.ownerSuffix = suffix(ownerId);
  try {
    const { userClient } = await sessionFromUserId(admin, url, anon, ownerId);
    const { data, error } = await userClient.rpc("list_moderation_reports", {
      p_status: null,
      p_limit: 5,
    });
    report.ownerRpc = {
      ok: !error,
      class: error
        ? /owner authorization|42501/i.test(error.message)
          ? "denied"
          : "error"
        : "allowed",
      rowCount: Array.isArray(data) ? data.length : null,
    };

    const { data: count, error: countErr } = await userClient.rpc(
      "count_unresolved_moderation_reports",
    );
    report.ownerCount = {
      ok: !countErr,
      unresolved: countErr ? null : Number(count ?? 0),
    };
  } catch (e) {
    report.ownerRpc = { ok: false, class: "session_failed" };
  }
}

// Synthetic onboarded-looking student: pick any non-staff profile if present
const { data: staffRows } = await admin
  .from("staff_members")
  .select("user_id")
  .eq("status", "active");
const staffIds = new Set((staffRows ?? []).map((r) => r.user_id));

const { data: profiles } = await admin
  .from("profiles")
  .select("user_id, onboarding_completed_at")
  .not("onboarding_completed_at", "is", null)
  .limit(20);

const student = (profiles ?? []).find((p) => !staffIds.has(p.user_id));
if (!student) {
  report.studentRpc = { ok: false, class: "no_student_fixture" };
} else {
  report.studentSuffix = suffix(student.user_id);
  try {
    const { userClient } = await sessionFromUserId(
      admin,
      url,
      anon,
      student.user_id,
    );
    const { error } = await userClient.rpc("list_moderation_reports", {
      p_status: null,
      p_limit: 5,
    });
    report.studentRpc = {
      ok: Boolean(error),
      class: error
        ? /owner authorization|42501/i.test(error.message)
          ? "denied_as_expected"
          : "error"
        : "UNEXPECTED_ALLOWED",
    };
  } catch {
    report.studentRpc = { ok: false, class: "session_failed" };
  }
}

const anonClient = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { error: anonErr } = await anonClient.rpc("list_moderation_reports", {
  p_status: null,
  p_limit: 1,
});
report.anonRpc = {
  ok: Boolean(anonErr),
  class: anonErr ? "denied_as_expected" : "UNEXPECTED_ALLOWED",
};

try {
  report.http.unauthModeration = await httpGet("/owner/moderation");
  report.http.unauthModerationDetail = await httpGet(
    `/owner/moderation/${randomBytes(16).toString("hex").replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5")}`,
  );
} catch (e) {
  report.http.error = "fetch_failed_is_server_up";
}

report.ok =
  report.projectRefOk &&
  report.verificationDisabled &&
  report.contactKeyConfigured &&
  report.ownerRpc?.class === "allowed" &&
  report.studentRpc?.class === "denied_as_expected" &&
  report.anonRpc?.class === "denied_as_expected" &&
  report.http.unauthModeration?.status >= 300 &&
  report.http.unauthModeration?.status < 400;

writeFileSync(
  join(outDir, "moderation-smoke-report.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
console.log(report.ok ? "SMOKE_OK" : "SMOKE_NEEDS_ATTENTION");
process.exit(report.ok ? 0 : 1);
