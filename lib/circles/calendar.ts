import "server-only";

import type { EventCategory } from "@/lib/events/constants";
import { createClient } from "@/lib/supabase/server";

export type CircleCalendar = {
  followerCount: number;
  isFollowing: boolean;
  canFollow: boolean;
  upcomingCount: number;
};

export type CircleCalendarEvent = {
  public_slug: string;
  title: string;
  category: EventCategory;
  scope: "open" | "campus";
  starts_at: string;
  ends_at: string;
  timezone_name: string;
  venue_name: string;
  venue_area: string;
  city: string;
  capacity: number;
  attendee_count: number;
  rsvp_status: string | null;
};

export type FollowedCalendarEvent = {
  public_slug: string;
  title: string;
  category: EventCategory;
  starts_at: string;
  timezone_name: string;
  venue_name: string;
  city: string;
  circle_public_slug: string;
  circle_name: string;
  rsvp_status: string | null;
};

function isMissingRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    message.includes("could not find the function")
  );
}

/** null berarti kalender belum tersedia (migration belum terpasang) atau tidak boleh dilihat. */
export async function getCircleCalendar(publicSlug: string): Promise<CircleCalendar | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_study_circle_calendar", {
    p_circle_public_slug: publicSlug,
  });
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { follower_count: number; is_following: boolean; can_follow: boolean; upcoming_count: number }
    | undefined;
  if (!row) return null;
  return {
    followerCount: row.follower_count,
    isFollowing: row.is_following,
    canFollow: row.can_follow,
    upcomingCount: row.upcoming_count,
  };
}

export async function listCircleCalendarEvents(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_study_circle_calendar_events", {
    p_circle_public_slug: publicSlug,
    p_limit: 20,
  });
  if (error) return [];
  return (data ?? []) as CircleCalendarEvent[];
}

export async function listMyFollowedCalendarEvents(limit = 6) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_followed_calendar_events", {
    p_limit: limit,
  });
  if (error) return [];
  return (data ?? []) as FollowedCalendarEvent[];
}

export async function setCircleCalendarFollow(publicSlug: string, follow: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_study_circle_calendar_follow", {
    p_circle_public_slug: publicSlug,
    p_follow: follow,
  });
  if (!error) return;
  if (isMissingRpc(error)) throw new Error("Kalender Circle belum tersedia.");
  const message = (error.message ?? "").toLowerCase();
  if (message.includes("rate limited")) {
    throw new Error("Terlalu sering mengubah ikuti kalender. Coba lagi nanti.");
  }
  throw new Error("Kalender ini tidak bisa diikuti saat ini.");
}
