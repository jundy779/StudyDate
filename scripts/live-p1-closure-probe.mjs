/**
 * Targeted live P1 closure probe (sanitized).
 * Does not print secrets, emails, UUIDs, ciphertext, or message bodies.
 *
 * Usage: node --experimental-strip-types scripts/live-p1-closure-probe.mjs
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  decryptContactValue,
  encryptContactValue,
} from "../lib/contact-reveal/crypto-core.ts";

function loadEnv() {
  const raw = fs.readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    env[line.slice(0, i)] = line.slice(i + 1);
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const ref = url ? new URL(url).hostname.split(".")[0] : null;

const report = {
  projectRefOk: ref === "ctbqudtvrfezuoqcecyj",
  verificationDisabled: env.STUDENT_VERIFICATION_ENABLED !== "true",
  contactKeyConfigured: Boolean(
    env.CONTACT_REVEAL_ENCRYPTION_KEY &&
      env.CONTACT_REVEAL_ENCRYPTION_KEY.length >= 32,
  ),
  contactKeyVersion: env.CONTACT_REVEAL_KEY_VERSION || "1",
  moderationMigration: {
    listRpc: null,
    eventsTable: null,
  },
  anonDenied: null,
  localCryptoDrill: null,
  moderationApplied: false,
  ok: false,
};

if (!url || !anon || !service) {
  console.log(JSON.stringify({ ok: false, error: "missing_env" }, null, 2));
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonClient = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error: listErr } = await admin.rpc("list_moderation_reports", {
  p_status: null,
  p_limit: 1,
});
report.moderationMigration.listRpc = listErr
  ? {
      exists: !/could not find|PGRST202|404/i.test(listErr.message),
      code: listErr.code ?? null,
      class: /owner authorization|42501|authentication required/i.test(
        listErr.message,
      )
        ? "auth_gate"
        : /could not find|PGRST202/i.test(listErr.message)
          ? "missing"
          : "other",
    }
  : { exists: true, code: null, class: "callable" };

const { error: tableErr } = await admin
  .from("moderation_report_events")
  .select("id")
  .limit(1);
if (!tableErr) {
  report.moderationMigration.eventsTable = {
    exists: true,
    class: "readable_service_role",
  };
} else if (
  /does not exist|PGRST205|42P01|Could not find the table/i.test(tableErr.message)
) {
  report.moderationMigration.eventsTable = { exists: false, class: "missing" };
} else {
  report.moderationMigration.eventsTable = {
    exists: "unknown",
    class: "error",
  };
}

const { error: anonErr } = await anonClient.rpc("list_moderation_reports", {
  p_status: null,
  p_limit: 1,
});
report.anonDenied = Boolean(anonErr);

const drillKey = Buffer.alloc(32, 7).toString("hex");
const sealed = encryptContactValue("synthetic_live_probe", {
  CONTACT_REVEAL_ENCRYPTION_KEY: drillKey,
  CONTACT_REVEAL_KEY_VERSION: "1",
});
let roundtrip = false;
try {
  roundtrip =
    decryptContactValue(sealed, {
      CONTACT_REVEAL_ENCRYPTION_KEY: drillKey,
      CONTACT_REVEAL_KEY_VERSION: "1",
    }) === "synthetic_live_probe";
} catch {
  roundtrip = false;
}
report.localCryptoDrill = {
  roundtrip,
  keyVersion: sealed.keyVersion,
};

report.moderationApplied =
  report.moderationMigration.listRpc?.class === "auth_gate" ||
  report.moderationMigration.listRpc?.class === "callable" ||
  report.moderationMigration.listRpc?.exists === true;

report.ok =
  report.projectRefOk &&
  report.verificationDisabled &&
  report.contactKeyConfigured &&
  report.localCryptoDrill.roundtrip &&
  report.anonDenied;

console.log(JSON.stringify(report, null, 2));
console.log(
  report.moderationApplied
    ? "moderation_schema: present_or_gated"
    : "moderation_schema: NOT_APPLIED_REMOTELY",
);
