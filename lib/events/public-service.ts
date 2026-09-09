import "server-only";

import type {
  EventCategory,
  EventRegistrationMode,
  EventVenueCategory,
} from "@/lib/events/constants";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { cache } from "react";

export type PublicCampusEvent = {
  public_slug: string;
  title: string;
  description: string;
  category: EventCategory;
  starts_at: string;
  ends_at: string;
  timezone_name: string;
  venue_category: EventVenueCategory;
  venue_name: string;
  venue_area: string;
  city: string;
  capacity: number;
  attendee_count: number;
  registration_mode: EventRegistrationMode;
  waitlist_enabled: boolean;
  registration_closes_at: string | null;
  organizer_alias: string;
  organizer_is_verified: boolean;
};

type EventRow = Omit<
  PublicCampusEvent,
  "attendee_count" | "organizer_alias" | "organizer_is_verified"
> & {
  id: string;
  organizer_user_id: string;
};

type ProfileRow = {
  user_id: string;
  public_alias: string;
  verification_status: string;
};

const PUBLIC_EVENT_COLUMNS = [
  "id",
  "organizer_user_id",
  "public_slug",
  "title",
  "description",
  "category",
  "starts_at",
  "ends_at",
  "timezone_name",
  "venue_category",
  "venue_name",
  "venue_area",
  "city",
  "capacity",
  "registration_mode",
  "waitlist_enabled",
  "registration_closes_at",
].join(",");

async function hydratePublicEvents(rows: EventRow[]) {
  const admin = createServerAdminClient();
  if (!admin || rows.length === 0) return [];

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
    throw new Error("Daftar acara publik belum dapat dimuat.");
  }

  const profiles = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.user_id,
      profile,
    ]),
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
    void _organizerUserId;
    return [
      {
        ...event,
        attendee_count: attendance.get(id) ?? 0,
        organizer_alias: profile.public_alias,
        organizer_is_verified: profile.verification_status === "verified",
      },
    ];
  });
}

export async function listPublicCampusEvents(category?: EventCategory) {
  const admin = createServerAdminClient();
  if (!admin) return [];

  let query = admin
    .from("campus_events")
    .select(PUBLIC_EVENT_COLUMNS)
    .eq("status", "scheduled")
    .eq("scope", "open")
    .eq("is_official", true)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(24);

  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) throw new Error("Daftar acara publik belum dapat dimuat.");
  return hydratePublicEvents((data ?? []) as unknown as EventRow[]);
}

export const getPublicCampusEvent = cache(async (publicSlug: string) => {
  const admin = createServerAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("campus_events")
    .select(PUBLIC_EVENT_COLUMNS)
    .eq("public_slug", publicSlug)
    .eq("status", "scheduled")
    .eq("scope", "open")
    .eq("is_official", true)
    .gt("ends_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error("Acara belum dapat dimuat.");
  if (!data) return null;
  const [event] = await hydratePublicEvents([data as unknown as EventRow]);
  return event ?? null;
});
