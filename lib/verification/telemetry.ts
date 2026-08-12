import "server-only";

import { createServerAdminClient } from "@/lib/supabase/admin";
import type { AcademicLookupResult } from "./provider-core";

function latencyBucket(latencyMs: number) {
  if (latencyMs < 2_000) return "under_2s";
  if (latencyMs < 10_000) return "2_to_10s";
  if (latencyMs <= 25_000) return "10_to_25s";
  return "over_25s";
}

function candidateBucket(count: number) {
  if (count === 0) return "zero";
  if (count === 1) return "one";
  if (count <= 10) return "two_to_ten";
  return "over_ten";
}

export async function recordProviderMetric(result: AcademicLookupResult) {
  const admin = createServerAdminClient();
  if (!admin) return;
  await admin.rpc("record_student_verification_provider_metric", {
    p_outcome: result.outcome,
    p_latency_bucket: latencyBucket(result.latencyMs),
    p_candidate_bucket: candidateBucket(result.candidateCount),
    p_schema_valid: result.schemaValid,
    p_academic_status_present: result.academicStatusPresent,
  });
}
