import "server-only";

import {
  parseClaimRpcPayload,
  type EarlyAccessClaimResult,
} from "@/lib/early-access/claim-state";
import { createClient } from "@/lib/supabase/server";

/**
 * Claims matching Early Access waitlist for the current session user.
 * Email and user id are derived server-side by Postgres from auth.uid().
 * Never accepts authoritative email/user_id from the request body.
 */
export async function claimEarlyAccessForCurrentUser(): Promise<EarlyAccessClaimResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_early_access_for_me");

  if (error || data == null) {
    // Fail closed without leaking waitlist membership.
    return parseClaimRpcPayload({ outcome: "not_eligible", prefill: null });
  }

  return parseClaimRpcPayload(data);
}
