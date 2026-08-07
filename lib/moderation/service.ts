import "server-only";

import {
  MODERATION_COPY,
  type ModerationStatus,
} from "@/lib/moderation/constants";
import { createClient } from "@/lib/supabase/server";

export type ModerationQueueItem = {
  report_id: string;
  moderation_status: ModerationStatus;
  reason_code: string;
  target_kind: string;
  subject_suffix: string;
  has_details: boolean;
  has_message_ref: boolean;
  created_at: string;
  reviewed_at: string | null;
  resolved_at: string | null;
  reviewer_suffix: string | null;
};

export type ModerationReportDetail = {
  report_id: string;
  moderation_status: ModerationStatus;
  reason_code: string;
  target_kind: string;
  subject_suffix: string;
  reporter_suffix: string;
  details: string | null;
  conversation_public_id: string | null;
  referenced_message_excerpt: string | null;
  internal_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  resolved_at: string | null;
  reviewer_suffix: string | null;
};

function mapError(message: string | undefined) {
  const text = (message ?? "").toLowerCase();
  if (text.includes("owner authorization")) {
    return MODERATION_COPY.genericError;
  }
  if (text.includes("invalid moderation transition")) {
    return "Perubahan status tidak diizinkan untuk laporan ini.";
  }
  return MODERATION_COPY.genericError;
}

export async function listModerationReports(status?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_moderation_reports", {
    p_status: status ?? null,
    p_limit: 50,
  });
  if (error) throw new Error(mapError(error.message));
  return (data ?? []) as ModerationQueueItem[];
}

export async function getModerationReport(reportId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_moderation_report", {
    p_report_id: reportId,
  });
  if (error) throw new Error(mapError(error.message));
  const row = (data ?? [])[0] as ModerationReportDetail | undefined;
  return row ?? null;
}

export async function countUnresolvedModerationReports() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "count_unresolved_moderation_reports",
  );
  if (error) throw new Error(mapError(error.message));
  return Number(data ?? 0);
}

export async function updateModerationReportStatus(input: {
  reportId: string;
  newStatus: "under_review" | "resolved" | "dismissed";
  internalNote?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_moderation_report_status", {
    p_report_id: input.reportId,
    p_new_status: input.newStatus,
    p_internal_note: input.internalNote ?? null,
  });
  if (error) throw new Error(mapError(error.message));
}
