import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { VerificationRequestStatus } from "./constants";

export type VerificationStatus = {
  id: string;
  method: "academic_pending" | "campus_email" | "student_card";
  status: VerificationRequestStatus;
  pddikti_match_status:
    | "not_checked"
    | "matched"
    | "not_found"
    | "mismatch"
    | "unavailable";
  ownership_status:
    | "not_checked"
    | "campus_email_verified"
    | "document_verified"
    | "failed";
  submitted_at: string;
  expires_at: string;
  rejection_reason_code: string | null;
};

export async function getLatestVerificationStatus(
  userId: string,
): Promise<VerificationStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_verification_requests")
    .select(
      "id, method, status, pddikti_match_status, ownership_status, submitted_at, expires_at, rejection_reason_code",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<VerificationStatus>();

  if (error) return null;
  return data;
}
