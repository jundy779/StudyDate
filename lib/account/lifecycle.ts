import "server-only";

import { getAuthenticatedUser } from "@/lib/auth/session";
import { getEmailHash } from "@/lib/security/rate-limit";
import { getCurrentStaffAccess } from "@/lib/staff/authorization";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PERMANENT_DELETE_CONFIRMATION } from "@/lib/account/lifecycle-constants";
import { IDENTITY_REVEAL_PHOTO_BUCKET } from "@/lib/identity-reveal/constants";
import { VERIFICATION_BUCKET } from "@/lib/verification/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

export { PERMANENT_DELETE_CONFIRMATION };

type VerificationPathsRow = {
  evidence_path: string | null;
  pddikti_evidence_path: string | null;
};

type IdentityPhotoRow = {
  photo_object_key: string;
};

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

async function listStorageKeysUnderPrefix(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
  depth: number,
): Promise<string[]> {
  if (depth <= 0) {
    return [];
  }

  const { data, error } = await admin.storage.from(bucket).list(prefix, {
    limit: 1000,
  });
  if (error || !data?.length) {
    return [];
  }

  const keys: string[] = [];
  for (const item of data) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    const isFolder = item.id === null;
    if (isFolder) {
      keys.push(
        ...(await listStorageKeysUnderPrefix(admin, bucket, path, depth - 1)),
      );
      continue;
    }
    keys.push(path);
  }
  return keys;
}

async function collectVerificationStorageKeys(
  admin: SupabaseClient,
  userId: string,
) {
  const keys = new Set<string>();

  const { data: rows } = await admin
    .from("student_verification_requests")
    .select("evidence_path, pddikti_evidence_path")
    .eq("user_id", userId);

  for (const row of (rows ?? []) as VerificationPathsRow[]) {
    if (row.evidence_path) keys.add(row.evidence_path);
    if (row.pddikti_evidence_path) keys.add(row.pddikti_evidence_path);
  }

  for (const key of await listStorageKeysUnderPrefix(
    admin,
    VERIFICATION_BUCKET,
    userId,
    4,
  )) {
    keys.add(key);
  }

  return [...keys];
}

async function collectIdentityRevealPhotoKeys(
  admin: SupabaseClient,
  userId: string,
) {
  const { data: rows } = await admin
    .from("identity_reveal_profile_versions")
    .select("photo_object_key")
    .eq("owner_user_id", userId);

  return [
    ...new Set(
      ((rows ?? []) as IdentityPhotoRow[])
        .map((row) => row.photo_object_key)
        .filter(Boolean),
    ),
  ];
}

async function removeStorageKeys(
  admin: SupabaseClient,
  bucket: string,
  keys: string[],
) {
  if (!keys.length) return;
  const chunkSize = 100;
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize);
    const { error } = await admin.storage.from(bucket).remove(chunk);
    if (error) {
      throw new Error(`Storage purge failed for ${bucket}.`);
    }
  }
}

/**
 * Permanently erase a student account: Storage (verification + identity photos),
 * waitlist/rate-limit leftovers by email, then auth.users (CASCADE app rows).
 */
export async function permanentlyDeleteMyStudentAccount(confirmation: string) {
  const user = await assertStudentAccountOwner();
  const email = user.email?.trim().toLowerCase() ?? "";

  if (confirmation.trim() !== PERMANENT_DELETE_CONFIRMATION) {
    throw new Error("Confirmation mismatch.");
  }

  const admin = createServerAdminClient();
  if (!admin) {
    throw new Error("Admin client unavailable.");
  }

  const verificationKeys = await collectVerificationStorageKeys(admin, user.id);
  const identityKeys = await collectIdentityRevealPhotoKeys(admin, user.id);

  await removeStorageKeys(admin, VERIFICATION_BUCKET, verificationKeys);
  await removeStorageKeys(admin, IDENTITY_REVEAL_PHOTO_BUCKET, identityKeys);

  if (email) {
    await admin.from("early_access_waitlist").delete().ilike("email", email);
    await admin
      .from("api_rate_limits")
      .delete()
      .eq("subject_hash", getEmailHash(email));
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    throw new Error("Auth user delete failed.");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
}
