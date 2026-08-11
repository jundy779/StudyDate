import sharp from "sharp";
import { MAX_EVIDENCE_BYTES } from "./constants.ts";

const ACCEPTED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);
const FORMAT_CONTENT_TYPE = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;
const MAX_DIMENSION = 4096;
const MAX_PIXELS = MAX_DIMENSION * MAX_DIMENSION;

export type ProcessedVerificationEvidence = {
  buffer: Buffer;
  contentType: "image/jpeg";
  extension: "jpg";
  width: number;
  height: number;
};

export async function processVerificationEvidenceFile(
  file: File,
): Promise<ProcessedVerificationEvidence> {
  if (
    !file.size ||
    file.size > MAX_EVIDENCE_BYTES ||
    !ACCEPTED_CONTENT_TYPES.has(file.type)
  ) {
    throw new Error("Evidence invalid.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(input, {
      failOn: "warning",
      animated: false,
      pages: 1,
      limitInputPixels: MAX_PIXELS,
    });
    const metadata = await image.metadata();
    if (
      !metadata.format ||
      !ACCEPTED_FORMATS.has(metadata.format) ||
      FORMAT_CONTENT_TYPE[metadata.format as keyof typeof FORMAT_CONTENT_TYPE] !== file.type ||
      (metadata.pages ?? 1) !== 1 ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > MAX_DIMENSION ||
      metadata.height > MAX_DIMENSION
    ) {
      throw new Error("Evidence invalid.");
    }

    const buffer = await image
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    const output = await sharp(buffer).metadata();
    if (!output.width || !output.height || buffer.byteLength > MAX_EVIDENCE_BYTES) {
      throw new Error("Evidence invalid.");
    }
    return {
      buffer,
      contentType: "image/jpeg",
      extension: "jpg",
      width: output.width,
      height: output.height,
    };
  } catch {
    throw new Error("Evidence invalid.");
  }
}
