"use server";

import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  addCampusEventRegistrationQuestion,
  archiveCampusEvent,
  attachCampusEventSeries,
  cancelCampusEvent,
  cancelCampusEventSeriesSessions,
  cancelCampusEventRsvp,
  checkInCampusEventTicket,
  createCampusEvent,
  createCampusEventAnnouncement,
  deleteCampusEventRegistrationQuestion,
  inviteCampusEventTeamMember,
  issueMyCampusEventTicket,
  listCampusEventSeriesSessions,
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
  eventAnnouncementSchema,
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
  eventOnlineLinkSchema,
  eventUpdateSchema,
  parseBoundedJson,
  type EventOnlineLinkInput,
} from "@/lib/events/validation";
import {
  EVENT_ONLINE_CITY,
  EVENT_ONLINE_VENUE_AREA,
  meetingPlatformLabel,
} from "@/lib/events/online";
import { setCampusEventOnlineLink } from "@/lib/events/media";
import {
  EVENT_QUESTION_OPTIONS_MAX,
  EVENT_REGISTRATION_ANSWER_MAX_BYTES,
} from "@/lib/events/constants";
import {
  buildEventSeriesInputs,
  parseEventDuplicateCadence,
  parseEventSeriesCount,
} from "@/lib/events/duplication";
import { blockStudentByAlias } from "@/lib/introductions/service";
import {
  planEventSeriesUpdates,
  type EventSeriesUpdateScope,
} from "@/lib/events/series-update";
import { z } from "zod";
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

const eventBlockSchema = z.object({
  publicSlug: eventSlugSchema,
  organizerAlias: z.string().min(1).max(80),
});

function firstIssueMessage(
  result: { success: false; error: { issues: { message: string }[] } },
  fallback: string,
) {
  return result.error.issues[0]?.message ?? fallback;
}

function onlineValues(formData: FormData) {
  return {
    attendanceMode: formData.get("attendanceMode") ?? "offline",
    onlineUrl:
      typeof formData.get("onlineUrl") === "string"
        ? String(formData.get("onlineUrl")).trim()
        : "",
  };
}

/** Acara online tidak punya lokasi fisik; isi tempat diganti keterangan platform. */
function onlineVenueValues(formData: FormData) {
  const online = onlineValues(formData);
  if (online.attendanceMode !== "online") return null;
  const lockedName = formData.get("venueName");
  return {
    venueCategory: "online",
    venueName:
      typeof lockedName === "string" && lockedName.trim()
        ? lockedName
        : (meetingPlatformLabel(online.onlineUrl) ?? "Online"),
    venueArea: EVENT_ONLINE_VENUE_AREA,
    city: EVENT_ONLINE_CITY,
    confirmsPublicPlace: false,
    confirmsExpectedOperating: false,
    confirmsNotPrivateResidence: false,
    confirmsNoPrivateLocationDisclosure: false,
  };
}

async function saveOnlineLink(publicSlug: string, online: EventOnlineLinkInput) {
  await setCampusEventOnlineLink(
    publicSlug,
    online.attendanceMode === "offline" ? null : online.onlineUrl,
  );
}

function formValues(formData: FormData) {
  const timezone = formData.get("timezone");
  const registrationClosesAt = formData.get("registrationClosesAt");
  const onlineVenue = onlineVenueValues(formData);
  return {
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    scope: formData.get("scope"),
    registrationMode: formData.get("registrationMode") ?? "instant",
    waitlistEnabled: formData.get("waitlistEnabled") === "on",
    registrationClosesAt: toEventTimestamp(registrationClosesAt, timezone),
    startsAtLocal: formData.get("startsAtLocal"),
    endsAtLocal: formData.get("endsAtLocal"),
    timezone,
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
    ...onlineVenue,
  };
}

function toEventTimestamp(value: FormDataEntryValue | null, timezone: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    const offset =
      timezone === "Asia/Makassar"
        ? "+08:00"
        : timezone === "Asia/Jayapura"
          ? "+09:00"
          : "+07:00";
    return new Date(`${value}:00${offset}`).toISOString();
  }
  return value;
}

export async function createCampusEventAction(formData: FormData) {
  await requireEventStudent();
  const duplicate = eventSlugSchema.safeParse(formData.get("duplicateFrom"));
  const duplicateCadence = parseEventDuplicateCadence(
    formData.get("duplicateCadence"),
  );
  const seriesCount = duplicate.success
    ? parseEventSeriesCount(formData.get("seriesCount"))
    : 1;
  const createPath = duplicate.success
    ? `/app/events/create?duplicate=${encodeURIComponent(duplicate.data)}&cadence=${duplicateCadence}&occurrences=${seriesCount}`
    : "/app/events/create";
  const parsed = eventFormSchema.safeParse(formValues(formData));
  const online = eventOnlineLinkSchema.safeParse(onlineValues(formData));
  if (!parsed.success || !online.success) {
    const message = !parsed.success
      ? firstIssueMessage(parsed, "Periksa kembali detail acara.")
      : !online.success
        ? firstIssueMessage(online, "Periksa kembali link acara online.")
        : "Periksa kembali detail acara.";
    redirect(
      `${createPath}${createPath.includes("?") ? "&" : "?"}state=invalid&notice=${encodeURIComponent(
        message,
      )}`,
    );
  }

  const inputs =
    duplicate.success && seriesCount > 1
      ? buildEventSeriesInputs(parsed.data, duplicateCadence, seriesCount)
      : [parsed.data];
  const createdSlugs: string[] = [];
  try {
    for (const input of inputs) {
      createdSlugs.push(await createCampusEvent(input));
    }
  } catch (error) {
    const baseMessage =
      error instanceof Error ? error.message : "Acara belum dapat dibuat.";
    const message = createdSlugs.length
      ? `${createdSlugs.length} sesi berhasil dibuat, tetapi proses berhenti. ${baseMessage}`
      : baseMessage;
    redirect(
      `${createPath}${createPath.includes("?") ? "&" : "?"}state=error&notice=${encodeURIComponent(message)}`,
    );
  }
  if (
    process.env.EVENT_SERIES_ENABLED === "true" &&
    createdSlugs.length > 1
  ) {
    try {
      await attachCampusEventSeries(createdSlugs, duplicateCadence);
    } catch {
      // Events remain usable independently if series linking is temporarily unavailable.
    }
  }
  if (online.data.attendanceMode !== "offline") {
    try {
      for (const createdSlug of createdSlugs) {
        await saveOnlineLink(createdSlug, online.data);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Link acara online belum tersimpan.";
      revalidatePath("/app/events");
      redirect(
        managePath(
          createdSlugs[0],
          "/settings",
          `?state=error&notice=${encodeURIComponent(
            `Acara sudah dibuat, tetapi link online belum tersimpan. ${message} Isi lagi di sini.`,
          )}`,
        ),
      );
    }
  }
  revalidatePath("/app/events");
  const publicSlug = createdSlugs[0];
  redirect(
    detailPath(
      publicSlug,
      createdSlugs.length > 1
        ? `?state=series-created&occurrences=${createdSlugs.length}`
        : "?state=created",
    ),
  );
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
  const online = eventOnlineLinkSchema.safeParse(onlineValues(formData));
  if (!slug.success) redirect("/app/events?state=error");
  if (!parsed.success || !online.success) {
    const message = !parsed.success
      ? firstIssueMessage(parsed, "Periksa kembali detail acara.")
      : !online.success
        ? firstIssueMessage(online, "Periksa kembali link acara online.")
        : "Periksa kembali detail acara.";
    redirect(
      managePath(
        slug.data,
        "/settings",
        `?state=error&notice=${encodeURIComponent(message)}`,
      ),
    );
  }
  const requestedScope = z
    .enum(["current", "following", "all"])
    .safeParse(formData.get("updateScope"));
  const updateScope: EventSeriesUpdateScope =
    requestedScope.success ? requestedScope.data : "current";
  let updatedCount = 0;
  try {
    const sessions =
      process.env.EVENT_SERIES_ENABLED === "true" && updateScope !== "current"
        ? await listCampusEventSeriesSessions(slug.data)
        : [];
    const planned = planEventSeriesUpdates({
      sessions,
      targetSlug: slug.data,
      scope: updateScope,
      update: parsed.data,
    });
    if (!planned.length) {
      throw new Error("Tidak ada pertemuan mendatang yang dapat diubah.");
    }
    for (const item of planned) {
      await updateCampusEvent(item.publicSlug, item.update);
      await saveOnlineLink(item.publicSlug, online.data);
      updatedCount += 1;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Acara belum dapat diperbarui.";
    redirect(
      managePath(
        slug.data,
        "/settings",
        `?state=error&notice=${encodeURIComponent(
          updatedCount
            ? `${updatedCount} pertemuan berhasil diubah. ${message}`
            : message,
        )}`,
      ),
    );
  }
  revalidatePath(detailPath(slug.data));
  revalidatePath("/app/events");
  redirect(
    managePath(
      slug.data,
      "/settings",
      updatedCount > 1
        ? `?state=series-updated&count=${updatedCount}`
        : "?state=updated",
    ),
  );
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

function managePath(publicSlug: string, section = "", query = "") {
  return `/app/events/${publicSlug}/manage${section}${query}`;
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

export async function cancelCampusEventSeriesAction(formData: FormData) {
  await requireEventStudent();
  const slug = eventSlugSchema.safeParse(formData.get("publicSlug"));
  const scope = z.enum(["following", "all"]).safeParse(formData.get("scope"));
  if (!slug.success || !scope.success) redirect("/app/events?state=error");
  if (process.env.EVENT_SERIES_ENABLED !== "true") {
    redirect(detailPath(slug.data, "?state=error&notice=Rangkaian acara belum diaktifkan."));
  }
  try {
    const count = await cancelCampusEventSeriesSessions(slug.data, scope.data);
    revalidatePath("/app/events");
    redirect(
      detailPath(
        slug.data,
        `?state=series-cancelled&count=${count}`,
      ),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Rangkaian acara belum dapat dibatalkan.";
    redirect(
      detailPath(
        slug.data,
        `?state=error&notice=${encodeURIComponent(message)}`,
      ),
    );
  }
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
  let status: string;
  try {
    const rawAnswers = formData.get("answers");
    if (rawAnswers !== null) {
      answers = parseBoundedJson(rawAnswers, EVENT_REGISTRATION_ANSWER_MAX_BYTES);
    }
    const parsedAnswers = eventRegistrationAnswersSchema.parse(answers);
    const result = await registerForCampusEvent(slug.data, parsedAnswers);
    status = result.status;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pendaftaran belum dapat diproses.";
    redirect(detailPath(slug.data, `?state=error&notice=${encodeURIComponent(message)}`));
  }
  revalidatePath(detailPath(slug.data));
  revalidatePath("/app/events");
  redirect(detailPath(slug.data, `?state=registration-${status}`));
}

export async function blockCampusEventOrganizerAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventBlockSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    organizerAlias: formData.get("organizerAlias"),
  });
  if (!parsed.success) redirect("/app/events?state=error");
  try {
    await blockStudentByAlias(parsed.data.organizerAlias);
  } catch {
    redirect(detailPath(parsed.data.publicSlug, "?state=error"));
  }
  revalidatePath(detailPath(parsed.data.publicSlug));
  revalidatePath("/app/events");
  redirect("/app/events?state=organizer-blocked");
}

/** @deprecated Compatibility only until the current detail UI is replaced. */
export const joinCampusEventWaitlistAction = registerCampusEventAction;
/** @deprecated Waitlist cancellation is the unified registration cancellation. */
export const leaveCampusEventWaitlistAction = cancelCampusEventRsvpAction;

export async function sendCampusEventAnnouncementAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventAnnouncementSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    title: formData.get("title"),
    body: formData.get("body"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) {
    const slug = eventSlugSchema.safeParse(formData.get("publicSlug"));
    if (!slug.success) redirect("/app/events?state=error");
    redirect(
      managePath(
        slug.data,
        "",
        `?state=announcement-error&notice=${encodeURIComponent(
          firstIssueMessage(parsed, "Pengumuman belum dapat dikirim."),
        )}`,
      ),
    );
  }
  try {
    await createCampusEventAnnouncement(parsed.data);
  } catch (error) {
    redirect(
      managePath(
        parsed.data.publicSlug,
        "",
        `?state=announcement-error&notice=${encodeURIComponent(
          error instanceof Error
            ? error.message
            : "Pengumuman belum dapat dikirim.",
        )}`,
      ),
    );
  }
  revalidatePath(detailPath(parsed.data.publicSlug));
  revalidatePath(managePath(parsed.data.publicSlug));
  redirect(managePath(parsed.data.publicSlug, "", "?state=announcement-sent"));
}

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
      error instanceof Error ? error.message : "Pesan acara belum dapat dikirim.";
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
      managePath(
        parsed.data.eventPublicSlug,
        "/settings",
        `?state=error&notice=${encodeURIComponent(message)}`,
      ),
    );
  }
  revalidatePath(managePath(parsed.data.eventPublicSlug));
  redirect(
    managePath(parsed.data.eventPublicSlug, "/settings", "?state=circle-linked"),
  );
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
        ? "QR tiket baru siap. QR dan tangkapan layar lama sudah tidak berlaku."
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
        error instanceof Error ? error.message : "Kehadiran belum dapat dicatat.",
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
    redirect(
      managePath(
        parsed.data.publicSlug,
        "/settings",
        `?state=error&notice=${encodeURIComponent(
          error instanceof Error
            ? error.message
            : "Pertanyaan belum dapat ditambahkan.",
        )}`,
      ),
    );
  }
  revalidatePath(managePath(parsed.data.publicSlug));
  redirect(managePath(parsed.data.publicSlug, "/settings", "?state=question-added"));
}

export async function deleteCampusEventRegistrationQuestionAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventQuestionDeleteSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    questionPublicId: formData.get("questionPublicId"),
  });
  if (!parsed.success) redirect("/app/events?state=error");
  try {
    await deleteCampusEventRegistrationQuestion(
      parsed.data.publicSlug,
      parsed.data.questionPublicId,
    );
  } catch (error) {
    redirect(
      managePath(
        parsed.data.publicSlug,
        "/settings",
        `?state=error&notice=${encodeURIComponent(
          error instanceof Error
            ? error.message
            : "Pertanyaan belum dapat dihapus.",
        )}`,
      ),
    );
  }
  revalidatePath(managePath(parsed.data.publicSlug));
  redirect(managePath(parsed.data.publicSlug, "/settings", "?state=question-deleted"));
}

export async function updateCampusEventRegistrationSettingsAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventRegistrationSettingsSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    registrationMode: formData.get("registrationMode"),
    waitlistEnabled: formData.get("waitlistEnabled") === "on",
    registrationClosesAt: toEventTimestamp(
      formData.get("registrationClosesAt"),
      formData.get("timezone"),
    ),
  });
  if (!parsed.success) redirect("/app/events?state=error");
  try {
    await updateCampusEventRegistrationSettings(parsed.data);
  } catch (error) {
    redirect(
      managePath(
        parsed.data.publicSlug,
        "/settings",
        `?state=error&notice=${encodeURIComponent(
          error instanceof Error
            ? error.message
            : "Pengaturan pendaftaran belum dapat disimpan.",
        )}`,
      ),
    );
  }
  revalidatePath(managePath(parsed.data.publicSlug));
  revalidatePath(detailPath(parsed.data.publicSlug));
  redirect(managePath(parsed.data.publicSlug, "/settings", "?state=settings-updated"));
}

export async function manageCampusEventRegistrationAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventRegistrationManageSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    registrationPublicId: formData.get("registrationPublicId"),
    action: formData.get("action"),
  });
  if (!parsed.success) redirect("/app/events?state=error");
  let status: string;
  try {
    status = await manageCampusEventRegistration(parsed.data);
  } catch (error) {
    redirect(
      managePath(
        parsed.data.publicSlug,
        "/registrations",
        `?state=error&notice=${encodeURIComponent(
          error instanceof Error
            ? error.message
            : "Keputusan pendaftaran belum dapat diproses.",
        )}`,
      ),
    );
  }
  revalidatePath(managePath(parsed.data.publicSlug));
  revalidatePath(detailPath(parsed.data.publicSlug));
  redirect(
    managePath(
      parsed.data.publicSlug,
      "/registrations",
      `?state=registration-${status}`,
    ),
  );
}

export async function inviteCampusEventTeamMemberAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventTeamInviteSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    publicAlias: formData.get("publicAlias"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/app/events?state=error");
  try {
    await inviteCampusEventTeamMember(parsed.data);
  } catch (error) {
    redirect(
      managePath(
        parsed.data.publicSlug,
        "/team",
        `?state=error&notice=${encodeURIComponent(
          error instanceof Error ? error.message : "Undangan tim belum dapat dikirim.",
        )}`,
      ),
    );
  }
  revalidatePath(managePath(parsed.data.publicSlug));
  redirect(managePath(parsed.data.publicSlug, "/team", "?state=team-invited"));
}

export async function respondCampusEventTeamInvitationAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventTeamResponseSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    response: formData.get("response"),
  });
  if (!parsed.success) redirect("/app/events?state=error");
  try {
    const changed = await respondCampusEventTeamInvitation(
      parsed.data.publicSlug,
      parsed.data.response,
    );
    if (!changed) throw new Error("Undangan sudah tidak tersedia.");
  } catch (error) {
    redirect(
      `/app/events?state=error&notice=${encodeURIComponent(
        error instanceof Error ? error.message : "Respons undangan belum tersimpan.",
      )}`,
    );
  }
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
  try {
    await removeCampusEventTeamMember(
      parsed.data.publicSlug,
      parsed.data.publicAlias,
    );
  } catch (error) {
    redirect(
      managePath(
        parsed.data.publicSlug,
        "/team",
        `?state=error&notice=${encodeURIComponent(
          error instanceof Error
            ? error.message
            : "Anggota tim belum dapat dihapus.",
        )}`,
      ),
    );
  }
  revalidatePath(managePath(parsed.data.publicSlug));
  redirect(managePath(parsed.data.publicSlug, "/team", "?state=team-removed"));
}

export async function manualCheckInCampusEventRegistrationAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventManualCheckInSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    registrationPublicId: formData.get("registrationPublicId"),
  });
  if (!parsed.success) {
    return { status: "not_eligible" as const, attendeeAlias: null, checkedInAt: null, message: "Pendaftaran tidak valid." };
  }
  try {
    const result = await manualCheckInCampusEventRegistration(
      parsed.data.publicSlug,
      parsed.data.registrationPublicId,
    );
    revalidatePath(detailPath(parsed.data.publicSlug));
    return { ...result, message: null };
  } catch (error) {
    return { status: "not_eligible" as const, attendeeAlias: null, checkedInAt: null, message: error instanceof Error ? error.message : "Kehadiran belum dapat dicatat." };
  }
}

export async function undoCampusEventCheckInAction(formData: FormData) {
  await requireEventStudent();
  const parsed = eventManualCheckInSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    registrationPublicId: formData.get("registrationPublicId"),
  });
  if (!parsed.success) redirect("/app/events?state=error");
  try {
    await undoCampusEventCheckIn(
      parsed.data.publicSlug,
      parsed.data.registrationPublicId,
    );
  } catch (error) {
    redirect(
      managePath(
        parsed.data.publicSlug,
        "/check-in",
        `?state=error&notice=${encodeURIComponent(
          error instanceof Error ? error.message : "Catatan kehadiran belum dapat dibatalkan.",
        )}`,
      ),
    );
  }
  revalidatePath(managePath(parsed.data.publicSlug));
  revalidatePath(detailPath(parsed.data.publicSlug));
  redirect(managePath(parsed.data.publicSlug, "/check-in", "?state=checkin-undone"));
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
