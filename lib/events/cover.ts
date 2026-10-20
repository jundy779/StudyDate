import "server-only";

import { randomBytes } from "node:crypto";
import sharp from "sharp";
import {
  EVENT_COVER_HEIGHT,
  EVENT_COVER_MAX_BYTES,
  EVENT_COVER_WIDTH,
} from "@/lib/events/constants";

export const EVENT_COVER_ERROR =
  "Foto belum bisa dipakai. Pakai JPG, PNG, atau WebP minimal 640 x 360 piksel dan maksimal 5 MB.";

const MAX_INPUT_DIMENSION = 6000;
const MIN_WIDTH = 640;
const MIN_HEIGHT = 360;
/** Hasil akhir dibatasi supaya bucket tetap ringan (batas bucket 2 MB). */
const MAX_OUTPUT_BYTES = 1_800_000;

/**
 * Ubah foto apa pun yang lolos menjadi WebP 1600x900. Output sharp tidak membawa
 * EXIF, jadi lokasi GPS dan data kamera ikut terbuang.
 */
export async function processEventCover(input: Buffer, publicSlug: string) {
  if (!input.length || input.byteLength > EVENT_COVER_MAX_BYTES) {
    throw new Error(EVENT_COVER_ERROR);
  }
  const slugHex = /^event-([0-9a-f]{24})$/.exec(publicSlug)?.[1];
  if (!slugHex) throw new Error(EVENT_COVER_ERROR);

  const image = sharp(input, {
    failOn: "warning",
    animated: false,
    pages: 1,
    limitInputPixels: MAX_INPUT_DIMENSION * MAX_INPUT_DIMENSION,
  });
  const metadata = await image.metadata();
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
    throw new Error(EVENT_COVER_ERROR);
  }
  if ((metadata.pages ?? 1) > 1) throw new Error(EVENT_COVER_ERROR);

  // Foto dari ponsel sering diputar lewat EXIF; ukur setelah orientasi dibetulkan.
  const rotated = (metadata.orientation ?? 1) >= 5;
  const width = (rotated ? metadata.height : metadata.width) ?? 0;
  const height = (rotated ? metadata.width : metadata.height) ?? 0;
  if (width < MIN_WIDTH || height < MIN_HEIGHT) throw new Error(EVENT_COVER_ERROR);

  let quality = 82;
  let buffer = Buffer.alloc(0);
  while (quality >= 50) {
    buffer = await sharp(input, {
      failOn: "warning",
      limitInputPixels: MAX_INPUT_DIMENSION * MAX_INPUT_DIMENSION,
    })
      .rotate()
      .resize({
        width: EVENT_COVER_WIDTH,
        height: EVENT_COVER_HEIGHT,
        fit: "cover",
        position: "attention",
      })
      .webp({ quality })
      .toBuffer();
    if (buffer.byteLength <= MAX_OUTPUT_BYTES) break;
    quality -= 12;
  }
  if (!buffer.byteLength || buffer.byteLength > MAX_OUTPUT_BYTES) {
    throw new Error(EVENT_COVER_ERROR);
  }

  const output = await sharp(buffer).metadata();
  if (
    output.format !== "webp" ||
    output.width !== EVENT_COVER_WIDTH ||
    output.height !== EVENT_COVER_HEIGHT ||
    output.exif
  ) {
    throw new Error(EVENT_COVER_ERROR);
  }

  return {
    buffer,
    contentType: "image/webp" as const,
    path: `${slugHex}/${randomBytes(16).toString("hex")}.webp`,
  };
}
