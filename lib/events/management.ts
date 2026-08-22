import "server-only";

import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  getCampusEvent,
  getCampusEventRegistrationOverview,
  listCampusEventAttendees,
} from "@/lib/events/service";
import { eventSlugSchema } from "@/lib/events/validation";
import { notFound, redirect } from "next/navigation";

export async function getCampusEventManagement(publicSlug: string) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  if (profile.deactivated_at) redirect("/account-deactivated");

  const slug = eventSlugSchema.safeParse(publicSlug);
  if (!slug.success) notFound();

  try {
    const [event, overview] = await Promise.all([
      getCampusEvent(slug.data),
      getCampusEventRegistrationOverview(slug.data),
    ]);
    if (!event || !overview) notFound();
    return { event, overview };
  } catch {
    // The management RPC is the authorization boundary. Hide existence on denial.
    notFound();
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
    return { event, overview, attendees, canUndo };
  } catch {
    notFound();
  }
}
