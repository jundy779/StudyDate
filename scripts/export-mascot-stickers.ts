/**
 * Ekspor kepala maskot StudyDate ke PNG untuk sosmed dan stiker.
 *
 * Jalankan: npm run brand:mascot-stickers
 *
 * Hasil di public/brand/mascot/expressions/:
 *   <ekspresi>.png          512 px, latar transparan
 *   <ekspresi>-sticker.png  512 px, tepi putih tebal seperti stiker
 *   <ekspresi>-square.png   1080 px, kotak untuk post Instagram
 *
 * Bentuk maskot diambil dari lib/brand/mascot.ts, jadi stiker selalu sama
 * dengan maskot di website.
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import {
  MASCOT_EXPRESSIONS,
  mascotStickerSvgString,
  mascotSvgString,
} from "../lib/brand/mascot.ts";

const OUT_DIR = join(process.cwd(), "public", "brand", "mascot", "expressions");
const SQUARE_BACKGROUND = "#EAF1FF";

async function render(expression: (typeof MASCOT_EXPRESSIONS)[number]) {
  const plain = await sharp(Buffer.from(mascotSvgString(expression, 448)))
    .extend({ top: 32, bottom: 32, left: 32, right: 32, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp(plain).toFile(join(OUT_DIR, `${expression}.png`));

  await sharp(Buffer.from(mascotStickerSvgString(expression, 512)))
    .png()
    .toFile(join(OUT_DIR, `${expression}-sticker.png`));

  const big = await sharp(Buffer.from(mascotSvgString(expression, 760))).png().toBuffer();
  await sharp({
    create: { width: 1080, height: 1080, channels: 4, background: SQUARE_BACKGROUND },
  })
    .composite([{ input: big, gravity: "center" }])
    .png()
    .toFile(join(OUT_DIR, `${expression}-square.png`));
}

await mkdir(OUT_DIR, { recursive: true });
for (const expression of MASCOT_EXPRESSIONS) {
  await render(expression);
  console.log(`ok ${expression}`);
}
