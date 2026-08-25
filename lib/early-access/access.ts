import "server-only";

import { createServerAdminClient } from "@/lib/supabase/admin";

/**
 * Existing completed accounts may request a login link. A new/pre-onboarding account
 * is eligible only after the matching Early Access row has been approved.
 * The public caller must keep its response enumeration-safe.
 */
export async function canReceiveStudentMagicLink(email: string) {
  const admin = createServerAdminClient();
  if (!admin) return false;

  const { data, error } = await admin.rpc("can_issue_student_magic_link", {
    p_email: email.trim().toLowerCase(),
  });

  return !error && data === true;
}
