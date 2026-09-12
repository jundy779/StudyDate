import { buildICalendar } from "@/lib/events/calendar";
import { getPublicCampusEvent } from "@/lib/events/public-service";
import { eventSlugSchema } from "@/lib/events/validation";
import { getPublicSiteUrl } from "@/lib/marketing/site-origin";

type CalendarRouteProps = {
  params: Promise<{ publicSlug: string }>;
};

export async function GET(_request: Request, { params }: CalendarRouteProps) {
  const { publicSlug } = await params;
  const parsedSlug = eventSlugSchema.safeParse(publicSlug);
  if (!parsedSlug.success) {
    return new Response("Acara tidak ditemukan.", { status: 404 });
  }

  const event = await getPublicCampusEvent(parsedSlug.data).catch(() => null);
  if (!event) {
    return new Response("Acara tidak ditemukan.", { status: 404 });
  }

  const publicUrl = getPublicSiteUrl(`/events/${event.public_slug}`);
  const calendar = buildICalendar({
    publicSlug: event.public_slug,
    title: event.title,
    description: event.description,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    timezone: event.timezone_name,
    venue: `${event.venue_name}, ${event.venue_area}, ${event.city}`,
    publicUrl,
  });

  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="studydate-${event.public_slug}.ics"`,
      "Cache-Control": "public, max-age=0, s-maxage=300",
    },
  });
}
