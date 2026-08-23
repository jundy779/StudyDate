import "server-only";

import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  getCampusEvent,
  getCampusEventRegistrationOverview,
  listCampusEventAttendees,
} from "@/lib/events/service";
import { eventSlugSchema } from "@/lib/events/validation";
import { notFound, redirect } from "next/navigation";

export async function getCampusEventManagement(
  publicSlug: string,
  required: "workspace" | "registrations" | "team" = "workspace",
) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  if (profile.deactivated_at) redirect("/account-deactivated");

  const slug = eventSlugSchema.safeParse(publicSlug);
  if (!slug.success) notFound();

  const event = await getCampusEvent(slug.data).catch(() => null);
  if (!event) notFound();
  const allowed =
    required === "registrations"
      ? event.can_manage_registrations
      : required === "team"
        ? event.can_manage_team
        : event.can_manage_registrations ||
          event.can_check_in ||
          event.can_manage_team;
  if (!allowed) notFound();
  if (
    required === "workspace" &&
    event.can_check_in &&
    !event.can_manage_registrations &&
    !event.can_manage_team
  ) {
    redirect(`/app/events/${slug.data}/manage/check-in`);
  }
  try {
    const overview = await getCampusEventRegistrationOverview(slug.data);
    if (!overview) notFound();
    return { event, overview };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (
      message.includes("event management required") ||
      message.includes("event unavailable")
    ) {
      notFound();
    }
    throw error;
  }
}

export async function getCampusEventCheckInManagement(publicSlug: string) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  if (profile.deactivated_at) redirect("/account-deactivated");

  const slug = eventSlugSchema.safeParse(publicSlug);
  if (!slug.success) notFound();

  try {
    const [event, attendees] = await Promise.all([
      getCampusEvent(slug.data),
      listCampusEventAttendees(slug.data),
    ]);
    if (!event) notFound();
    const overview = {
      pending_count: attendees.filter(
        (attendee) => attendee.registration_status === "pending",
      ).length,
      going_count: attendees.filter(
        (attendee) => attendee.registration_status === "going",
      ).length,
      waitlisted_count: attendees.filter(
        (attendee) => attendee.registration_status === "waitlisted",
      ).length,
      declined_count: 0,
      cancelled_count: 0,
      checked_in_count: attendees.filter((attendee) => attendee.checked_in_at).length,
    };
    let canUndo = false;
    try {
      canUndo = Boolean(await getCampusEventRegistrationOverview(slug.data));
    } catch {
      // Check-in staff can operate attendance but cannot undo organizer decisions.
    }
    return {
      event,
      overview,
      attendees: event.can_manage_registrations
        ? attendees
        : attendees
            .filter((attendee) => attendee.registration_status === "going")
            .map((attendee) => ({
              ...attendee,
              campus: "",
              study_program: "",
              semester: null,
              interests: [],
            })),
      canUndo,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (
      message.includes("event management required") ||
      message.includes("check-in unavailable") ||
      message.includes("event unavailable")
    ) {
      notFound();
    }
    throw error;
  }
}
