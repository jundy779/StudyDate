"use server";

import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  archiveCampusEvent,
  cancelCampusEvent,
  cancelCampusEventRsvp,
  createCampusEvent,
  reportCampusEvent,
  reportCampusEventOrganizer,
  rsvpCampusEvent,
  updateCampusEvent,
} from "@/lib/events/service";
import {
  eventFormSchema,
  eventReportSchema,
  eventSlugSchema,
  eventUpdateSchema,
} from "@/lib/events/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireEventStudent() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  if (profile.deactivated_at) redirect("/account-deactivated");
}

function detailPath(publicSlug: string, query = "") {
  return `/app/events/${publicSlug}${query}`;
}

function firstIssueMessage(
  result: { success: false; error: { issues: { message: string }[] } },
  fallback: string,
) {
  return result.error.issues[0]?.message ?? fallback;
}

function formValues(formData: FormData) {
  return {
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    scope: formData.get("scope"),
    startsAtLocal: formData.get("startsAtLocal"),
    endsAtLocal: formData.get("endsAtLocal"),
    timezone: formData.get("timezone"),
    venueCategory: formData.get("venueCategory"),
    venueName: formData.get("venueName"),
    venueArea: formData.get("venueArea"),
    city: formData.get("city"),
    capacity: formData.get("capacity"),
    confirmsPublicPlace: formData.get("confirmsPublicPlace") === "on",
    confirmsExpectedOperating:
      formData.get("confirmsExpectedOperating") === "on",
    confirmsNotPrivateResidence:
      formData.get("confirmsNotPrivateResidence") === "on",
    confirmsNoPrivateLocationDisclosure:
      formData.get("confirmsNoPrivateLocationDisclosure") === "on",
  };
}

export async function createCampusEventAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventFormSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    redirect(
      `/app/events/create?state=invalid&notice=${encodeURIComponent(
        firstIssueMessage(parsed, "Periksa kembali detail Event."),
      )}`,
    );
  }

  let publicSlug: string;
  try {
    publicSlug = await createCampusEvent(parsed.data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Event belum dapat dibuat.";
    redirect(
      `/app/events/create?state=error&notice=${encodeURIComponent(message)}`,
    );
  }
  revalidatePath("/app/events");
  redirect(detailPath(publicSlug, "?state=created"));
}

export async function updateCampusEventAction(formData: FormData) {
  await requireEventStudent();
  const slug = eventSlugSchema.safeParse(formData.get("publicSlug"));
  const values = formValues(formData);
  const updateValues = {
    title: values.title,
    description: values.description,
    category: values.category,
    startsAtLocal: values.startsAtLocal,
    endsAtLocal: values.endsAtLocal,
    timezone: values.timezone,
    venueCategory: values.venueCategory,
    venueName: values.venueName,
    venueArea: values.venueArea,
    city: values.city,
    capacity: values.capacity,
    confirmsPublicPlace: values.confirmsPublicPlace,
    confirmsExpectedOperating: values.confirmsExpectedOperating,
    confirmsNotPrivateResidence: values.confirmsNotPrivateResidence,
    confirmsNoPrivateLocationDisclosure:
      values.confirmsNoPrivateLocationDisclosure,
  };
  const parsed = eventUpdateSchema.safeParse(updateValues);
  if (!slug.success || !parsed.success) {
    redirect("/app/events?state=error");
  }
  try {
    await updateCampusEvent(slug.data, parsed.data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Event belum dapat diperbarui.";
    redirect(
      detailPath(
        slug.data,
        `?state=error&notice=${encodeURIComponent(message)}`,
      ),
    );
  }
  revalidatePath(detailPath(slug.data));
  revalidatePath("/app/events");
  redirect(detailPath(slug.data, "?state=updated"));
}

async function runBooleanAction(
  formData: FormData,
  action: "rsvp" | "cancel-rsvp" | "cancel-event" | "archive",
) {
  await requireEventStudent();
  const slug = eventSlugSchema.safeParse(formData.get("publicSlug"));
  if (!slug.success) redirect("/app/events?state=error");
  try {
    if (action === "rsvp") await rsvpCampusEvent(slug.data);
    else if (action === "cancel-rsvp") await cancelCampusEventRsvp(slug.data);
    else if (action === "cancel-event") await cancelCampusEvent(slug.data);
    else await archiveCampusEvent(slug.data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Tindakan belum dapat diproses.";
    redirect(
      detailPath(
        slug.data,
        `?state=error&notice=${encodeURIComponent(message)}`,
      ),
    );
  }
  revalidatePath(detailPath(slug.data));
  revalidatePath("/app/events");
  redirect(detailPath(slug.data, `?state=${action}`));
}

export async function rsvpCampusEventAction(formData: FormData) {
  return runBooleanAction(formData, "rsvp");
}

export async function cancelCampusEventRsvpAction(formData: FormData) {
  return runBooleanAction(formData, "cancel-rsvp");
}

export async function cancelCampusEventAction(formData: FormData) {
  return runBooleanAction(formData, "cancel-event");
}

export async function archiveCampusEventAction(formData: FormData) {
  return runBooleanAction(formData, "archive");
}

export async function reportCampusEventAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventReportSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    reasonCode: formData.get("reasonCode"),
    details: formData.get("details") ?? undefined,
  });
  if (!parsed.success) redirect("/app/events?state=error");
  try {
    if (formData.get("reportTarget") === "organizer") {
      await reportCampusEventOrganizer(parsed.data);
    } else {
      await reportCampusEvent(parsed.data);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Laporan belum dapat dikirim.";
    redirect(
      detailPath(
        parsed.data.publicSlug,
        `?state=error&notice=${encodeURIComponent(message)}`,
      ),
    );
  }
  redirect(detailPath(parsed.data.publicSlug, "?state=reported"));
}
