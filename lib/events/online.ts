import {
  EVENT_ATTENDANCE_MODES,
  EVENT_COVER_BUCKET,
  type EventAttendanceMode,
} from "./constants.ts";

/**
 * Aturan link acara online. Harus sama dengan
 * public.campus_event_meeting_url_allowed() di migration 202610210003.
 */
const EXACT_HOSTS = new Map<string, string>([
  ["zoom.us", "Zoom"],
  ["meet.google.com", "Google Meet"],
  ["teams.microsoft.com", "Microsoft Teams"],
  ["teams.live.com", "Microsoft Teams"],
  ["youtube.com", "YouTube Live"],
  ["www.youtube.com", "YouTube Live"],
  ["youtu.be", "YouTube Live"],
  ["webex.com", "Webex"],
  ["meet.jit.si", "Jitsi Meet"],
]);

const SUBDOMAIN_HOSTS: [RegExp, string][] = [
  [/^[a-z0-9-]+\.zoom\.us$/, "Zoom"],
  [/^[a-z0-9-]+\.webex\.com$/, "Webex"],
];

export const EVENT_MEETING_URL_MIN = 12;
export const EVENT_MEETING_URL_MAX = 500;
export const EVENT_ONLINE_VENUE_AREA =
  "Acara online. Link dibagikan ke peserta terdaftar.";
export const EVENT_ONLINE_CITY = "Online";
export const EVENT_MEETING_URL_ERROR =
  "Pakai link https dari Zoom, Google Meet, Microsoft Teams, YouTube, Webex, atau Jitsi.";

function hostOf(url: string) {
  const match = /^https:\/\/([^/?#:@]+)/.exec(url);
  return match ? match[1].toLowerCase() : null;
}

export function meetingPlatformLabel(url: string): string | null {
  const host = hostOf(url);
  if (!host) return null;
  const exact = EXACT_HOSTS.get(host);
  if (exact) return exact;
  for (const [pattern, label] of SUBDOMAIN_HOSTS) {
    if (pattern.test(host)) return label;
  }
  return null;
}

export function isAllowedMeetingUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (
    value.length < EVENT_MEETING_URL_MIN ||
    value.length > EVENT_MEETING_URL_MAX
  ) {
    return false;
  }
  if (!/^https:\/\/[^\s<>"]+$/.test(value)) return false;
  return meetingPlatformLabel(value) !== null;
}

export function parseAttendanceMode(value: unknown): EventAttendanceMode {
  return typeof value === "string" &&
    (EVENT_ATTENDANCE_MODES as readonly string[]).includes(value)
    ? (value as EventAttendanceMode)
    : "offline";
}

export const EVENT_ATTENDANCE_LABELS: Record<EventAttendanceMode, string> = {
  offline: "Tatap muka",
  online: "Online",
  hybrid: "Tatap muka dan online",
};

/** URL publik sampul. Path selalu dibuat server dan sudah divalidasi database. */
export function eventCoverUrl(path: string | null | undefined) {
  if (!path || !/^[0-9a-f]{24}\/[0-9a-f]{32}\.webp$/.test(path)) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${EVENT_COVER_BUCKET}/${path}`;
}

/** Satu baris lokasi untuk kartu acara, tanpa pernah menampilkan link. */
export function eventPlaceLine(event: {
  venue_category?: string;
  venue_name: string;
  venue_area?: string;
  city: string;
  attendance_mode?: EventAttendanceMode;
}) {
  const online =
    event.venue_category === "online" ||
    event.attendance_mode === "online" ||
    (event.city === EVENT_ONLINE_CITY && event.venue_area === EVENT_ONLINE_VENUE_AREA);
  if (online) {
    return `Online lewat ${event.venue_name}`;
  }
  const place = `${event.venue_name}, ${event.city}`;
  return event.attendance_mode === "hybrid" ? `${place} · bisa online` : place;
}
