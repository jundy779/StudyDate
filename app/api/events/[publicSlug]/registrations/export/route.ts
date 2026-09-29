import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  EVENT_REGISTRATION_STATUSES,
  type EventRegistrationStatus,
} from "@/lib/events/constants";
import { buildEventRegistrationCsv } from "@/lib/events/registration-export";
import {
  getCampusEvent,
  listCampusEventRegistrationQuestions,
  listCampusEventRegistrations,
  type CampusEventRegistration,
} from "@/lib/events/service";
import { eventSlugSchema } from "@/lib/events/validation";
import { NextResponse, type NextRequest } from "next/server";

type RouteContext = {
  params: Promise<{ publicSlug: string }>;
};

const EXPORT_PAGE_LIMIT = 20;

function isRegistrationStatus(
  value: string,
): value is EventRegistrationStatus {
  return EVENT_REGISTRATION_STATUSES.includes(
    value as EventRegistrationStatus,
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at || profile.deactivated_at) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { publicSlug: rawSlug } = await context.params;
  const publicSlug = eventSlugSchema.safeParse(rawSlug);
  if (!publicSlug.success) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const rawStatus = request.nextUrl.searchParams.get("status");
  if (rawStatus && !isRegistrationStatus(rawStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const status: EventRegistrationStatus | undefined = rawStatus
    ? (rawStatus as EventRegistrationStatus)
    : undefined;

  try {
    const event = await getCampusEvent(publicSlug.data);
    if (!event?.can_manage_registrations) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const questions = await listCampusEventRegistrationQuestions(
      publicSlug.data,
    );
    const registrations: CampusEventRegistration[] = [];
    let beforeRsvpedAt: string | undefined;
    let beforePublicId: string | undefined;
    let hasMore = false;

    for (let page = 0; page < EXPORT_PAGE_LIMIT; page += 1) {
      const result = await listCampusEventRegistrations({
        publicSlug: publicSlug.data,
        status,
        beforeRsvpedAt,
        beforePublicId,
      });
      registrations.push(...result.registrations);
      hasMore = Boolean(result.nextCursor);
      if (!result.nextCursor) break;
      beforeRsvpedAt = result.nextCursor.beforeRsvpedAt;
      beforePublicId = result.nextCursor.beforePublicId;
    }

    if (hasMore) {
      return NextResponse.json(
        { error: "export_too_large" },
        { status: 409 },
      );
    }

    const csv = buildEventRegistrationCsv({
      timezone: event.timezone_name,
      questions,
      registrations,
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="studydate-peserta-${event.public_slug}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
