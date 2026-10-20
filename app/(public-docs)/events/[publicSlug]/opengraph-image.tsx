import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { eventCoverUrl } from "@/lib/events/online";
import {
  EVENT_CATEGORY_LABELS,
  formatEventDateTime,
  eventTimezoneLabel,
} from "@/lib/events/presentation";
import { getPublicCampusEvent } from "@/lib/events/public-service";
import { eventSlugSchema } from "@/lib/events/validation";

export const alt = "Acara di StudyDate ID";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0F1B33";
const BLUE = "#014FE7";

async function publicAsset(path: string) {
  const bytes = await readFile(join(process.cwd(), "public", path));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

/** Sampul disimpan WebP; renderer gambar OG lebih aman dengan JPEG. */
async function coverDataUrl(path: string | null) {
  const url = eventCoverUrl(path);
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(560, 630, { fit: "cover", position: "attention" })
      .jpeg({ quality: 80 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function EventOpenGraphImage({
  params,
}: {
  params: Promise<{ publicSlug: string }>;
}) {
  const { publicSlug } = await params;
  const slug = eventSlugSchema.safeParse(publicSlug);
  const event = slug.success
    ? await getPublicCampusEvent(slug.data).catch(() => null)
    : null;

  const [logo, mascot, cover] = await Promise.all([
    publicAsset("brand/logo-horizontal-color.png"),
    publicAsset("brand/mascot/expressions/girang-sticker.png"),
    coverDataUrl(event?.cover_path ?? null),
  ]);

  const title = event?.title ?? "Acara kampus di StudyDate";
  const when = event
    ? `${formatEventDateTime(event.starts_at, event.timezone_name)} ${eventTimezoneLabel(event.timezone_name)}`
    : "Cari acara belajar dan komunitas kampus";
  const where = event
    ? event.attendance_mode === "online"
      ? `Online lewat ${event.venue_name}`
      : `${event.venue_name}, ${event.city}${event.attendance_mode === "hybrid" ? " · bisa online" : ""}`
    : "studydate.id/events";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 56px 52px 64px",
            backgroundColor: "#FBFCFF",
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent 0px, transparent 38px, #E3EAF7 38px, #E3EAF7 39px)",
          }}
        >
          <img src={logo} width={230} height={52} alt="" />

          <div style={{ display: "flex", flexDirection: "column" }}>
            {event ? (
              <div
                style={{
                  display: "flex",
                  alignSelf: "flex-start",
                  padding: "8px 18px",
                  borderRadius: 999,
                  border: `3px solid ${NAVY}`,
                  background: "#FFDC72",
                  color: NAVY,
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                {EVENT_CATEGORY_LABELS[event.category]}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontSize: title.length > 60 ? 50 : 60,
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: "-0.03em",
                color: NAVY,
                maxWidth: 600,
              }}
            >
              {title.length > 90 ? `${title.slice(0, 88)}...` : title}
            </div>
            <div style={{ display: "flex", marginTop: 26, fontSize: 26, color: BLUE, fontWeight: 700 }}>
              {when}
            </div>
            <div style={{ display: "flex", marginTop: 8, fontSize: 24, color: "#4B5565" }}>
              {where.length > 64 ? `${where.slice(0, 62)}...` : where}
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: NAVY }}>
            studydate.id
          </div>
        </div>

        <div
          style={{
            width: 520,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            background: BLUE,
            borderLeft: `6px solid ${NAVY}`,
          }}
        >
          {cover ? (
            <img
              src={cover}
              width={520}
              height={630}
              alt=""
              style={{ objectFit: "cover", width: 520, height: 630 }}
            />
          ) : (
            <img src={mascot} width={340} height={340} alt="" />
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
