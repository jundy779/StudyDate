export type CalendarEventInput = {
  publicSlug: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venue: string;
  publicUrl: string;
};

const encoder = new TextEncoder();

function toUtcStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal acara tidak valid.");
  }
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldIcsLine(line: string) {
  const parts: string[] = [];
  let current = "";

  for (const character of line) {
    if (current && encoder.encode(`${current}${character}`).length > 73) {
      parts.push(current);
      current = character;
    } else {
      current += character;
    }
  }

  if (current) parts.push(current);
  return parts.join("\r\n ");
}

export function buildGoogleCalendarUrl(event: CalendarEventInput) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUtcStamp(event.startsAt)}/${toUtcStamp(event.endsAt)}`,
    details: `${event.description}\n\nDetail acara: ${event.publicUrl}`,
    location: event.venue,
    ctz: event.timezone,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildICalendar(
  event: CalendarEventInput,
  generatedAt = new Date(),
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StudyDate ID//Acara Kampus//ID",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(`${event.publicSlug}@studydate.id`)}`,
    `DTSTAMP:${toUtcStamp(generatedAt.toISOString())}`,
    `DTSTART:${toUtcStamp(event.startsAt)}`,
    `DTEND:${toUtcStamp(event.endsAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(`${event.description}\n\nDetail acara: ${event.publicUrl}`)}`,
    `LOCATION:${escapeIcsText(event.venue)}`,
    `URL:${escapeIcsText(event.publicUrl)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
