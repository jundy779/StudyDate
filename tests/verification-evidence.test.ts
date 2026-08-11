import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { MAX_EVIDENCE_BYTES } from "../lib/verification/constants.ts";
import { processVerificationEvidenceFile } from "../lib/verification/evidence-core.ts";

async function imageFile(format: "jpeg" | "png" | "webp", type: string) {
  const image = sharp({
    create: {
      width: 64,
      height: 48,
      channels: 3,
      background: "#f7f2e9",
    },
  });
  const encoded =
    format === "jpeg"
      ? image.jpeg({ quality: 80 })
      : format === "png"
        ? image.png()
        : image.webp({ quality: 80 });
  const buffer = await encoded
    .withMetadata({ orientation: 6 })
    .toBuffer();
  return new File([buffer], `evidence.${format}`, { type });
}

test("JPEG, PNG, and WebP are decoded and re-encoded without metadata", async () => {
  for (const [format, type] of [
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ] as const) {
    const result = await processVerificationEvidenceFile(await imageFile(format, type));
    const metadata = await sharp(result.buffer).metadata();
    assert.equal(result.contentType, "image/jpeg");
    assert.equal(result.extension, "jpg");
    assert.equal(metadata.format, "jpeg");
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
    assert.equal(metadata.xmp, undefined);
    assert.equal(metadata.orientation, undefined);
  }
});

test("SVG, GIF, spoofed MIME, oversized, corrupted, and oversized dimensions fail", async () => {
  const jpeg = await imageFile("jpeg", "image/jpeg");
  const invalidFiles = [
    new File(["<svg xmlns='http://www.w3.org/2000/svg'/>"], "evidence.svg", {
      type: "image/svg+xml",
    }),
    new File([Buffer.from("R0lGODlhAQABAAAAACw=", "base64")], "evidence.gif", {
      type: "image/gif",
    }),
    new File([await jpeg.arrayBuffer()], "spoofed.png", { type: "image/png" }),
    new File([new Uint8Array(MAX_EVIDENCE_BYTES + 1)], "large.jpg", {
      type: "image/jpeg",
    }),
    new File(["not-an-image"], "broken.jpg", { type: "image/jpeg" }),
  ];
  for (const file of invalidFiles) {
    await assert.rejects(processVerificationEvidenceFile(file), /Evidence invalid/);
  }

  const oversized = await sharp({
    create: {
      width: 4097,
      height: 1,
      channels: 3,
      background: "#ffffff",
    },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    processVerificationEvidenceFile(
      new File([oversized], "oversized-dimensions.png", { type: "image/png" }),
    ),
    /Evidence invalid/,
  );
});
