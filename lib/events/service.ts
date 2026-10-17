import "server-only";

import {
  EVENT_GENERIC_ERROR,
  EVENT_PAGE_SIZE,
  EVENT_REGISTRATION_PAGE_SIZE,
  type EventCategory,
  type EventCheckinStatus,
  type EventQuestionType,
  type EventRegistrationMode,
  type EventRegistrationStatus,
  type EventScope,
  type EventTeamRole,
  type EventTeamStatus,
  type EventVenueCategory,
} from "@/lib/events/constants";
import {
  createServerEventTicketMaterial,
  deriveServerEventTicketToken,
} from "@/lib/events/ticket-crypto";
import type {
  EventFilters,
  EventFormInput,
  EventMessageReportInput,
  EventQuestionCreateInput,
  EventRegistrationListInput,
  EventRegistrationManageInput,
  EventRegistrationSettingsInput,
  EventTeamInviteInput,
  EventReportInput,
  EventUpdateInput,
} from "@/lib/events/validation";
import { createClient } from "@/lib/supabase/server";

export type CampusEventSummary = CampusEventV2Settings & {
  public_slug: string;
  title: string;
  description: string;
  category: EventCategory;
  scope: EventScope;
  campus_scope: string | null;
  starts_at: string;
  ends_at: string;
  timezone_name: string;
  venue_category: EventVenueCategory;
  venue_name: string;
  venue_area: string;
  city: string;
  capacity: number;
  attendee_count: number;
  rsvp_status: EventRegistrationStatus | null;
  is_organizer: boolean;
};

export type CampusEventV2Settings = {
  is_official: boolean;
  registration_mode: EventRegistrationMode;
  waitlist_enabled: boolean;
  registration_closes_at: string | null;
  can_manage_registrations: boolean;
  can_check_in: boolean;
  can_manage_team: boolean;
};

export type CampusEventDetail = CampusEventSummary & {
  organizer_alias: string;
  organizer_is_verified: boolean;
  status: "scheduled" | "cancelled" | "archived";
  is_past: boolean;
  can_rsvp: boolean;
  can_cancel_rsvp: boolean;
  can_edit: boolean;
  schedule_venue_locked: boolean;
  can_cancel_event: boolean;
  can_archive: boolean;
  cancelled_at: string | null;
  archived_at: string | null;
} & CampusEventV2Settings;

export type CampusEventAttendee = {
  registration_public_id: string;
  public_alias: string;
  campus: string;
  study_program: string;
  semester: number | null;
  interests: string[];
  registration_status: EventRegistrationStatus;
  checked_in_at: string | null;
  checkin_method: "qr" | "manual" | null;
};

export type CampusEventMessage = {
  message_public_id: string;
  author_alias: string;
  author_is_verified: boolean;
  body: string;
  created_at: string;
  is_mine: boolean;
};

export type CampusEventCircleLink = {
  circle_public_slug: string;
  circle_name: string;
};

export type CampusEventCircleOption = {
  public_slug: string;
  name: string;
};

export type CampusEventTicket = {
  ticket_public_id: string;
  ticket_token: string;
};

export type CampusEventTicketState = {
  ticket_public_id: string;
  status: "issued" | "revoked" | "checked_in";
  issued_at: string;
  checked_in_at: string | null;
};

export type CampusEventQuestion = {
  question_public_id: string;
  question_type: EventQuestionType;
  prompt: string;
  options: string[];
  is_required: boolean;
  sort_order: number;
};

export type CampusEventRegistrationResult = {
  registration_public_id: string;
  status: EventRegistrationStatus;
};

export type CampusEventRegistration = CampusEventAttendee & {
  registration_answers: Record<string, string | string[] | boolean>;
  checkin_method: "qr" | "manual" | null;
  rsvped_at: string;
};

export type CampusEventRegistrationOverview = {
  pending_count: number;
  going_count: number;
  waitlisted_count: number;
  declined_count: number;
  cancelled_count: number;
  checked_in_count: number;
};

export type CampusEventTeamInvitation = {
  event_public_slug: string;
  event_title: string;
  team_role: EventTeamRole;
  invitation_status: EventTeamStatus;
  invited_at: string;
  responded_at: string | null;
};

export type CampusEventTeamMember = {
  public_alias: string;
  team_role: EventTeamRole;
  invitation_status: EventTeamStatus;
  invited_at: string;
  responded_at: string | null;
};

export type EventOrganizerEligibility = {
  eligible: boolean;
  source: "verified" | "owner_grant" | "none";
  explicit_status: "eligible" | "revoked" | null;
  updated_at: string | null;
};

export type OwnerEventOrganizerEligibility = {
  public_alias: string;
  campus: string;
  study_program: string;
  is_verified: boolean;
  eligibility_status: "eligible" | "revoked" | null;
  effective_eligible: boolean;
  updated_at: string | null;
};

export type CampusEventCheckInResult = {
  status: EventCheckinStatus;
  attendeeAlias: string | null;
  checkedInAt: string | null;
};

export function mapCampusEventError(message?: string) {
  const value = (message ?? "").toLowerCase();
  if (value.includes("private venue")) {
    return "Lokasi pribadi tidak diperbolehkan. Pilih tempat umum.";
  }
  if (value.includes("event full")) return "Kapasitas acara sudah penuh.";
  if (value.includes("event ownership quota")) {
    return "Batas acara aktif untuk paketmu sudah tercapai. Kelola acara lama atau lihat StudyDate Plus.";
  }
  if (
    value.includes("event attendance quota") ||
    value.includes("joined event quota")
  ) {
    return "Batas acara yang dapat diikuti untuk paketmu sudah tercapai. Batalkan pendaftaran lain atau lihat StudyDate Plus.";
  }
  if (
    value.includes("organizer eligibility") ||
    value.includes("student access required")
  ) {
    return "Akunmu belum memenuhi syarat untuk membuat atau mengelola Acara Kampus.";
  }
  if (value.includes("participant capacity quota")) {
    return "Kapasitas peserta melampaui batas paketmu.";
  }
  if (value.includes("event team quota")) {
    return "Batas anggota tim acara untuk paketmu sudah tercapai.";
  }
  if (value.includes("registration question quota")) {
    return "Batas pertanyaan pendaftaran untuk paketmu sudah tercapai.";
  }
  if (
    value.includes("invalid registration question") ||
    value.includes("question options")
  ) {
    return "Pertanyaan pendaftaran tidak valid atau meminta data sensitif.";
  }
  if (
    value.includes("required registration answer")
  ) {
    return "Lengkapi semua jawaban pendaftaran yang wajib.";
  }
  if (
    value.includes("registration answer") ||
    value.includes("short answer") ||
    value.includes("selection")
  ) {
    return "Jawaban pendaftaran tidak valid.";
  }
  if (value.includes("registration unavailable")) {
    return "Pendaftaran ini sudah tidak dapat dikelola.";
  }
  if (value.includes("ticket regeneration rate")) {
    return "Batas penerbitan ulang tiket hari ini sudah tercapai.";
  }
  if (value.includes("checked-in ticket cannot regenerate")) {
    return "Tiket yang sudah digunakan tidak dapat diterbitkan ulang.";
  }
  if (
    value.includes("ticket request unavailable") ||
    value.includes("event participation required")
  ) {
    return "Tiket hanya tersedia untuk peserta dengan pendaftaran aktif.";
  }
  if (
    value.includes("event management required") ||
    value.includes("check-in unavailable")
  ) {
    return "Kamu tidak memiliki izin untuk mengelola pendaftaran acara ini.";
  }
  if (
    value.includes("owner authorization") ||
    value.includes("official flag is owner")
  ) {
    return "Tindakan ini hanya tersedia untuk Owner aktif.";
  }
  if (value.includes("student unavailable")) {
    return "Mahasiswa tidak ditemukan atau tidak tersedia.";
  }
  if (value.includes("organizer limit")) {
    return "Kamu dapat mengelola maksimal lima acara mendatang.";
  }
  if (value.includes("rsvp limit")) {
    return "Kamu dapat mengikuti maksimal sepuluh acara mendatang.";
  }
  if (value.includes("capacity below")) {
    return "Kapasitas tidak boleh lebih kecil dari jumlah peserta.";
  }
  if (value.includes("schedule venue locked")) {
    return "Waktu dan lokasi tidak dapat diubah setelah peserta lain mendaftar.";
  }
  if (value.includes("start too soon")) {
    return "Acara harus dimulai setidaknya dua jam dari sekarang.";
  }
  if (value.includes("start too far")) {
    return "Acara hanya dapat dijadwalkan hingga 180 hari ke depan.";
  }
  if (value.includes("invalid duration")) {
    return "Durasi acara harus antara 30 menit dan 12 jam.";
  }
  if (value.includes("organizer rsvp")) {
    return "Penyelenggara harus tetap terdaftar sebagai peserta.";
  }
  if (value.includes("rate limited")) {
    return "Terlalu banyak aktivitas dalam waktu singkat. Coba lagi nanti.";
  }
  if (
    value.includes("unavailable") ||
    value.includes("authorization") ||
    value.includes("rsvp required")
  ) {
    return "Acara atau tindakan ini sudah tidak tersedia.";
  }
  return EVENT_GENERIC_ERROR;
}

export async function listCampusEvents(filters: EventFilters) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_campus_events", {
    p_search: filters.search ?? null,
    p_category: filters.category ?? null,
    p_scope: filters.scope ?? null,
    p_before_starts_at: filters.before ?? null,
    p_before_public_slug: filters.cursor ?? null,
    p_limit: EVENT_PAGE_SIZE + 1,
  });
  if (error) throw new Error(mapCampusEventError(error.message));
  const rows = (data ?? []) as Omit<CampusEventSummary, keyof CampusEventV2Settings>[];
  const summaries = rows.slice(0, EVENT_PAGE_SIZE);
  const events = await Promise.all(
    summaries.map(async (event) => {
      const settings = await getCampusEventV2Settings(event.public_slug);
      return settings ? { ...event, ...settings } : null;
    }),
  ).then((items) => items.filter((item): item is CampusEventSummary => item !== null));
  const last = events.at(-1);
  return {
    events,
    nextCursor:
      rows.length > EVENT_PAGE_SIZE && last
        ? { before: last.starts_at, cursor: last.public_slug }
        : null,
  };
}

export async function getCampusEventV2Settings(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_campus_event_v2_settings", {
    p_public_slug: publicSlug,
  });
  if (error) throw new Error(mapCampusEventError(error.message));
  return ((data ?? [])[0] as CampusEventV2Settings | undefined) ?? null;
}

export async function getCampusEvent(publicSlug: string) {
  const supabase = await createClient();
  const [detailResult, settingsResult] = await Promise.all([
    supabase.rpc("get_campus_event", { p_public_slug: publicSlug }),
    supabase.rpc("get_campus_event_v2_settings", { p_public_slug: publicSlug }),
  ]);
  if (detailResult.error) {
    throw new Error(mapCampusEventError(detailResult.error.message));
  }
  if (settingsResult.error) {
    throw new Error(mapCampusEventError(settingsResult.error.message));
  }
  const detail = ((detailResult.data ?? [])[0] as
    | Omit<CampusEventDetail, keyof CampusEventV2Settings>
    | undefined);
  const settings = ((settingsResult.data ?? [])[0] as
    | CampusEventV2Settings
    | undefined);
  return detail && settings ? { ...detail, ...settings } : null;
}

function formRpcInput(input: EventFormInput | EventUpdateInput) {
  return {
    p_title: input.title,
    p_description: input.description,
    p_category: input.category,
    p_starts_at_local: input.startsAtLocal,
    p_ends_at_local: input.endsAtLocal,
    p_timezone_name: input.timezone,
    p_venue_category: input.venueCategory,
    p_venue_name: input.venueName,
    p_venue_area: input.venueArea,
    p_city: input.city,
    p_capacity: input.capacity,
    p_registration_mode: input.registrationMode,
    p_waitlist_enabled: input.waitlistEnabled,
    p_registration_closes_at: input.registrationClosesAt ?? null,
    p_confirms_public_place: input.confirmsPublicPlace,
    p_confirms_expected_operating: input.confirmsExpectedOperating,
    p_confirms_not_private_residence: input.confirmsNotPrivateResidence,
    p_confirms_no_private_location_disclosure:
      input.confirmsNoPrivateLocationDisclosure,
  };
}

export async function createCampusEvent(input: EventFormInput) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_campus_event", {
    ...formRpcInput(input),
    p_scope: input.scope,
  });
  if (error) throw new Error(mapCampusEventError(error.message));
  if (typeof data !== "string") throw new Error(EVENT_GENERIC_ERROR);
  return data;
}

export async function updateCampusEvent(
  publicSlug: string,
  input: EventUpdateInput,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_campus_event", {
    p_public_slug: publicSlug,
    ...formRpcInput(input),
  });
  if (error) throw new Error(mapCampusEventError(error.message));
}

async function booleanEventRpc(
  rpc:
    | "cancel_campus_event_rsvp"
    | "cancel_campus_event"
    | "archive_campus_event",
  publicSlug: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(rpc, {
    p_public_slug: publicSlug,
  });
  if (error) throw new Error(mapCampusEventError(error.message));
  return Boolean(data);
}

export const cancelCampusEventRsvp = (publicSlug: string) =>
  booleanEventRpc("cancel_campus_event_rsvp", publicSlug);
export const cancelCampusEvent = (publicSlug: string) =>
  booleanEventRpc("cancel_campus_event", publicSlug);
export const archiveCampusEvent = (publicSlug: string) =>
  booleanEventRpc("archive_campus_event", publicSlug);

export async function listCampusEventAttendees(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_campus_event_attendees", {
    p_public_slug: publicSlug,
  });
  if (error) throw new Error(mapCampusEventError(error.message));
  return (data ?? []) as CampusEventAttendee[];
}

export async function listCampusEventRegistrationQuestions(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "list_campus_event_registration_questions",
    { p_public_slug: publicSlug },
  );
  if (error) throw new Error(mapCampusEventError(error.message));
  return (data ?? []) as CampusEventQuestion[];
}

export async function addCampusEventRegistrationQuestion(
  input: EventQuestionCreateInput,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "add_campus_event_registration_question",
    {
      p_public_slug: input.publicSlug,
      p_question_type: input.questionType,
      p_prompt: input.prompt,
      p_options: input.options,
      p_is_required: input.isRequired,
    },
  );
  if (error || typeof data !== "string") {
    throw new Error(mapCampusEventError(error?.message));
  }
  return data;
}

export async function deleteCampusEventRegistrationQuestion(
  publicSlug: string,
  questionPublicId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "delete_campus_event_registration_question",
    {
      p_public_slug: publicSlug,
      p_question_public_id: questionPublicId,
    },
  );
  if (error) throw new Error(mapCampusEventError(error.message));
  return Boolean(data);
}

export async function registerForCampusEvent(
  publicSlug: string,
  answers: Record<string, string | string[] | boolean>,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_for_campus_event", {
    p_public_slug: publicSlug,
    p_answers: answers,
  });
  const row = (data ?? [])[0] as CampusEventRegistrationResult | undefined;
  if (error || !row) throw new Error(mapCampusEventError(error?.message));
  return row;
}

export async function manageCampusEventRegistration(
  input: EventRegistrationManageInput,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "manage_campus_event_registration",
    {
      p_public_slug: input.publicSlug,
      p_registration_public_id: input.registrationPublicId,
      p_action: input.action,
    },
  );
  if (error) throw new Error(mapCampusEventError(error.message));
  return data as EventRegistrationStatus;
}

export async function updateCampusEventRegistrationSettings(
  input: EventRegistrationSettingsInput,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "update_campus_event_registration_settings",
    {
      p_public_slug: input.publicSlug,
      p_registration_mode: input.registrationMode,
      p_waitlist_enabled: input.waitlistEnabled,
      p_registration_closes_at: input.registrationClosesAt ?? null,
    },
  );
  if (error) throw new Error(mapCampusEventError(error.message));
  return Boolean(data);
}

export async function getCampusEventRegistrationOverview(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_campus_event_registration_overview",
    { p_public_slug: publicSlug },
  );
  if (error) throw new Error(mapCampusEventError(error.message));
  return ((data ?? [])[0] as CampusEventRegistrationOverview | undefined) ?? null;
}

export async function listCampusEventRegistrations(
  input: EventRegistrationListInput,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_campus_event_registrations", {
    p_public_slug: input.publicSlug,
    p_status: input.status ?? null,
    p_before_rsvped_at: input.beforeRsvpedAt ?? null,
    p_before_public_id: input.beforePublicId ?? null,
    p_limit: EVENT_REGISTRATION_PAGE_SIZE + 1,
  });
  if (error) throw new Error(mapCampusEventError(error.message));
  const rows = (data ?? []) as CampusEventRegistration[];
  const registrations = rows.slice(0, EVENT_REGISTRATION_PAGE_SIZE);
  const last = registrations.at(-1);
  return {
    registrations,
    nextCursor:
      rows.length > EVENT_REGISTRATION_PAGE_SIZE && last
        ? { beforeRsvpedAt: last.rsvped_at, beforePublicId: last.registration_public_id }
        : null,
  };
}

export async function getMyEventOrganizerEligibility() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_my_event_organizer_eligibility",
  );
  if (error) throw new Error(mapCampusEventError(error.message));
  return ((data ?? [])[0] as EventOrganizerEligibility | undefined) ?? null;
}

export async function ownerLookupEventOrganizerEligibility(publicAlias: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "owner_lookup_event_organizer_eligibility",
    { p_public_alias: publicAlias },
  );
  if (error) throw new Error(mapCampusEventError(error.message));
  return ((data ?? [])[0] as OwnerEventOrganizerEligibility | undefined) ?? null;
}

export async function ownerManageEventOrganizerEligibility(
  publicAlias: string,
  action: "grant" | "revoke",
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "owner_manage_event_organizer_eligibility",
    { p_public_alias: publicAlias, p_action: action },
  );
  if (error) throw new Error(mapCampusEventError(error.message));
  return Boolean(data);
}

export async function ownerSetCampusEventOfficial(
  publicSlug: string,
  isOfficial: boolean,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "owner_set_campus_event_official",
    { p_public_slug: publicSlug, p_is_official: isOfficial },
  );
  if (error) throw new Error(mapCampusEventError(error.message));
  return Boolean(data);
}

export async function inviteCampusEventTeamMember(input: EventTeamInviteInput) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "invite_campus_event_team_member",
    {
      p_public_slug: input.publicSlug,
      p_public_alias: input.publicAlias,
      p_role: input.role,
    },
  );
  if (error) throw new Error(mapCampusEventError(error.message));
  return Boolean(data);
}

export async function respondCampusEventTeamInvitation(
  publicSlug: string,
  response: "accept" | "decline",
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "respond_campus_event_team_invitation",
    { p_public_slug: publicSlug, p_response: response },
  );
  if (error) throw new Error(mapCampusEventError(error.message));
  return Boolean(data);
}

export async function listMyCampusEventTeamInvitations() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "list_my_campus_event_team_invitations",
    { p_limit: 31 },
  );
  if (error) throw new Error(mapCampusEventError(error.message));
  return (data ?? []) as CampusEventTeamInvitation[];
}

export async function listCampusEventTeamMembers(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_campus_event_team_members", {
    p_public_slug: publicSlug,
  });
  if (error) throw new Error(mapCampusEventError(error.message));
  return (data ?? []) as CampusEventTeamMember[];
}

export async function removeCampusEventTeamMember(
  publicSlug: string,
  publicAlias: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "remove_campus_event_team_member",
    { p_public_slug: publicSlug, p_public_alias: publicAlias },
  );
  if (error) throw new Error(mapCampusEventError(error.message));
  return Boolean(data);
}

async function reportCampusEventTarget(
  rpc: "report_campus_event" | "report_campus_event_organizer",
  input: EventReportInput,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, {
    p_public_slug: input.publicSlug,
    p_reason_code: input.reasonCode,
    p_details: input.details ?? null,
  });
  if (error) throw new Error(mapCampusEventError(error.message));
}

export const reportCampusEvent = (input: EventReportInput) =>
  reportCampusEventTarget("report_campus_event", input);
export const reportCampusEventOrganizer = (input: EventReportInput) =>
  reportCampusEventTarget("report_campus_event_organizer", input);

export async function setCampusEventCircle(
  eventPublicSlug: string,
  circlePublicSlug: string | null,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_campus_event_circle", {
    p_event_public_slug: eventPublicSlug,
    p_circle_public_slug: circlePublicSlug,
  });
  if (error) throw new Error(mapCampusEventError(error.message));
}

export async function getCampusEventCircle(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_campus_event_circle", {
    p_event_public_slug: publicSlug,
  });
  if (error) return null;
  return ((data ?? [])[0] as CampusEventCircleLink | undefined) ?? null;
}

export async function listMyCircleOptionsForEvent() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_circle_options_for_event");
  if (error) return [];
  return (data ?? []) as CampusEventCircleOption[];
}

export async function listCampusEventMessages(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_campus_event_messages", {
    p_public_slug: publicSlug,
    p_before_created_at: null,
    p_before_public_id: null,
    p_limit: 51,
  });
  if (error) return [];
  return (data ?? []) as CampusEventMessage[];
}

export async function sendCampusEventMessage(
  publicSlug: string,
  body: string,
  idempotencyKey: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_campus_event_message", {
    p_public_slug: publicSlug,
    p_body: body,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(mapCampusEventError(error.message));
}

export async function reportCampusEventMessage(input: EventMessageReportInput) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_campus_event_message", {
    p_public_slug: input.publicSlug,
    p_message_public_id: input.messagePublicId,
    p_reason_code: input.reasonCode,
    p_details: input.details ?? null,
  });
  if (error) throw new Error(mapCampusEventError(error.message));
}

export async function issueMyCampusEventTicket(
  publicSlug: string,
  regenerate = false,
) {
  const supabase = await createClient();
  if (!regenerate) {
    const existing = await getMyCampusEventTicketState(publicSlug);
    if (existing && existing.status !== "revoked") {
      return {
        ticket_public_id: existing.ticket_public_id,
        ticket_token: deriveServerEventTicketToken(existing.ticket_public_id),
      };
    }
  }
  const material = createServerEventTicketMaterial();
  const { data, error } = await supabase.rpc("issue_my_campus_event_ticket", {
    p_public_slug: publicSlug,
    p_ticket_public_id: material.publicId,
    p_ticket_hash: material.tokenHash,
    p_regenerate: regenerate,
  });
  if (error || typeof data !== "string") {
    throw new Error(mapCampusEventError(error?.message));
  }
  const ticketToken =
    data === material.publicId
      ? material.rawToken
      : deriveServerEventTicketToken(data);
  return { ticket_public_id: data, ticket_token: ticketToken };
}

export async function getMyCampusEventTicketState(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_campus_event_ticket_state", {
    p_public_slug: publicSlug,
  });
  if (error) return null;
  return ((data ?? [])[0] as CampusEventTicketState | undefined) ?? null;
}

export async function checkInCampusEventTicket(
  publicSlug: string,
  ticketToken: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_in_campus_event_ticket", {
    p_event_public_slug: publicSlug,
    p_ticket_token: ticketToken,
  });
  if (error) throw new Error(mapCampusEventError(error.message));
  const row = (data ?? [])[0] as
    | { status: EventCheckinStatus; attendee_alias: string | null; checked_in_at: string | null }
    | undefined;
  if (!row) throw new Error(EVENT_GENERIC_ERROR);
  return {
    status: row.status,
    attendeeAlias: row.attendee_alias,
    checkedInAt: row.checked_in_at,
  } satisfies CampusEventCheckInResult;
}

export async function manualCheckInCampusEventRegistration(
  publicSlug: string,
  registrationPublicId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "manual_check_in_campus_event_registration",
    {
      p_event_public_slug: publicSlug,
      p_registration_public_id: registrationPublicId,
    },
  );
  if (error) throw new Error(mapCampusEventError(error.message));
  const row = (data ?? [])[0] as
    | { status: EventCheckinStatus; attendee_alias: string | null; checked_in_at: string | null }
    | undefined;
  if (!row) throw new Error(EVENT_GENERIC_ERROR);
  return {
    status: row.status,
    attendeeAlias: row.attendee_alias,
    checkedInAt: row.checked_in_at,
  } satisfies CampusEventCheckInResult;
}

export async function undoCampusEventCheckIn(
  publicSlug: string,
  registrationPublicId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("undo_campus_event_check_in", {
    p_event_public_slug: publicSlug,
    p_registration_public_id: registrationPublicId,
  });
  if (error) throw new Error(mapCampusEventError(error.message));
  return Boolean(data);
}

export type CampusEventAnnouncement = {
  announcement_public_id: string;
  title: string;
  body: string;
  recipient_count: number;
  created_at: string;
};

export async function listCampusEventAnnouncements(
  publicSlug: string,
): Promise<CampusEventAnnouncement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_campus_event_announcements", {
    p_public_slug: publicSlug,
    p_limit: 20,
  });
  if (error) return [];
  return (data ?? []) as CampusEventAnnouncement[];
}

export async function createCampusEventAnnouncement(input: {
  publicSlug: string;
  title: string;
  body: string;
  idempotencyKey: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_campus_event_announcement", {
    p_public_slug: input.publicSlug,
    p_title: input.title,
    p_body: input.body,
    p_client_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(mapCampusEventError(error.message));
  return (
    (data ?? [])[0] as
      | { announcement_public_id: string; recipient_count: number }
      | undefined
  ) ?? null;
}



export type CampusEventSeriesSession = {
  series_public_id: string;
  cadence: "weekly" | "monthly";
  public_slug: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "cancelled" | "archived";
  series_position: number;
};

export async function attachCampusEventSeries(
  publicSlugs: string[],
  cadence: "weekly" | "monthly",
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attach_campus_event_series", {
    p_public_slugs: publicSlugs,
    p_cadence: cadence,
  });
  if (error || typeof data !== "string") {
    throw new Error(mapCampusEventError(error?.message));
  }
  return data;
}

export async function listCampusEventSeriesSessions(
  publicSlug: string,
): Promise<CampusEventSeriesSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "list_campus_event_series_sessions",
    { p_public_slug: publicSlug },
  );
  if (error) return [];
  return (data ?? []) as CampusEventSeriesSession[];
}


export async function cancelCampusEventSeriesSessions(
  publicSlug: string,
  scope: "following" | "all",
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "cancel_campus_event_series_sessions",
    { p_public_slug: publicSlug, p_scope: scope },
  );
  if (error || typeof data !== "number") {
    throw new Error(mapCampusEventError(error?.message));
  }
  return data;
}
