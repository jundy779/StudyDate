"use server";

import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  addCampusEventRegistrationQuestion,
  archiveCampusEvent,
  cancelCampusEvent,
  cancelCampusEventRsvp,
  checkInCampusEventTicket,
  createCampusEvent,
  deleteCampusEventRegistrationQuestion,
  inviteCampusEventTeamMember,
  issueMyCampusEventTicket,
  manageCampusEventRegistration,
  manualCheckInCampusEventRegistration,
  ownerManageEventOrganizerEligibility,
  ownerSetCampusEventOfficial,
  registerForCampusEvent,
  removeCampusEventTeamMember,
  reportCampusEvent,
  reportCampusEventMessage,
  reportCampusEventOrganizer,
  respondCampusEventTeamInvitation,
  sendCampusEventMessage,
  setCampusEventCircle,
  undoCampusEventCheckIn,
  updateCampusEvent,
  updateCampusEventRegistrationSettings,
} from "@/lib/events/service";
import {
  eventCircleLinkSchema,
  eventFormSchema,
  eventManualCheckInSchema,
  eventMessageReportSchema,
  eventMessageSchema,
  eventOfficialFlagSchema,
  eventOrganizerEligibilityManageSchema,
  eventQuestionCreateSchema,
  eventQuestionDeleteSchema,
  eventRegistrationAnswersSchema,
  eventRegistrationManageSchema,
  eventRegistrationSettingsSchema,
  eventReportSchema,
  eventSlugSchema,
  eventTeamInviteSchema,
  eventTeamRemoveSchema,
  eventTeamResponseSchema,
  eventTicketCheckInSchema,
  eventTicketIssueSchema,
  eventUpdateSchema,
  parseBoundedJson,
} from "@/lib/events/validation";
import {
  EVENT_QUESTION_OPTIONS_MAX,
  EVENT_REGISTRATION_ANSWER_MAX_BYTES,
} from "@/lib/events/constants";
import { requireOwner } from "@/lib/staff/authorization";
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
    registrationMode: formData.get("registrationMode") ?? "instant",
    waitlistEnabled: formData.get("waitlistEnabled") !== "off",
    registrationClosesAt: formData.get("registrationClosesAt") || undefined,
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
    registrationMode: values.registrationMode,
    waitlistEnabled: values.waitlistEnabled,
    registrationClosesAt: values.registrationClosesAt,
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
  action: "cancel-rsvp" | "cancel-event" | "archive",
) {
  await requireEventStudent();
  const slug = eventSlugSchema.safeParse(formData.get("publicSlug"));
  if (!slug.success) redirect("/app/events?state=error");
  try {
    if (action === "cancel-rsvp") await cancelCampusEventRsvp(slug.data);
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
  return registerCampusEventAction(formData);
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

export async function registerCampusEventAction(formData: FormData) {
  await requireEventStudent();
  const slug = eventSlugSchema.safeParse(formData.get("publicSlug"));
  if (!slug.success) redirect("/app/events?state=error");
  let answers: unknown = {};
  try {
    const rawAnswers = formData.get("answers");
    if (rawAnswers !== null) {
      answers = parseBoundedJson(rawAnswers, EVENT_REGISTRATION_ANSWER_MAX_BYTES);
    }
    const parsedAnswers = eventRegistrationAnswersSchema.parse(answers);
    const result = await registerForCampusEvent(slug.data, parsedAnswers);
    revalidatePath(detailPath(slug.data));
    revalidatePath("/app/events");
    redirect(detailPath(slug.data, `?state=registration-${result.status}`));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registrasi belum dapat diproses.";
    redirect(detailPath(slug.data, `?state=error&notice=${encodeURIComponent(message)}`));
  }
}

/** @deprecated Compatibility only until the current detail UI is replaced. */
export const joinCampusEventWaitlistAction = registerCampusEventAction;
/** @deprecated Waitlist cancellation is the unified registration cancellation. */
export const leaveCampusEventWaitlistAction = cancelCampusEventRsvpAction;

export async function sendCampusEventMessageAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventMessageSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    body: formData.get("body"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) redirect("/app/events?state=error");
  try {
    await sendCampusEventMessage(
      parsed.data.publicSlug,
      parsed.data.body,
      parsed.data.idempotencyKey,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pesan Event belum dapat dikirim.";
    redirect(
      detailPath(
        parsed.data.publicSlug,
        `?state=error&notice=${encodeURIComponent(message)}`,
      ),
    );
  }
  revalidatePath(detailPath(parsed.data.publicSlug));
  redirect(detailPath(parsed.data.publicSlug, "?state=message-sent"));
}

export async function reportCampusEventMessageAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventMessageReportSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    messagePublicId: formData.get("messagePublicId"),
    reasonCode: formData.get("reasonCode"),
    details: formData.get("details") ?? undefined,
  });
  if (!parsed.success) redirect("/app/events?state=error");
  try {
    await reportCampusEventMessage(parsed.data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Laporan pesan belum dapat dikirim.";
    redirect(
      detailPath(
        parsed.data.publicSlug,
        `?state=error&notice=${encodeURIComponent(message)}`,
      ),
    );
  }
  redirect(detailPath(parsed.data.publicSlug, "?state=message-reported"));
}

export async function setCampusEventCircleAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventCircleLinkSchema.safeParse({
    eventPublicSlug: formData.get("publicSlug"),
    circlePublicSlug: formData.get("circlePublicSlug"),
  });
  if (!parsed.success) redirect("/app/events?state=error");
  try {
    await setCampusEventCircle(
      parsed.data.eventPublicSlug,
      parsed.data.circlePublicSlug,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Circle belum dapat ditautkan.";
    redirect(
      detailPath(
        parsed.data.eventPublicSlug,
        `?state=error&notice=${encodeURIComponent(message)}`,
      ),
    );
  }
  revalidatePath(detailPath(parsed.data.eventPublicSlug));
  redirect(detailPath(parsed.data.eventPublicSlug, "?state=circle-linked"));
}

export async function issueCampusEventTicketAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventTicketIssueSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    regenerate: formData.get("regenerate") === "true",
  });
  if (!parsed.success) {
    return { ticketToken: null, message: "Permintaan tiket tidak valid." };
  }
  try {
    const ticket = await issueMyCampusEventTicket(
      parsed.data.publicSlug,
      parsed.data.regenerate,
    );
    return {
      ticketToken: ticket.ticket_token,
      message: parsed.data.regenerate
        ? "QR tiket baru siap. QR dan screenshot lama sudah tidak berlaku."
        : "QR tiket siap ditampilkan.",
    };
  } catch (error) {
    return {
      ticketToken: null,
      message:
        error instanceof Error ? error.message : "Tiket belum dapat diterbitkan.",
    };
  }
}

export async function checkInCampusEventTicketAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventTicketCheckInSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    ticketToken: formData.get("ticketToken"),
  });
  if (!parsed.success) {
    return {
      status: "invalid" as const,
      attendeeAlias: null,
      checkedInAt: null,
      message: "QR tiket tidak valid.",
    };
  }
  try {
    const result = await checkInCampusEventTicket(
      parsed.data.publicSlug,
      parsed.data.ticketToken,
    );
    revalidatePath(detailPath(parsed.data.publicSlug));
    return { ...result, message: null };
  } catch (error) {
    return {
      status: "invalid" as const,
      attendeeAlias: null,
      checkedInAt: null,
      message:
        error instanceof Error ? error.message : "Check-in belum dapat diproses.",
    };
  }
}

function optionsFromFormData(formData: FormData) {
  const values = formData
    .getAll("options")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, EVENT_QUESTION_OPTIONS_MAX);
  if (values.length) return values;
  const text = formData.get("optionsText");
  if (typeof text === "string" && text.trim()) {
    return text
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, EVENT_QUESTION_OPTIONS_MAX);
  }
  const json = formData.get("optionsJson");
  return json === null
    ? []
    : parseBoundedJson(json, EVENT_QUESTION_OPTIONS_MAX * 100);
}

export async function addCampusEventRegistrationQuestionAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventQuestionCreateSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    questionType: formData.get("questionType"),
    prompt: formData.get("prompt"),
    options: optionsFromFormData(formData),
    isRequired: formData.get("isRequired") === "on",
  });
  if (!parsed.success) redirect("/app/events?state=error");
  try {
    await addCampusEventRegistrationQuestion(parsed.data);
  } catch (error) {
    redirect(detailPath(parsed.data.publicSlug, `?state=error&notice=${encodeURIComponent(error instanceof Error ? error.message : "Pertanyaan belum dapat ditambahkan.")}`));
  }
  revalidatePath(detailPath(parsed.data.publicSlug));
  redirect(detailPath(parsed.data.publicSlug, "?state=question-added"));
}

export async function deleteCampusEventRegistrationQuestionAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventQuestionDeleteSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    questionPublicId: formData.get("questionPublicId"),
  });
  if (!parsed.success) redirect("/app/events?state=error");
  await deleteCampusEventRegistrationQuestion(
    parsed.data.publicSlug,
    parsed.data.questionPublicId,
  );
  revalidatePath(detailPath(parsed.data.publicSlug));
  redirect(detailPath(parsed.data.publicSlug, "?state=question-deleted"));
}

export async function updateCampusEventRegistrationSettingsAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventRegistrationSettingsSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    registrationMode: formData.get("registrationMode"),
    waitlistEnabled: formData.get("waitlistEnabled") === "on",
    registrationClosesAt: formData.get("registrationClosesAt") || undefined,
  });
  if (!parsed.success) redirect("/app/events?state=error");
  await updateCampusEventRegistrationSettings(parsed.data);
  revalidatePath(detailPath(parsed.data.publicSlug));
  redirect(detailPath(parsed.data.publicSlug, "?state=settings-updated"));
}

export async function manageCampusEventRegistrationAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventRegistrationManageSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    registrationPublicId: formData.get("registrationPublicId"),
    action: formData.get("action"),
  });
  if (!parsed.success) redirect("/app/events?state=error");
  const status = await manageCampusEventRegistration(parsed.data);
  revalidatePath(detailPath(parsed.data.publicSlug));
  redirect(detailPath(parsed.data.publicSlug, `?state=registration-${status}`));
}

export async function inviteCampusEventTeamMemberAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventTeamInviteSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    publicAlias: formData.get("publicAlias"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/app/events?state=error");
  await inviteCampusEventTeamMember(parsed.data);
  revalidatePath(detailPath(parsed.data.publicSlug));
  redirect(detailPath(parsed.data.publicSlug, "?state=team-invited"));
}

export async function respondCampusEventTeamInvitationAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventTeamResponseSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    response: formData.get("response"),
  });
  if (!parsed.success) redirect("/app/events?state=error");
  await respondCampusEventTeamInvitation(
    parsed.data.publicSlug,
    parsed.data.response,
  );
  revalidatePath(detailPath(parsed.data.publicSlug));
  redirect(detailPath(parsed.data.publicSlug, `?state=team-${parsed.data.response}`));
}

export async function removeCampusEventTeamMemberAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventTeamRemoveSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    publicAlias: formData.get("publicAlias"),
  });
  if (!parsed.success) redirect("/app/events?state=error");
  await removeCampusEventTeamMember(
    parsed.data.publicSlug,
    parsed.data.publicAlias,
  );
  revalidatePath(detailPath(parsed.data.publicSlug));
  redirect(detailPath(parsed.data.publicSlug, "?state=team-removed"));
}

export async function manualCheckInCampusEventRegistrationAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventManualCheckInSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    registrationPublicId: formData.get("registrationPublicId"),
  });
  if (!parsed.success) {
    return { status: "not_eligible" as const, attendeeAlias: null, checkedInAt: null, message: "Registrasi tidak valid." };
  }
  try {
    const result = await manualCheckInCampusEventRegistration(
      parsed.data.publicSlug,
      parsed.data.registrationPublicId,
    );
    revalidatePath(detailPath(parsed.data.publicSlug));
    return { ...result, message: null };
  } catch (error) {
    return { status: "not_eligible" as const, attendeeAlias: null, checkedInAt: null, message: error instanceof Error ? error.message : "Check-in belum dapat diproses." };
  }
}

export async function undoCampusEventCheckInAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventManualCheckInSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    registrationPublicId: formData.get("registrationPublicId"),
  });
  if (!parsed.success) redirect("/app/events?state=error");
  await undoCampusEventCheckIn(
    parsed.data.publicSlug,
    parsed.data.registrationPublicId,
  );
  revalidatePath(detailPath(parsed.data.publicSlug));
  redirect(detailPath(parsed.data.publicSlug, "?state=checkin-undone"));
}

export async function ownerManageEventOrganizerEligibilityAction(formData: FormData) {
  await requireOwner();
  const parsed = eventOrganizerEligibilityManageSchema.safeParse({
    publicAlias: formData.get("publicAlias"),
    action: formData.get("action"),
  });
  if (!parsed.success) redirect("/owner?state=invalid");
  await ownerManageEventOrganizerEligibility(
    parsed.data.publicAlias,
    parsed.data.action,
  );
  revalidatePath("/owner");
  redirect("/owner?state=event-organizer-updated");
}

export async function ownerSetCampusEventOfficialAction(formData: FormData) {
  await requireOwner();
  const parsed = eventOfficialFlagSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    isOfficial: formData.get("isOfficial") === "true",
  });
  if (!parsed.success) redirect("/owner?state=invalid");
  await ownerSetCampusEventOfficial(parsed.data.publicSlug, parsed.data.isOfficial);
  revalidatePath(detailPath(parsed.data.publicSlug));
  redirect("/owner?state=event-official-updated");
}
