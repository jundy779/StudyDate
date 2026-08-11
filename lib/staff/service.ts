import "server-only";

import { createClient } from "@/lib/supabase/server";

export type StaffMember = {
  user_id: string;
  role: "owner" | "admin";
  status: "active" | "inactive";
  verification_reviewer: boolean;
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

export async function listStaffMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_staff_members");
  if (error) throw new Error("Daftar staff belum dapat dimuat.");
  return (data ?? []) as StaffMember[];
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
