import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const expectedProjectRef = "ctbqudtvrfezuoqcecyj";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert.ok(url && publishableKey && serviceRoleKey, "Live audit configuration missing.");
assert.equal(new URL(url).hostname.split(".")[0], expectedProjectRef);
assert.notEqual(process.env.STUDENT_VERIFICATION_ENABLED, "true");
assert.notEqual(process.env.PDDIKTI_LOOKUP_PROVIDER_ENABLED, "true");

const anon = createClient(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const checks = {
  project_verified: true,
  flags_fail_closed: true,
  migration_present: false,
  bucket_private: false,
  anon_request_rows_hidden: false,
  anon_health_rows_hidden: false,
  cleanup_health_available: false,
};

const { data: cleanupCount, error: migrationError } = await admin.rpc(
  "count_due_student_verification_evidence",
  { p_now: new Date().toISOString() },
);
assert.ifError(migrationError);
checks.migration_present = Number.isInteger(cleanupCount);

const { data: bucket, error: bucketError } = await admin.storage.getBucket(
  "student-verification-evidence",
);
assert.ifError(bucketError);
checks.bucket_private =
  bucket?.public === false &&
  bucket.file_size_limit === 5_242_880 &&
  ["image/jpeg", "image/png", "image/webp"].every((type) =>
    bucket.allowed_mime_types?.includes(type),
  );

const { data: anonRequests, error: anonRequestsError } = await anon
  .from("student_verification_requests")
  .select("id")
  .limit(1);
checks.anon_request_rows_hidden =
  Boolean(anonRequestsError) || anonRequests?.length === 0;

const { data: anonHealth, error: anonHealthError } = await anon
  .from("student_verification_cleanup_health")
  .select("singleton")
  .limit(1);
checks.anon_health_rows_hidden =
  Boolean(anonHealthError) || anonHealth?.length === 0;

const { data: health, error: healthError } = await admin
  .from("student_verification_cleanup_health")
  .select(
    "last_succeeded_at,last_status,last_failed_count,last_remaining_count",
  )
  .eq("singleton", true)
  .maybeSingle();
assert.ifError(healthError);
checks.cleanup_health_available = Boolean(health);

for (const [name, passed] of Object.entries(checks)) {
  console.log(`${name}: ${passed}`);
}
assert.ok(Object.values(checks).every(Boolean), "Live verification audit failed.");
