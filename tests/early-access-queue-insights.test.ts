import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  canSendReminder,
  classifyEmailDomain,
  daysSince,
  isStaleWaiting,
  needsClaimReminder,
  waitingAgeLabel,
} from "../lib/early-access/queue-insights.ts";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/202610210005_early_access_queue_insights_v1.sql");
const DAY = 86_400_000;
const now = Date.parse("2026-10-21T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

test("jenis email mengikuti aturan akses per akun", () => {
  assert.equal(classifyEmailDomain("a@ui.ac.id"), "campus");
  assert.equal(classifyEmailDomain("a@student.nurulfikri.ac.id"), "campus");
  assert.equal(classifyEmailDomain("a@sman1.sch.id"), "school");
  assert.equal(classifyEmailDomain("A@Gmail.com"), "personal");
  assert.equal(classifyEmailDomain("a@vk.com"), "personal");
  assert.equal(classifyEmailDomain("a@yahoo.com"), "other");
  assert.equal(classifyEmailDomain("a@fakeac.id"), "other");
});

test("umur antrean dan tanda terlambat", () => {
  assert.equal(daysSince(ago(20 * DAY), now), 20);
  assert.equal(isStaleWaiting("waiting", ago(7 * DAY), now), true);
  assert.equal(isStaleWaiting("waiting", ago(6 * DAY), now), false);
  assert.equal(isStaleWaiting("approved", ago(30 * DAY), now), false);
  assert.equal(waitingAgeLabel(0), "Menunggu sejak hari ini");
  assert.equal(waitingAgeLabel(12), "Menunggu 12 hari");
});

test("pengingat hanya untuk undangan lama, dengan jeda 24 jam", () => {
  assert.equal(needsClaimReminder("approved", ago(3 * DAY), now), true);
  assert.equal(needsClaimReminder("approved", ago(2 * DAY), now), false);
  assert.equal(needsClaimReminder("claimed", ago(9 * DAY), now), false);
  assert.equal(canSendReminder(ago(25 * 3_600_000), now), true);
  assert.equal(canSendReminder(ago(2 * 3_600_000), now), false);
  assert.equal(canSendReminder(null, now), false);
});

test("database: v3 menambah filter dan urutan tanpa melonggarkan izin", () => {
  const list = migration.match(/create or replace function public\.list_early_access_waitlist_ops_v3\([\s\S]*?\$\$;/)?.[0] ?? "";
  assert.match(list, /staff_has_ops_capability\('early_access\.read'\)/);
  assert.match(list, /'stale_waiting', 'pending_claim', 'unsent_invitation'/);
  assert.match(list, /interval '7 days'/);
  assert.match(list, /interval '3 days'/);
  assert.match(list, /least\(greatest\(coalesce\(p_limit, 25\), 1\), 50\)/);
  const summary = migration.match(/create or replace function public\.get_early_access_queue_summary\(\)[\s\S]*?\$\$;/)?.[0] ?? "";
  assert.match(summary, /staff_has_ops_capability\('early_access\.read'\)/);
  assert.doesNotMatch(summary, /email/);
  const reminder = migration.match(/create or replace function public\.prepare_early_access_reminder\([\s\S]*?\$\$;/)?.[0] ?? "";
  assert.match(reminder, /staff_has_ops_capability\('early_access\.review'\)/);
  assert.match(reminder, /waitlist\.status = 'approved'/);
  assert.match(reminder, /interval '24 hours'/);
  for (const fn of ["list_early_access_waitlist_ops_v3", "get_early_access_queue_summary", "prepare_early_access_reminder"]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\)\\s+from public, anon`), fn);
  }
});

test("aksi pengingat lewat server action yang sama dan jeda dijelaskan", () => {
  const actions = read("app/staff/early-access/actions.ts");
  assert.match(actions, /action === "remind"/);
  assert.match(actions, /prepareEarlyAccessReminder\(email\)/);
  assert.match(actions, /remind_cooldown/);
  assert.match(read("lib/staff/validation.ts"), /"resend", "remind"/);
  const queue = read("components/staff/early-access-queue.tsx");
  assert.match(queue, /Kirim pengingat/);
  assert.match(queue, /Menunggu lebih dari 7 hari/);
  assert.match(queue, /classifyEmailDomain\(row\.email\)/);
});

test("panel Tolak dan Minta perbaikan tidak bisa terbuka bersamaan dan alasan dicek sebelum kirim", () => {
  const queue = read("components/staff/early-access-queue.tsx");
  assert.match(queue, /<details className="relative" name="early-access-decision">/);
  assert.match(queue, /<DecisionSubmitButton/);
  const button = read("components/staff/decision-submit-button.tsx");
  assert.match(button, /input\[name="reasonCode"\]:checked/);
  assert.match(button, /event\.preventDefault\(\)/);
  assert.match(read("app/staff/early-access/actions.ts"), /#hasil-pemeriksaan/);
  assert.match(queue, /id="hasil-pemeriksaan"/);
});

test("panel yang terbuka bisa ditutup dan tidak menghalangi baris lain", () => {
  const queue = read("components/staff/early-access-queue.tsx");
  assert.match(queue, /<DecisionPanelCloser group="early-access-decision" \/>/);
  assert.match(queue, /cancelLabel="Batal"/);
  const closer = read("components/staff/decision-submit-button.tsx");
  assert.match(closer, /addEventListener\("pointerdown"/);
  assert.match(closer, /event\.key !== "Escape"/);
  assert.match(closer, /!panel\.contains\(target\)/);
});

test("tanpa migration 202610210005, tombol pengingat kembali ke kirim ulang undangan", () => {
  const queue = read("components/staff/early-access-queue.tsx");
  assert.match(queue, /const remindersAvailable = summary !== null;/);
  assert.match(queue, /!remindersAvailable \? \(\s*<DirectReviewAction[\s\S]{0,120}action="resend"/);
});

test("tombol keputusan menunjukkan sedang mengirim, panel tertutup setelah ada hasil", () => {
  const button = read("components/staff/decision-submit-button.tsx");
  assert.match(button, /useFormStatus/);
  assert.match(button, /"Mengirim\.\.\."/);
  assert.match(button, /useSearchParams\(\)\.get\("state"\)/);
  assert.match(button, /getElementById\("hasil-pemeriksaan"\)\?\.scrollIntoView/);
  const queue = read("components/staff/early-access-queue.tsx");
  assert.match(queue, /<PendingSubmitButton/);
});
