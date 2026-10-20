import "server-only";

import { createClient } from "@/lib/supabase/server";

export type VerificationRequirement = {
  /** null berarti migration 202610200001 belum terpasang. */
  required: boolean | null;
  updatedAt: string | null;
};

export async function ownerGetVerificationRequirement(): Promise<VerificationRequirement> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("owner_get_student_verification_requirement");
  if (error) return { required: null, updatedAt: null };
  const row = (Array.isArray(data) ? data[0] : data) as
    | { required: boolean; updated_at: string }
    | undefined;
  return { required: row?.required ?? null, updatedAt: row?.updated_at ?? null };
}

export async function ownerSetVerificationRequirement(required: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("owner_set_student_verification_requirement", {
    p_required: required,
  });
  return !error;
}
