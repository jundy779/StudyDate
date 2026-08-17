import "server-only";

import { cache } from "react";
import {
  getMembershipLimits,
  type MembershipPlanCode,
} from "@/lib/membership/limits";
import { createClient } from "@/lib/supabase/server";

export type MembershipSnapshot = {
  plan: MembershipPlanCode;
  startsAt: string | null;
  endsAt: string | null;
  source: string | null;
  status: string | null;
  plusExpired: boolean;
};

type MembershipRow = {
  plan_code: string;
  starts_at: string | null;
  ends_at: string | null;
  source: string | null;
  status: string | null;
  plus_expired?: boolean | null;
};

function mapRow(row: MembershipRow | null | undefined): MembershipSnapshot {
  if (!row || row.plan_code !== "plus") {
    return {
      plan: "free",
      startsAt: null,
      endsAt: null,
      source: null,
      status: null,
      plusExpired: Boolean(row?.plus_expired),
    };
  }
  return {
    plan: "plus",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    source: row.source,
    status: row.status,
    plusExpired: false,
  };
}

export const getMyMembership = cache(async (): Promise<MembershipSnapshot> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_membership");
  if (error) {
    throw new Error("Status paket belum dapat dimuat.");
  }
  const row = ((data ?? [])[0] as MembershipRow | undefined) ?? null;
  return mapRow(row);
});

export async function getMyMembershipLimits() {
  const membership = await getMyMembership();
  return {
    membership,
    limits: getMembershipLimits(membership.plan),
  };
}

export function hasPlusEntitlement(membership: MembershipSnapshot): boolean {
  return membership.plan === "plus";
}
