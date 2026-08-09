import "server-only";

import { ACCOUNT_DELETE_CONFIRMATION } from "@/lib/account/lifecycle-constants";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getCurrentStaffAccess } from "@/lib/staff/authorization";
import { createClient } from "@/lib/supabase/server";

export { ACCOUNT_DELETE_CONFIRMATION };

async function assertStudentAccountOwner() {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("Not authenticated.");
  }

  const staff = await getCurrentStaffAccess(user);
  if (staff) {
    throw new Error("Staff accounts cannot manage student account lifecycle.");
  }

  return user;
}

export async function getStudentDeactivatedAt(
  userId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("deactivated_at")
    .eq("user_id", userId)
    .maybeSingle<{ deactivated_at: string | null }>();

  if (error || !data) {
    return null;
  }

  return data.deactivated_at;
}

export async function getMyAccountDeletionStatus(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_account_deletion_status");
  if (error) {
    return null;
  }
  return (data as { status: string }[] | null)?.[0]?.status ?? null;
}

export async function deactivateMyStudentAccount() {
  const user = await assertStudentAccountOwner();
  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_my_student_account");
  if (error) {
    throw new Error("Deactivate failed.");
  }
  return user;
}

export async function reactivateMyStudentAccount() {
  const user = await assertStudentAccountOwner();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reactivate_my_student_account");
  if (error) {
    throw new Error("Reactivate failed.");
  }
  return user;
}

export async function requestMyStudentAccountDeletion(confirmation: string) {
  await assertStudentAccountOwner();
  if (confirmation.trim() !== ACCOUNT_DELETE_CONFIRMATION) {
    throw new Error("Confirmation mismatch.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_my_student_account_deletion");
  if (error) {
    throw new Error("Deletion request failed.");
  }
  await supabase.auth.signOut();
}
