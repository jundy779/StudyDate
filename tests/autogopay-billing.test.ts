import assert from "node:assert/strict";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { autoGoPayWebhookSchema, billingOfferSchema } from "../lib/billing/validation.ts";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/202608210001_autogopay_membership_billing_v1.sql"),
  "utf8",
);
const packageMigration = readFileSync(
  join(root, "supabase/migrations/202608220001_plus_duration_packages.sql"),
  "utf8",
);
const adapter = readFileSync(join(root, "lib/billing/autogopay.ts"), "utf8");
const webhook = readFileSync(
  join(root, "app/api/integrations/autogopay/webhook/route.ts"),
  "utf8",
);
const service = readFileSync(join(root, "lib/billing/service.ts"), "utf8");
const studentPage = readFileSync(join(root, "app/app/membership/page.tsx"), "utf8");
const ownerPage = readFileSync(join(root, "app/owner/memberships/page.tsx"), "utf8");
const env = readFileSync(join(root, ".env.example"), "utf8");

test("Owner offer is bounded and checkout defaults off", () => {
  assert.equal(
    billingOfferSchema.safeParse({
      packageCode: "plus_30",
      amountIdr: 19_000,
      isActive: "true",
    }).success,
    true,
  );
  assert.equal(
    billingOfferSchema.safeParse({
      packageCode: "plus_30",
      amountIdr: 10_000_001,
      isActive: true,
    }).success,
    false,
  );
  assert.equal(
    billingOfferSchema.safeParse({
      packageCode: "plus_365",
      amountIdr: 49_000,
      isActive: true,
    }).success,
    false,
  );
  assert.match(packageMigration, /package_code in \('plus_7', 'plus_30', 'plus_90'\)/);
  assert.match(packageMigration, /\(true, 'plus_7', 9000, 7, false/);
  assert.match(packageMigration, /\(true, 'plus_30', 19000, 30, false/);
  assert.match(packageMigration, /\(true, 'plus_90', 49000, 90, false/);
  assert.doesNotMatch(packageMigration, /bool_or\(offer\.is_active\)/);
  assert.match(ownerPage, /Harga \(rupiah\)/);
  assert.match(ownerPage, /Tersedia/);
  assert.match(env, /AUTOGOPAY_ENABLED=false/);
  assert.doesNotMatch(env, /agp_[0-9a-f]+/i);
});

test("adapter is GoPay QRIS-only and validates provider URL", () => {
  assert.match(adapter, /"\/qris\/generate"/);
  assert.match(adapter, /"\/qris\/status"/);
  assert.match(adapter, /"\/qris\/cancel"/);
  assert.match(adapter, /checkout\.origin !== CHECKOUT_ORIGIN/);
  assert.match(adapter, /AbortSignal\.timeout/);
  assert.match(adapter, /response\.body\.getReader\(\)/);
  assert.match(adapter, /received > MAX_RESPONSE_BYTES/);
  assert.doesNotMatch(adapter, /response\.text\(\)/);
  assert.doesNotMatch(adapter, /ovo|shopeepay|orderkuota/i);
  assert.match(service, /create_or_reuse_my_membership_payment_order/);
  assert.match(studentPage, /Pembayaran diproses melalui GoPay QRIS/);
});

test("raw-body HMAC is stable and rejects modified bytes", () => {
  const key = "rotated-secret-only-for-test";
  const raw = Buffer.from('{"event":"transaction.received","transaction":{"amount":19000}}');
  const signature = createHmac("sha256", key).update(raw).digest("hex");
  const expected = Buffer.from(createHmac("sha256", key).update(raw).digest("hex"));
  const supplied = Buffer.from(signature);
  assert.equal(timingSafeEqual(expected, supplied), true);
  assert.notEqual(
    signature,
    createHmac("sha256", key).update(Buffer.concat([raw, Buffer.from(" ")])).digest("hex"),
  );
  assert.match(webhook, /request\.arrayBuffer\(\)/);
  assert.match(webhook, /verifyAutoGoPaySignature\(raw/);
  assert.match(adapter, /timingSafeEqual/);
});

test("webhook accepts only strict paid GoPay transaction shape", () => {
  const valid = {
    event: "transaction.received",
    timestamp: "2026-08-21 10:00:00",
    transaction: {
      transaction_id: "trx-1",
      order_id: "order-1",
      amount: 19_000,
      status: "PAID",
      payment_method: "QRIS",
      paid_at: "2026-08-21 09:59:58",
    },
  };
  assert.equal(autoGoPayWebhookSchema.safeParse(valid).success, true);
  assert.equal(
    autoGoPayWebhookSchema.safeParse({
      ...valid,
      transaction: { ...valid.transaction, amount: 1, payment_method: "QRIS_SHOPEEPAY" },
    }).success,
    false,
  );
  assert.match(webhook, /x-callback-event/);
  assert.match(migration, /provider_order_id <> p_provider_order_id/);
  assert.match(migration, /payment\.amount_idr <> p_amount_idr/);
});

test("finalization is idempotent, renewal-safe, and deletion-safe", () => {
  assert.match(migration, /if payment\.status = 'paid' then return 'duplicate'/);
  assert.match(migration, /for update/);
  assert.match(
    migration,
    /current_entitlement\.ends_at \+ make_interval\(days => payment\.duration_days\)/,
  );
  assert.match(
    migration,
    /timezone\('utc', now\(\)\) \+ make_interval\(days => payment\.duration_days\)/,
  );
  assert.match(migration, /source, starts_at, ends_at[\s\S]*'future_payment'/);
  assert.match(migration, /status not in \('pending', 'cancelled', 'expired'\)/);
  assert.match(migration, /delete from public\.membership_payment_orders where user_id = old\.user_id/);
  assert.match(migration, /on delete restrict/);
  assert.match(
    migration,
    /duration_days is null or duration_days between 1 and 365/,
  );
  assert.match(
    migration,
    /payment\.created_at <= timezone\('utc', now\(\)\) - interval '2 minutes'/,
  );
  assert.match(
    migration,
    /payment\.user_id::text \|\| ':membership-entitlement'/,
  );
  assert.match(
    migration,
    /p_target_user_id::text \|\| ':membership-entitlement'/,
  );
  assert.match(
    migration,
    /grant execute on function public\.attach_membership_payment_provider\([\s\S]*?\) to service_role/,
  );
  assert.match(
    migration,
    /grant execute on function public\.fail_membership_payment_generation\(text, text\)[\s\S]*?to service_role/,
  );
  assert.match(
    migration,
    /grant execute on function public\.finalize_membership_payment\(text, text, integer, timestamptz\)[\s\S]*?to service_role/,
  );
});
