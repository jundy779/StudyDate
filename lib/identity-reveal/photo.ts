import "server-only";

import { randomBytes } from "node:crypto";
import sharp from "sharp";
import {
  IDENTITY_REVEAL_COPY,
  IDENTITY_REVEAL_MAX_BYTES,
  IDENTITY_REVEAL_MAX_DIMENSION,
  IDENTITY_REVEAL_MIN_DIMENSION,
  IDENTITY_REVEAL_OUTPUT_MAX_EDGE,
} from "@/lib/identity-reveal/constants";

export type ProcessedRevealPhoto = {
  buffer: Buffer;
  contentType: "image/jpeg";
  extension: "jpg";
  width: number;
  height: number;
  byteSize: number;
  objectKey: string;
};

function randomHex(bytes: number) {
  return randomBytes(bytes).toString("hex");
}

export async function processIdentityRevealPhoto(
  input: Buffer,
): Promise<ProcessedRevealPhoto> {
  if (!input.length || input.byteLength > IDENTITY_REVEAL_MAX_BYTES) {
    throw new Error(IDENTITY_REVEAL_COPY.photoError);
  }

  const image = sharp(input, {
    failOn: "error",
    animated: false,
    pages: 1,
  });

  const metadata = await image.metadata();

  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
    throw new Error(IDENTITY_REVEAL_COPY.photoError);
  }

  if ((metadata.pages ?? 1) > 1) {
    throw new Error(IDENTITY_REVEAL_COPY.photoError);
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (
    width < IDENTITY_REVEAL_MIN_DIMENSION ||
    height < IDENTITY_REVEAL_MIN_DIMENSION ||
    width > IDENTITY_REVEAL_MAX_DIMENSION ||
    height > IDENTITY_REVEAL_MAX_DIMENSION
  ) {
    throw new Error(IDENTITY_REVEAL_COPY.photoError);
  }

  // Default sharp output strips EXIF/metadata. Auto-orient then normalize to JPEG.
  const buffer = await image
    .rotate()
    .resize({
      width: IDENTITY_REVEAL_OUTPUT_MAX_EDGE,
      height: IDENTITY_REVEAL_OUTPUT_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  const outputMeta = await sharp(buffer).metadata();
  const outWidth = outputMeta.width ?? 0;
  const outHeight = outputMeta.height ?? 0;

  if (
    outWidth < IDENTITY_REVEAL_MIN_DIMENSION ||
    outHeight < IDENTITY_REVEAL_MIN_DIMENSION
  ) {
    throw new Error(IDENTITY_REVEAL_COPY.photoError);
  }

  if (buffer.byteLength > IDENTITY_REVEAL_MAX_BYTES) {
    throw new Error(IDENTITY_REVEAL_COPY.photoError);
  }

  return {
    buffer,
    contentType: "image/jpeg",
    extension: "jpg",
    width: outWidth,
    height: outHeight,
    byteSize: buffer.byteLength,
    objectKey: `${randomHex(16)}/${randomHex(16)}.jpg`,
  };
}
