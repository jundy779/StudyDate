import "server-only";

import {
  MUTUAL_INTEREST_COPY,
  type MutualInterestState,
} from "@/lib/mutual-interest/constants";
import { createClient } from "@/lib/supabase/server";

type RpcRow = {
  eligible: boolean;
  selected_by_me: boolean;
  mutual: boolean;
  mutual_at: string | null;
  can_withdraw: boolean;
};

function mapRow(row: RpcRow | null | undefined): MutualInterestState {
  if (!row) {
    return {
      eligible: false,
      selectedByMe: false,
      mutual: false,
      mutualAt: null,
      canWithdraw: false,
    };
  }

  return {
    eligible: Boolean(row.eligible),
    selectedByMe: Boolean(row.selected_by_me),
    mutual: Boolean(row.mutual),
    mutualAt: row.mutual_at ? String(row.mutual_at) : null,
    canWithdraw: Boolean(row.can_withdraw),
  };
}

function mapMutualError(message: string | undefined): string {
  const text = (message ?? "").toLowerCase();
  if (text.includes("conversation closed")) {
    return MUTUAL_INTEREST_COPY.closedNote;
  }
  if (text.includes("mutual interest unavailable")) {
    return MUTUAL_INTEREST_COPY.notReadyNote;
  }
  return MUTUAL_INTEREST_COPY.genericError;
}

export async function getMutualInterestState(
  publicId: string,
): Promise<MutualInterestState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_mutual_interest_state", {
    p_public_id: publicId,
  });

  if (error) {
    return mapRow(null);
  }

  return mapRow((data ?? [])[0] as RpcRow | undefined);
}

export async function selectMutualInterest(
  publicId: string,
): Promise<MutualInterestState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("select_mutual_interest", {
    p_public_id: publicId,
  });

  if (error) {
    throw new Error(mapMutualError(error.message));
  }

  return mapRow((data ?? [])[0] as RpcRow | undefined);
}

export async function withdrawMutualInterest(
  publicId: string,
): Promise<MutualInterestState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("withdraw_mutual_interest", {
    p_public_id: publicId,
  });

  if (error) {
    throw new Error(mapMutualError(error.message));
  }

  return mapRow((data ?? [])[0] as RpcRow | undefined);
}
