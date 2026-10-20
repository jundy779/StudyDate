import "server-only";

import type { EventAttendanceMode } from "@/lib/events/constants";
import { mapCampusEventError } from "@/lib/events/service";
import { createClient } from "@/lib/supabase/server";

export type CampusEventMedia = {
  public_slug: string;
  cover_path: string | null;
  attendance_mode: EventAttendanceMode;
};

export type CampusEventOnlineLink = {
  hasLink: boolean;
  meetingUrl: string | null;
  canView: boolean;
};

/**
 * Migration 202610210003 mungkin belum terpasang di environment tertentu. Saat RPC
 * belum ada, fitur sampul dan acara online dianggap belum tersedia, bukan error.
 */
function isMissingRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /could not find the function/i.test(error.message ?? "")
  );
}

export async function getCampusEventMedia(publicSlugs: string[]) {
  const unique = [...new Set(publicSlugs)].slice(0, 50);
  const result = new Map<string, CampusEventMedia>();
  if (!unique.length) return result;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_campus_event_media", {
    p_public_slugs: unique,
  });
  if (error) return result;
  for (const row of (data ?? []) as CampusEventMedia[]) {
    result.set(row.public_slug, row);
  }
  return result;
}

export async function getCampusEventOnlineLink(
  publicSlug: string,
): Promise<CampusEventOnlineLink | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_campus_event_online_link", {
    p_public_slug: publicSlug,
  });
  if (error) return null;
  const row = (data ?? [])[0] as
    | { has_link: boolean; meeting_url: string | null; can_view: boolean }
    | undefined;
  if (!row) return null;
  return {
    hasLink: row.has_link,
    meetingUrl: row.meeting_url,
    canView: row.can_view,
  };
}

export async function setCampusEventOnlineLink(
  publicSlug: string,
  meetingUrl: string | null,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_campus_event_online_link", {
    p_public_slug: publicSlug,
    p_meeting_url: meetingUrl,
  });
  if (isMissingRpc(error)) {
    if (meetingUrl === null) return;
    throw new Error("Acara online belum tersedia. Coba lagi nanti.");
  }
  if (error) {
    if (/invalid meeting url/i.test(error.message)) {
      throw new Error("Link acara online tidak valid.");
    }
    throw new Error(mapCampusEventError(error.message));
  }
}

export async function setCampusEventCoverPath(
  publicSlug: string,
  coverPath: string | null,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_campus_event_cover", {
    p_public_slug: publicSlug,
    p_cover_path: coverPath,
  });
  if (isMissingRpc(error)) {
    throw new Error("Foto sampul belum tersedia. Coba lagi nanti.");
  }
  if (error) throw new Error(mapCampusEventError(error.message));
  return typeof data === "string" ? data : null;
}
