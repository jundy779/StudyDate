import "server-only";

import {
  EVENT_GENERIC_ERROR,
  EVENT_PAGE_SIZE,
  type EventCategory,
  type EventScope,
  type EventVenueCategory,
} from "@/lib/events/constants";
import type {
  EventFilters,
  EventFormInput,
  EventReportInput,
  EventUpdateInput,
} from "@/lib/events/validation";
import { createClient } from "@/lib/supabase/server";

export type CampusEventSummary = {
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
  rsvp_status: "going" | "cancelled" | null;
  is_organizer: boolean;
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
};

export type CampusEventAttendee = {
  public_alias: string;
  campus: string;
  study_program: string;
  semester: number | null;
  interests: string[];
  connection_goals: string[];
  is_verified: boolean;
  is_organizer: boolean;
  rsvped_at: string;
};

export function mapCampusEventError(message?: string) {
  const value = (message ?? "").toLowerCase();
  if (value.includes("private venue")) {
    return "Lokasi pribadi tidak diperbolehkan. Pilih tempat umum.";
  }
  if (value.includes("event full")) return "Kapasitas event sudah penuh.";
  if (value.includes("organizer limit")) {
    return "Maksimal lima event mendatang dapat kamu kelola.";
  }
  if (value.includes("rsvp limit")) {
    return "Maksimal sepuluh event mendatang dapat kamu ikuti.";
  }
  if (value.includes("capacity below")) {
    return "Kapasitas tidak boleh lebih kecil dari jumlah peserta.";
  }
  if (value.includes("schedule venue locked")) {
    return "Waktu dan lokasi tidak dapat diubah setelah peserta lain RSVP.";
  }
  if (value.includes("start too soon")) {
    return "Event harus dimulai setidaknya dua jam dari sekarang.";
  }
  if (value.includes("start too far")) {
    return "Event hanya dapat dijadwalkan hingga 180 hari ke depan.";
  }
  if (value.includes("invalid duration")) {
    return "Durasi event harus antara 30 menit dan 12 jam.";
  }
  if (value.includes("organizer rsvp")) {
    return "Organizer harus tetap terdaftar sebagai peserta.";
  }
  if (value.includes("rate limited")) {
    return "Terlalu banyak aktivitas dalam waktu singkat. Coba lagi nanti.";
  }
  if (
    value.includes("unavailable") ||
    value.includes("authorization") ||
    value.includes("rsvp required")
  ) {
    return "Event atau tindakan ini sudah tidak tersedia.";
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
  const rows = (data ?? []) as CampusEventSummary[];
  const events = rows.slice(0, EVENT_PAGE_SIZE);
  const last = events.at(-1);
  return {
    events,
    nextCursor:
      rows.length > EVENT_PAGE_SIZE && last
        ? { before: last.starts_at, cursor: last.public_slug }
        : null,
  };
}

export async function getCampusEvent(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_campus_event", {
    p_public_slug: publicSlug,
  });
  if (error) throw new Error(mapCampusEventError(error.message));
  return ((data ?? [])[0] as CampusEventDetail | undefined) ?? null;
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
    | "rsvp_campus_event"
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

export const rsvpCampusEvent = (publicSlug: string) =>
  booleanEventRpc("rsvp_campus_event", publicSlug);
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
