import "server-only";

import type {
  EventAttendanceMode,
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
  registration_open: boolean;
  organizer_alias: string;
  organizer_is_verified: boolean;
  cover_path: string | null;
  /** Hanya mode. Link acara online tidak pernah ikut ke halaman publik. */
  attendance_mode: EventAttendanceMode;
};

type EventRow = Omit<
  PublicCampusEvent,
  | "attendee_count"
  | "registration_open"
  | "organizer_alias"
  | "organizer_is_verified"
  | "cover_path"
  | "attendance_mode"
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

type AdminClient = NonNullable<ReturnType<typeof createServerAdminClient>>;

/**
 * Sampul dan ada tidaknya link online (migration 202610210003). Dibaca terpisah
 * supaya halaman publik tetap jalan bila migration belum terpasang.
 */
async function loadPublicEventMedia(admin: AdminClient, eventIds: string[]) {
  const covers = new Map<string, string>();
  const withLink = new Set<string>();
  const [coverResult, linkResult] = await Promise.all([
    admin.from("campus_events").select("id,cover_path").in("id", eventIds),
    admin.from("campus_event_online_links").select("event_id").in("event_id", eventIds),
  ]);
  if (!coverResult.error) {
    for (const row of (coverResult.data ?? []) as { id: string; cover_path: string | null }[]) {
      if (row.cover_path) covers.set(row.id, row.cover_path);
    }
  }
  if (!linkResult.error) {
    for (const row of (linkResult.data ?? []) as { event_id: string }[]) {
      withLink.add(row.event_id);
    }
  }
  return { covers, withLink };
}

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
  const media = await loadPublicEventMedia(admin, eventIds);

  const profiles = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.user_id,
      profile,
    ]),
  );
  const attendance = new Map<string, number>();
  const checkedAt = Date.now();
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
        registration_open:
          !event.registration_closes_at ||
          new Date(event.registration_closes_at).getTime() > checkedAt,
        organizer_alias: profile.public_alias,
        organizer_is_verified: profile.verification_status === "verified",
        cover_path: media.covers.get(id) ?? null,
        attendance_mode:
          event.venue_category === "online"
            ? ("online" as const)
            : media.withLink.has(id)
              ? ("hybrid" as const)
              : ("offline" as const),
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
