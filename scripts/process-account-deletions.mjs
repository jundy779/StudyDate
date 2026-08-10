import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separator = line.indexOf("=");
    const name = line.slice(0, separator).trim();
    process.env[name] ??= line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("Server environment is not configured.");
}

const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
const limit = Number(limitArgument?.split("=")[1] ?? "10");
if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
  throw new Error("--limit must be an integer between 1 and 25.");
}
const requestArgument = process.argv.find((argument) =>
  argument.startsWith("--request-id="),
);
const requestId = requestArgument?.split("=")[1] ?? null;
if (
  requestId &&
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    requestId,
  )
) {
  throw new Error("--request-id must be a UUID.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const failureCodes = {
  storage: "storage_cleanup_failed",
  database: "database_cleanup_failed",
  auth: "auth_cleanup_failed",
  finalize: "finalize_failed",
};

function firstRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

async function markFailed(job, failureCode) {
  if (!job?.request_id || !job?.lease_token) return;
  await admin.rpc("fail_account_deletion_job", {
    p_request_id: job.request_id,
    p_lease_token: job.lease_token,
    p_failure_code: failureCode,
  });
}

async function claimJob() {
  const { data, error } = requestId
    ? await admin.rpc("claim_account_deletion_job_by_id", {
        p_request_id: requestId,
      })
    : await admin.rpc("claim_account_deletion_job");
  if (error) throw Object.assign(new Error("Claim failed."), { stage: "database" });
  return firstRow(data) ?? null;
}

async function removeOwnedStorage(job) {
  const { data, error } = await admin.rpc("list_account_deletion_storage_objects", {
    p_request_id: job.request_id,
    p_lease_token: job.lease_token,
  });
  if (error) throw Object.assign(new Error("Storage inventory failed."), { stage: "storage" });

  const objectsByBucket = new Map();
  for (const object of data ?? []) {
    const objects = objectsByBucket.get(object.bucket_name) ?? [];
    objects.push(object.object_key);
    objectsByBucket.set(object.bucket_name, objects);
  }

  for (const [bucket, objects] of objectsByBucket) {
    for (let index = 0; index < objects.length; index += 100) {
      const { error: removalError } = await admin.storage
        .from(bucket)
        .remove(objects.slice(index, index + 100));
      if (removalError) {
        throw Object.assign(new Error("Storage cleanup failed."), { stage: "storage" });
      }
    }
  }
}

async function authUserExists(job) {
  if (!job.user_id) return false;
  const lookup = await admin.auth.admin.getUserById(job.user_id);
  if (lookup.error && !/not found/i.test(lookup.error.message)) {
    throw Object.assign(new Error("Auth lookup failed."), { stage: "auth" });
  }
  return Boolean(lookup.data?.user);
}

async function cleanupDatabase(job) {
  const { error } = await admin.rpc("cleanup_account_deletion_database", {
    p_request_id: job.request_id,
    p_lease_token: job.lease_token,
  });
  if (error) {
    throw Object.assign(new Error("Database cleanup failed."), { stage: "database" });
  }
}

async function deleteAuthUser(job) {
  if (!job.user_id) return;

  const { error } = await admin.auth.admin.deleteUser(job.user_id);
  if (error && !/not found/i.test(error.message)) {
    throw Object.assign(new Error("Auth cleanup failed."), { stage: "auth" });
  }
}

async function completeJob(job) {
  const { error } = await admin.rpc("complete_account_deletion_job", {
    p_request_id: job.request_id,
    p_lease_token: job.lease_token,
  });
  if (error) throw Object.assign(new Error("Finalize failed."), { stage: "finalize" });
}

let completed = 0;
let failed = 0;

for (let index = 0; index < limit; index += 1) {
  let job;
  try {
    job = await claimJob();
    if (!job) break;
    if (await authUserExists(job)) {
      await removeOwnedStorage(job);
      await cleanupDatabase(job);
      await deleteAuthUser(job);
    }
    await completeJob(job);
    completed += 1;
  } catch (error) {
    failed += 1;
    const stage = typeof error?.stage === "string" ? error.stage : "database";
    await markFailed(job, failureCodes[stage] ?? failureCodes.database);
  }
  if (requestId) break;
}

const { data: purged, error: purgeError } = await admin.rpc(
  "purge_expired_account_deletion_retention",
  { p_limit: 100 },
);
if (purgeError) {
  process.stderr.write("Retention cleanup unavailable.\n");
  process.exitCode = 1;
}
const { data: purgedRequests, error: requestPurgeError } = await admin.rpc(
  "purge_expired_account_deletion_requests",
  { p_limit: 100 },
);
if (requestPurgeError) {
  process.stderr.write("Deletion request retention cleanup unavailable.\n");
  process.exitCode = 1;
}
if (failed > 0) process.exitCode = 1;

process.stdout.write(
  `Account deletion jobs: ${completed} completed, ${failed} failed; ${Number(purged ?? 0)} retention rows and ${Number(purgedRequests ?? 0)} completed requests purged.\n`,
);
