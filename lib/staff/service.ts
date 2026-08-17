import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/admin";

export type StaffMember = {
  user_id: string;
  role: "owner" | "admin";
  status: "active" | "inactive";
  verification_reviewer: boolean;
  can_early_access_read: boolean;
  can_users_read: boolean;
  can_users_support: boolean;
  created_at: string;
  updated_at: string;
  disabled_at: string | null;
};

export type StaffRoleEvent = {
  target_suffix: string | null;
  actor_suffix: string | null;
  event_type: string;
  created_at: string;
};

export type VerificationQueueItem = {
  request_id: string;
  status: string;
  method: string;
  pddikti_match_status: string;
  ownership_status: string;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason_code: string | null;
  academic_match_source: "provider" | "manual";
};

export type EarlyAccessWaitlistRow = {
  email: string;
  campus: string | null;
  interests: string[];
  source: string | null;
  status: string;
  created_at: string;
  activation_label: string;
  claimed_at: string | null;
  total_count: number;
};

export type StudentAccountOpsRow = {
  alias: string;
  email_display: string;
  account_status: string;
  onboarding_status: string;
  campus: string;
  study_program: string;
  semester: number | null;
  is_discoverable: boolean;
  verification_summary: string;
  created_at: string;
  deactivated: boolean;
  deletion_pending: boolean;
  total_count: number;
};

export async function listStaffMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_staff_members");
  if (error) throw new Error("Daftar staff belum dapat dimuat.");
  const rows = (data ?? []) as Array<Partial<StaffMember> & {
    user_id: string;
    role: "owner" | "admin";
    status: "active" | "inactive";
    verification_reviewer: boolean;
    created_at: string;
    updated_at: string;
    disabled_at: string | null;
  }>;
  return rows.map((row) => ({
    ...row,
    can_early_access_read: row.can_early_access_read === true,
    can_users_read: row.can_users_read === true,
    can_users_support: row.can_users_support === true,
  })) as StaffMember[];
}

export async function listStaffRoleEvents(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_staff_role_events", {
    p_limit: limit,
  });
  if (error) throw new Error("Riwayat staff belum dapat dimuat.");
  return (data ?? []) as StaffRoleEvent[];
}

export async function manageStaffMember(targetUserId: string, action: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("manage_staff_member", {
    p_target_user_id: targetUserId,
    p_action: action,
  });
  if (error) throw new Error("Perubahan staff belum dapat disimpan.");
}

/**
 * Owner-only: resolve exactly one Auth user by normalized email via service role,
 * then apply manage_staff_member. Never returns UUID to the browser.
 * Capability grants auto-ensure admin membership first (least-privilege caps stay false until explicit).
 */
export async function assignStaffByEmail(
  email: string,
  action: string,
): Promise<"saved" | "not_found" | "ambiguous" | "error"> {
  const admin = createServerAdminClient();
  if (!admin) return "error";

  const normalized = email.trim().toLowerCase();
  const matches: { id: string }[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) return "error";
    for (const user of data.users) {
      if (user.email?.toLowerCase() === normalized) {
        matches.push({ id: user.id });
      }
    }
    if (data.users.length < 200) break;
  }

  if (matches.length === 0) return "not_found";
  if (matches.length > 1) return "ambiguous";

  const targetId = matches[0].id;

  try {
    if (action !== "grant_admin") {
      await manageStaffMember(targetId, "grant_admin");
    }
    await manageStaffMember(targetId, action);
    return "saved";
  } catch {
    return "error";
  }
}

export async function listEarlyAccessWaitlistOps(input: {
  email?: string | null;
  status?: string | null;
  campus?: string | null;
  interest?: string | null;
  source?: string | null;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_early_access_waitlist_ops", {
    p_email: input.email ?? null,
    p_status: input.status ?? null,
    p_campus: input.campus ?? null,
    p_interest: input.interest ?? null,
    p_source: input.source ?? null,
    p_limit: input.limit ?? 25,
    p_offset: input.offset ?? 0,
  });
  if (error) throw new Error("Daftar Akses Awal belum dapat dimuat.");
  return (data ?? []) as EarlyAccessWaitlistRow[];
}

export async function listStudentAccountOps(input: {
  alias?: string | null;
  email?: string | null;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_student_account_ops", {
    p_alias: input.alias ?? null,
    p_email: input.email ?? null,
    p_limit: input.limit ?? 25,
    p_offset: input.offset ?? 0,
  });
  if (error) throw new Error("Daftar akun belum dapat dimuat.");
  return (data ?? []) as StudentAccountOpsRow[];
}

export async function listVerificationQueue(status?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "list_staff_verification_requests",
    { p_status: status ?? null, p_limit: 50 },
  );
  if (error) throw new Error("Antrean verifikasi belum dapat dimuat.");
  return (data ?? []) as VerificationQueueItem[];
}

export async function finalizeStaffVerificationReview(input: {
  requestId: string;
  requestStatus: string;
  academicResult: string;
  ownershipResult: string;
  rejectionReasonCode?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("finalize_staff_verification_review", {
    p_request_id: input.requestId,
    p_request_status: input.requestStatus,
    p_pddikti_match_status: input.academicResult,
    p_ownership_status: input.ownershipResult,
    p_rejection_reason_code: input.rejectionReasonCode ?? null,
  });
  if (error) throw new Error("Review verifikasi belum dapat disimpan.");
}

export async function reviewManualAcademicMatch(input: {
  requestId: string;
  decision: "approve" | "reject" | "needs_action";
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_manual_academic_match", {
    p_request_id: input.requestId,
    p_approved: input.decision === "approve",
    p_needs_action: input.decision === "needs_action",
  });
  if (error) throw new Error("Review akademik belum dapat disimpan.");
}

export async function invalidateStudentVerification(requestId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("invalidate_student_verification", {
    p_request_id: requestId,
  });
  if (error) throw new Error("Verifikasi belum dapat dibatalkan.");
}
