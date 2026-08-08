/**
 * Hapus total akun uji live-audit (kampus "Universitas Audit…") dari Supabase.
 * Hanya auth.admin.deleteUser — baris app ikut CASCADE.
 *
 *   node scripts/purge-audit-test-accounts.mjs --yes
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const confirm = process.argv.includes("--yes");
if (!confirm) {
  console.error("Tolak dry-run tanpa --yes. Jalankan: node scripts/purge-audit-test-accounts.mjs --yes");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l.slice(i + 1).trim().replace(/^["']|["']$/g, ""),
      ];
    }),
);

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: rows, error } = await admin
  .from("profiles")
  .select("user_id, public_alias, campus")
  .ilike("campus", "Universitas Audit%");

if (error) {
  console.error("LIST_FAILED", error.message);
  process.exit(1);
}

const targets = rows ?? [];
console.log("FOUND", targets.length);

let ok = 0;
let fail = 0;
for (const row of targets) {
  const { error: delError } = await admin.auth.admin.deleteUser(row.user_id);
  if (delError) {
    fail += 1;
    console.error("DELETE_FAIL", row.public_alias, delError.message);
  } else {
    ok += 1;
    console.log("DELETED", row.public_alias, "|", row.campus);
  }
}

const { count } = await admin
  .from("profiles")
  .select("user_id", { count: "exact", head: true })
  .ilike("campus", "Universitas Audit%");

console.log("DONE", { deleted: ok, failed: fail, remainingAudit: count ?? 0 });
if (fail > 0) process.exitCode = 1;
