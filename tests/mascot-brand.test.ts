import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  MASCOT_EXPRESSION_LABELS,
  MASCOT_EXPRESSIONS,
  mascotStickerSvgString,
  mascotSvgString,
} from "../lib/brand/mascot.ts";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("every mascot expression renders a valid standalone SVG", () => {
  for (const expression of MASCOT_EXPRESSIONS) {
    const svg = mascotSvgString(expression, 256);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /class="mascot-face"/);
    assert.doesNotMatch(svg, /className=|undefined|NaN/);
    assert.ok(MASCOT_EXPRESSION_LABELS[expression]);
    assert.match(mascotStickerSvgString(expression), /feMorphology/);
  }
});

test("exported mascot stickers exist for every expression", () => {
  for (const expression of MASCOT_EXPRESSIONS) {
    for (const suffix of ["", "-sticker", "-square"]) {
      assert.ok(
        existsSync(join(root, "public/brand/mascot/expressions", `${expression}${suffix}.png`)),
        `${expression}${suffix}.png`,
      );
    }
  }
});

test("interactive mascot stays accessible and honest", () => {
  const buddy = read("components/marketing/mascot-buddy.tsx");
  assert.match(buddy, /aria-live="polite"/);
  assert.match(buddy, /aria-label=\{`Colek \$\{label\}`\}/);
  assert.match(buddy, /prefers-reduced-motion: reduce/);
  assert.match(buddy, /bukan jaminan keamanan/);
  assert.doesNotMatch(buddy, /match ditemukan|jodoh|pasangan/i);
});

test("landing motion respects reduced motion and stays on brand copy", () => {
  const css = read("app/globals.css");
  const landing = read("components/marketing/landing-page.tsx");
  assert.match(css, /\.tilt-card \{\s*transform: none !important;/);
  assert.match(css, /\.mascot-head \.mascot-antenna,/);
  assert.match(landing, /Contoh tiket, bukan acara sungguhan\./);
  assert.match(landing, /Contoh circle, bukan data sungguhan\./);
  assert.doesNotMatch(landing, /Match ditemukan|partner yang tepat|skor kecocokan/i);
});
