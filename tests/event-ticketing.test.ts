import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../supabase/migrations/202610170004_event_ticketing_v1.sql", import.meta.url);
const participantUrl = new URL("../app/app/events/[publicSlug]/tickets/page.tsx", import.meta.url);
const manageUrl = new URL("../app/app/events/[publicSlug]/manage/tickets/page.tsx", import.meta.url);

test("ticketing keeps money integer based and orders idempotent", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /price_amount integer/);
  assert.match(sql, /unique \(buyer_user_id, idempotency_key\)/);
  assert.match(sql, /for update/i);
});

test("ticketing tables use RLS and remove direct client grants", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const table of ["campus_event_ticket_types", "campus_event_discount_codes", "campus_event_ticket_orders", "campus_event_ticket_order_items", "campus_event_payment_attempts", "campus_event_payment_webhooks"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table}`));
  }
  assert.match(sql, /event_can_manage_registrations\(target\.id, actor\)/);
});

test("ticketing UI stays behind its server feature flag", async () => {
  const participant = await readFile(participantUrl, "utf8");
  const manage = await readFile(manageUrl, "utf8");
  assert.match(participant, /EVENT_TICKETING_ENABLED !== "true"/);
  assert.match(manage, /EVENT_TICKETING_ENABLED !== "true"/);
  assert.match(participant, /Tiket belum tersedia/);
  assert.match(manage, /Atur tiket acara/);
});

test("free ticket checkout needs a confirmed RSVP and allows one active ticket", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const participant = await readFile(participantUrl, "utf8");
  assert.match(sql, /ticket\.price_amount <> 0 or ticket\.access_type <> 'public' or p_quantity <> 1/);
  assert.match(sql, /registration_status is distinct from 'going'/);
  assert.match(sql, /campus_event_ticket_orders_one_active_per_buyer_idx/);
  assert.match(sql, /p_quantity_total < reserved \+ sold/);
  assert.match(participant, /event\.rsvp_status !== "going"/);
});

test("ticket order expiry uses the same service-role guard as other functions", async () => {
  const guard = await readFile(
    new URL("../supabase/migrations/202610210001_event_ticket_order_expiry_guard.sql", import.meta.url),
    "utf8",
  );
  assert.match(guard, /session_user not in \('postgres', 'supabase_admin'\)/);
  assert.match(guard, /coalesce\(auth\.role\(\), ''\) <> 'service_role'/);
  const body = guard.slice(guard.indexOf("create or replace function"));
  assert.doesNotMatch(body, /request\.jwt\.claim\.role/);
  assert.doesNotMatch(guard, /cron\.schedule/);
  assert.match(guard, /grant execute on function public\.expire_campus_event_ticket_orders\(integer\)\s+to service_role/);
});
