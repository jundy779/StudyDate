import "server-only";

import { createClient } from "@/lib/supabase/server";

export type OwnerMembershipRecord = {
  public_alias: string;
  plan_code: "free" | "plus";
  starts_at: string | null;
  ends_at: string | null;
  source: string | null;
  status: string | null;
};

type LookupRow = {
  public_alias: string;
  plan_code: string;
  starts_at: string | null;
  ends_at: string | null;
  source: string | null;
  status: string | null;
};

export async function lookupMembershipByEmail(email: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lookup_membership_ops", {
    p_email: email,
  });
  if (error) throw new Error("Status paket belum dapat dimuat.");
  const row = ((data ?? [])[0] as LookupRow | undefined) ?? null;
  if (!row) return null;
  return {
    public_alias: row.public_alias,
    plan_code: row.plan_code === "plus" ? "plus" : "free",
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    source: row.source,
    status: row.status,
  } satisfies OwnerMembershipRecord;
}

export async function manageMembershipByEmail(
  email: string,
  action: "grant_plus" | "revoke_plus",
  durationDays?: number,
): Promise<"saved" | "not_found" | "unchanged" | "error"> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "manage_user_membership_by_email",
    {
      p_email: email,
      p_action: action,
      p_duration_days: durationDays ?? null,
    },
  );
  if (error) return "error";
  if (data === "not_found" || data === "unchanged" || data === "saved") {
    return data;
  }
  return "error";
}
