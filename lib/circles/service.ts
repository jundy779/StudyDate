import "server-only";

import {
  CIRCLE_CONTACT_MESSAGE,
  CIRCLE_GENERIC_ERROR,
  CIRCLE_MESSAGE_PAGE_SIZE,
  CIRCLE_PAGE_SIZE,
  type CircleScope,
  type CircleTopic,
} from "@/lib/circles/constants";
import type {
  CircleFilters,
  CircleFormInput,
  CircleReportInput,
} from "@/lib/circles/validation";
import { createClient } from "@/lib/supabase/server";

export type CircleSummary = {
  public_slug: string;
  name: string;
  description: string;
  topic: CircleTopic;
  scope: CircleScope;
  campus_scope: string | null;
  member_limit: number;
  member_count: number;
  membership_state: "active" | "left" | "removed" | null;
  is_owner: boolean;
  created_at: string;
};

export type CircleDetail = CircleSummary & {
  status: "active" | "archived";
  can_join: boolean;
  can_leave: boolean;
  archived_at: string | null;
};

export type CircleMember = {
  public_alias: string;
  campus: string;
  study_program: string;
  semester: number | null;
  interests: string[];
  connection_goals: string[];
  is_verified: boolean;
  circle_role: "owner" | "member";
  joined_at: string;
};

export type CircleMessage = {
  message_public_id: string;
  author_alias: string;
  author_is_verified: boolean;
  body: string;
  created_at: string;
  is_mine: boolean;
};

function mapCircleError(message?: string) {
  const normalized = (message ?? "").toLowerCase();
  if (normalized.includes("contact disclosure")) return CIRCLE_CONTACT_MESSAGE;
  if (normalized.includes("circle full")) return "Circle ini sudah penuh.";
  if (normalized.includes("ownership quota") || normalized.includes("ownership limit")) {
    return "Kuota Circle yang kamu kelola sudah terpakai. Circle yang ada tetap aman.";
  }
  if (normalized.includes("membership quota") || normalized.includes("membership limit")) {
    return "Kuota Circle yang kamu ikuti sudah terpakai. Circle yang ada tetap aman.";
  }
  if (normalized.includes("rate limited")) {
    return "Terlalu banyak aktivitas dalam waktu singkat. Coba lagi nanti.";
  }
  if (normalized.includes("member limit below")) {
    return "Batas anggota tidak boleh lebih kecil dari anggota aktif.";
  }
  if (
    normalized.includes("unavailable") ||
    normalized.includes("membership required")
  ) {
    return "Circle atau tindakan ini sudah tidak tersedia.";
  }
  return CIRCLE_GENERIC_ERROR;
}

export async function listCircles(filters: CircleFilters) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_study_circles", {
    p_search: filters.search ?? null,
    p_topic: filters.topic ?? null,
    p_scope: filters.scope ?? null,
    p_before_created_at: filters.before ?? null,
    p_before_public_slug: filters.cursor ?? null,
    p_limit: CIRCLE_PAGE_SIZE + 1,
  });
  if (error) throw new Error(mapCircleError(error.message));

  const rows = (data ?? []) as CircleSummary[];
  const hasMore = rows.length > CIRCLE_PAGE_SIZE;
  const circles = rows.slice(0, CIRCLE_PAGE_SIZE);
  const last = circles.at(-1);
  return {
    circles,
    nextCursor:
      hasMore && last
        ? { before: last.created_at, cursor: last.public_slug }
        : null,
  };
}

export async function getCircle(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_study_circle", {
    p_public_slug: publicSlug,
  });
  if (error) throw new Error(mapCircleError(error.message));
  return ((data ?? [])[0] as CircleDetail | undefined) ?? null;
}

export async function createCircle(input: CircleFormInput) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_study_circle", {
    p_name: input.name,
    p_description: input.description,
    p_topic: input.topic,
    p_scope: input.scope,
    p_member_limit: input.memberLimit,
  });
  if (error) throw new Error(mapCircleError(error.message));
  if (typeof data !== "string") throw new Error(CIRCLE_GENERIC_ERROR);
  return data;
}

export async function updateCircle(
  publicSlug: string,
  input: CircleFormInput,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_study_circle", {
    p_public_slug: publicSlug,
    p_name: input.name,
    p_description: input.description,
    p_topic: input.topic,
    p_member_limit: input.memberLimit,
  });
  if (error) throw new Error(mapCircleError(error.message));
}

async function callCircleBooleanRpc(
  rpc:
    | "join_study_circle"
    | "leave_study_circle"
    | "archive_study_circle",
  publicSlug: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(rpc, {
    p_public_slug: publicSlug,
  });
  if (error) throw new Error(mapCircleError(error.message));
  return Boolean(data);
}

export async function joinCircle(publicSlug: string) {
  return callCircleBooleanRpc("join_study_circle", publicSlug);
}

export async function leaveCircle(publicSlug: string) {
  return callCircleBooleanRpc("leave_study_circle", publicSlug);
}

export async function archiveCircle(publicSlug: string) {
  return callCircleBooleanRpc("archive_study_circle", publicSlug);
}

export async function removeCircleMember(
  publicSlug: string,
  memberAlias: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_study_circle_member", {
    p_public_slug: publicSlug,
    p_member_alias: memberAlias,
  });
  if (error) throw new Error(mapCircleError(error.message));
}

export async function listCircleMembers(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_study_circle_members", {
    p_public_slug: publicSlug,
  });
  if (error) throw new Error(mapCircleError(error.message));
  return (data ?? []) as CircleMember[];
}

export async function listCircleMessages(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_study_circle_messages", {
    p_public_slug: publicSlug,
    p_before_created_at: null,
    p_before_public_id: null,
    p_limit: CIRCLE_MESSAGE_PAGE_SIZE + 1,
  });
  if (error) throw new Error(mapCircleError(error.message));
  const descending = (data ?? []) as CircleMessage[];
  const hasMore = descending.length > CIRCLE_MESSAGE_PAGE_SIZE;
  return {
    messages: descending.slice(0, CIRCLE_MESSAGE_PAGE_SIZE).reverse(),
    hasMore,
  };
}

export async function sendCircleMessage(
  publicSlug: string,
  body: string,
  idempotencyKey: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_study_circle_message", {
    p_public_slug: publicSlug,
    p_body: body,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(mapCircleError(error.message));
}

export async function reportCircle(input: CircleReportInput) {
  const supabase = await createClient();
  if (input.memberAlias) {
    const { error } = await supabase.rpc("report_study_circle_member", {
      p_public_slug: input.publicSlug,
      p_member_alias: input.memberAlias,
      p_reason_code: input.reasonCode,
      p_details: input.details ?? null,
      p_message_public_id: input.messagePublicId ?? null,
    });
    if (error) throw new Error(mapCircleError(error.message));
    return;
  }

  const { error } = await supabase.rpc("report_study_circle", {
    p_public_slug: input.publicSlug,
    p_reason_code: input.reasonCode,
    p_details: input.details ?? null,
  });
  if (error) throw new Error(mapCircleError(error.message));
}
