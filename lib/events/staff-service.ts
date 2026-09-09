import "server-only";

import type {
  EventCategory,
  EventRegistrationMode,
  EventScope,
  EventVenueCategory,
} from "@/lib/events/constants";
import { createServerAdminClient } from "@/lib/supabase/admin";

export type StaffCampusEvent = {
  public_slug: string;
  title: string;
  category: EventCategory;
  scope: EventScope;
  campus_scope: string | null;
  starts_at: string;
  ends_at: string;
  timezone_name: string;
  venue_category: EventVenueCategory;
  venue_name: string;
  city: string;
  capacity: number;
  attendee_count: number;
  status: "scheduled" | "cancelled" | "archived";
  is_official: boolean;
  registration_mode: EventRegistrationMode;
  organizer_alias: string;
  organizer_is_verified: boolean;
};

type StaffEventRow = Omit<
  StaffCampusEvent,
  "attendee_count" | "organizer_alias" | "organizer_is_verified"
> & {
  id: string;
  organizer_user_id: string;
};

type StaffEventStatus = StaffCampusEvent["status"] | "all";

export async function listStaffCampusEvents(status: StaffEventStatus = "scheduled") {
  const admin = createServerAdminClient();
  if (!admin) return [];

  let query = admin
    .from("campus_events")
    .select([
      "id",
      "organizer_user_id",
      "public_slug",
      "title",
      "category",
      "scope",
      "campus_scope",
      "starts_at",
      "ends_at",
      "timezone_name",
      "venue_category",
      "venue_name",
      "city",
      "capacity",
      "status",
      "is_official",
      "registration_mode",
    ].join(","))
    .order("starts_at", { ascending: status === "scheduled" })
    .limit(60);

  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error("Daftar acara untuk tim belum dapat dimuat.");

  const rows = (data ?? []) as StaffEventRow[];
  if (rows.length === 0) return [];
  const eventIds = rows.map((event) => event.id);
  const organizerIds = [...new Set(rows.map((event) => event.organizer_user_id))];
  const [profilesResult, registrationsResult] = await Promise.all([
    admin
      .from("profiles")
      .select("user_id,public_alias,verification_status")
      .in("user_id", organizerIds),
    admin
      .from("campus_event_rsvps")
      .select("event_id")
      .in("event_id", eventIds)
      .eq("status", "going"),
  ]);
  if (profilesResult.error || registrationsResult.error) {
    throw new Error("Ringkasan acara untuk tim belum dapat dimuat.");
  }

  const profiles = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.user_id, profile]),
  );
  const attendance = new Map<string, number>();
  for (const registration of registrationsResult.data ?? []) {
    attendance.set(
      registration.event_id,
      (attendance.get(registration.event_id) ?? 0) + 1,
    );
  }

  return rows.flatMap((row) => {
    const profile = profiles.get(row.organizer_user_id);
    if (!profile) return [];
    const { id, organizer_user_id: _organizerUserId, ...event } = row;
    return [{
      ...event,
      attendee_count: attendance.get(id) ?? 0,
      organizer_alias: profile.public_alias,
      organizer_is_verified: profile.verification_status === "verified",
    }];
  });
}
