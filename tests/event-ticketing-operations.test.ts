import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../supabase/migrations/202610190001_event_ticketing_operations.sql", import.meta.url);
const cronUrl = new URL("../app/api/cron/event-ticket-orders/route.ts", import.meta.url);
const providerUrl = new URL("../lib/payments/event-ticket-provider.ts", import.meta.url);

test("ticket operations are authorized and concurrency safe", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /event_can_manage_registrations\(target\.id, actor\)/);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /current_setting\('request\.jwt\.claim\.role', true\) is distinct from 'service_role'/);
  assert.match(sql, /revoke all on function public\.reconcile_campus_event_ticket_payment/);
  assert.match(sql, /grant execute on function public\.reconcile_campus_event_ticket_payment[\s\S]*to service_role/);
});

test("expired and cancelled orders return reserved quota", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /quantity_reserved = greatest\(0, ticket\.quantity_reserved - item\.quantity\)/);
  assert.match(sql, /redemption_count = greatest\(0, redemption_count - 1\)/);
  assert.match(sql, /campus_event_rsvps_release_ticket_order/);
  assert.match(sql, /old\.status = 'going' and new\.status <> 'going'/);
});

test("cron and payment adapter fail closed", async () => {
  const [cron, provider] = await Promise.all([readFile(cronUrl, "utf8"), readFile(providerUrl, "utf8")]);
  assert.match(cron, /EVENT_TICKETING_ENABLED !== "true"/);
  assert.match(cron, /Bearer \$\{secret\}/);
  assert.match(provider, /EVENT_TICKET_PAYMENTS_ENABLED !== "true"/);
  assert.match(provider, /Penyedia pembayaran tiket belum dipilih/);
});
