import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  EARLY_ACCESS_BULK_APPROVE_LIMIT,
  earlyAccessBulkApproveSchema,
} from "../lib/staff/validation.ts";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/202610300001_early_access_duplicates_event_email_v1.sql");
const actions = read("app/staff/early-access/actions.ts");
const queue = read("components/staff/early-access-queue.tsx");
const bar = read("components/staff/early-access-bulk-bar.tsx");
const service = read("lib/staff/service.ts");

test("bulk approve input is bounded and deduplicated", () => {
  assert.equal(EARLY_ACCESS_BULK_APPROVE_LIMIT, 20);
  const ok = earlyAccessBulkApproveSchema.safeParse({ emails: ["A@kampus.ac.id", "a@kampus.ac.id", "b@kampus.ac.id"] });
  assert.equal(ok.success, true);
  assert.deepEqual(ok.success && ok.data.emails, ["a@kampus.ac.id", "b@kampus.ac.id"]);
  assert.equal(earlyAccessBulkApproveSchema.safeParse({ emails: [] }).success, false);
  assert.equal(earlyAccessBulkApproveSchema.safeParse({ emails: ["bukan-email"] }).success, false);
  const many = Array.from({ length: 21 }, (_, index) => `u${index}@kampus.ac.id`);
  assert.equal(earlyAccessBulkApproveSchema.safeParse({ emails: many }).success, false);
});

test("bulk approve requires review capability and never re-sends invitations", () => {
  assert.match(actions, /export async function bulkApproveEarlyAccess/);
  assert.match(actions, /bulkApproveEarlyAccess[\s\S]*requireStaffCapability\("early_access\.review"\)/);
  assert.match(actions, /if \(reviewed\.invitation_sent_at\)[\s\S]*skipped \+= 1/);
  assert.match(actions, /state: "bulk_approved"/);
  assert.match(bar, /Setujui \{count\} pendaftar\?/);
  assert.match(bar, /form=\{?`?\$?\{?EARLY_ACCESS_BULK_FORM_ID|\[form="\$\{EARLY_ACCESS_BULK_FORM_ID\}"\]/);
  assert.match(queue, /bulkEnabled = canReview && status === "waiting"/);
  assert.match(queue, /form=\{EARLY_ACCESS_BULK_FORM_ID\}/);
});

test("bulk result counts from the URL are clamped", () => {
  assert.match(queue, /function boundedCount/);
  assert.match(queue, /Math\.min\(Math\.floor\(parsed\), 20\)/);
});

test("duplicate hints are staff-only and shown as a hint, not a verdict", () => {
  assert.match(migration, /function public\.early_access_identity_key/);
  assert.match(migration, /early_access_waitlist_identity_key_idx/);
  assert.match(migration, /get_early_access_duplicate_hints[\s\S]*staff_has_ops_capability\('early_access\.read'\)/);
  assert.match(migration, /revoke all on function public\.get_early_access_duplicate_hints\(text\[\]\) from public, anon/);
  assert.match(service, /getEarlyAccessDuplicateHints/);
  assert.match(service, /if \(error\) return hints;/);
  assert.match(queue, /Mungkin pendaftar ganda/);
  assert.match(queue, /Ini hanya petunjuk/);
});
