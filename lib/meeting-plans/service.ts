import "server-only";

import {
  EMPTY_MEETING_PLAN_STATE,
  type MeetingPlanState,
  type MeetingPlanStatus,
  type MeetingTimezone,
  type MeetingVenueCategory,
} from "@/lib/meeting-plans/constants";
import type { z } from "zod";
import {
  meetingPostcheckSchema,
  proposeMeetingPlanSchema,
} from "@/lib/meeting-plans/validation";
import { createClient } from "@/lib/supabase/server";

type MeetingPlanRow = {
  eligible: boolean;
  plan_public_id: string | null;
  status: MeetingPlanStatus | null;
  created_by_me: boolean;
  selected_by_me: boolean;
  venue_category: MeetingVenueCategory | null;
  venue_name: string | null;
  venue_area: string | null;
  city: string | null;
  starts_at: string | null;
  expected_end_at: string | null;
  timezone_name: MeetingTimezone | null;
  precheck_acknowledged_at: string | null;
  postcheck_status: "safe" | "report_started" | null;
  postcheck_at: string | null;
};

function mapState(row?: MeetingPlanRow): MeetingPlanState {
  if (!row) return EMPTY_MEETING_PLAN_STATE;
  return {
    eligible: row.eligible,
    planPublicId: row.plan_public_id,
    status: row.status,
    createdByMe: row.created_by_me,
    selectedByMe: row.selected_by_me,
    venueCategory: row.venue_category,
    venueName: row.venue_name,
    venueArea: row.venue_area,
    city: row.city,
    startsAt: row.starts_at,
    expectedEndAt: row.expected_end_at,
    timezone: row.timezone_name,
    precheckAcknowledgedAt: row.precheck_acknowledged_at,
    postcheckStatus: row.postcheck_status,
    postcheckAt: row.postcheck_at,
  };
}

export async function getMyMeetingPlanState(publicId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_meeting_plan_state", {
    p_conversation_public_id: publicId,
  });
  if (error) return EMPTY_MEETING_PLAN_STATE;
  return mapState((data ?? [])[0] as MeetingPlanRow | undefined);
}

export async function proposeMeetingPlan(
  input: z.infer<typeof proposeMeetingPlanSchema>,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("propose_meeting_plan", {
    p_conversation_public_id: input.publicId,
    p_venue_category: input.venueCategory,
    p_venue_name: input.venueName,
    p_venue_area: input.venueArea,
    p_city: input.city,
    p_starts_at_local: input.startsAtLocal,
    p_expected_end_at_local: input.expectedEndAtLocal,
    p_timezone_name: input.timezone,
    p_confirms_public_place: input.confirmsPublicPlace,
    p_confirms_expected_operating: input.confirmsExpectedOperating,
    p_confirms_not_private_residence: input.confirmsNotPrivateResidence,
    p_confirms_no_private_location_disclosure:
      input.confirmsNoPrivateLocationDisclosure,
  });
  if (error) throw new Error("Rencana pertemuan belum dapat dibuat.");
  return getMyMeetingPlanState(input.publicId);
}

async function runPlanAction(
  rpc:
    | "confirm_meeting_plan"
    | "cancel_meeting_plan"
    | "acknowledge_meeting_precheck",
  publicId: string,
  planPublicId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, {
    p_plan_public_id: planPublicId,
  });
  if (error) throw new Error("Rencana pertemuan belum dapat diperbarui.");
  return getMyMeetingPlanState(publicId);
}

export const confirmMeetingPlan = (publicId: string, planPublicId: string) =>
  runPlanAction("confirm_meeting_plan", publicId, planPublicId);
export const cancelMeetingPlan = (publicId: string, planPublicId: string) =>
  runPlanAction("cancel_meeting_plan", publicId, planPublicId);
export const acknowledgeMeetingPrecheck = (
  publicId: string,
  planPublicId: string,
) => runPlanAction("acknowledge_meeting_precheck", publicId, planPublicId);

export async function completeMeetingPostcheck(
  input: z.infer<typeof meetingPostcheckSchema>,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_meeting_postcheck", {
    p_plan_public_id: input.planPublicId,
    p_status: input.status,
  });
  if (error) throw new Error("Pemeriksaan setelah pertemuan belum dapat disimpan.");
  return getMyMeetingPlanState(input.publicId);
}
