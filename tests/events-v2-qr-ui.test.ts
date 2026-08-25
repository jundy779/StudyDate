import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const ticket = readFileSync(
  join(root, "components/events/event-ticket-issuer.tsx"),
  "utf8",
);
const scanner = readFileSync(
  join(root, "components/events/event-qr-scanner.tsx"),
  "utf8",
);
const scanPage = readFileSync(
  join(
    root,
    "app/app/events/[publicSlug]/manage/check-in/scan/page.tsx",
  ),
  "utf8",
);
const detailPage = readFileSync(
  join(root, "app/app/events/[publicSlug]/page.tsx"),
  "utf8",
);
const nextConfig = readFileSync(join(root, "next.config.ts"), "utf8");

test("EV2QR-01 participant ticket renders an accessible QR without raw token UI", () => {
  assert.match(ticket, /import \{ QRCodeSVG \} from "qrcode\.react"/);
  assert.match(ticket, /<QRCodeSVG/);
  assert.match(ticket, /title=\{`QR tiket/);
  assert.match(ticket, /StudyDate ID · Tiket kehadiran/);
  assert.match(ticket, /eventTitle/);
  assert.match(ticket, /attendeeAlias/);
  assert.match(ticket, /formattedDate/);
  assert.match(ticket, /venue/);
  assert.doesNotMatch(ticket, /<code|copy|clipboard/i);
  assert.doesNotMatch(ticket, />\s*\{state\.ticketToken\}\s*</);
});

test("EV2QR-02 regeneration warns that old QR screenshots become invalid", () => {
  assert.match(ticket, /name="regenerate" value="true"/);
  assert.match(ticket, /Screenshot tiket lama juga tidak dapat\s+dipakai/);
  assert.match(ticket, /Ya, buat ulang dan batalkan QR lama/);
});

test("EV2QR-03 scanner uses environment camera, device switching, and cleanup", () => {
  assert.match(scanner, /new BrowserQRCodeReader\(\)/);
  assert.match(scanner, /decodeFromConstraints/);
  assert.match(scanner, /facingMode: \{ ideal: "environment" \}/);
  assert.match(scanner, /listVideoInputDevices/);
  assert.match(scanner, /controlsRef\.current\?\.stop\(\)/);
  assert.match(scanner, /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(scanner, /setTimeout\(\(\) => \{/);
  assert.match(scanner, /1200/);
  assert.doesNotMatch(scanner, /console\.|URLSearchParams|router\.refresh/);
});

test("EV2QR-03b security policy allows same-origin camera for the scanner", () => {
  assert.match(nextConfig, /camera=\(self\)/);
  assert.doesNotMatch(nextConfig, /camera=\(\)/);
});

test("EV2QR-04 express scanner handles every safe result with live feedback", () => {
  for (const status of [
    "checked_in",
    "duplicate",
    "wrong_event",
    "invalid",
    "revoked",
    "not_eligible",
    "outside_window",
    "rate_limited",
  ]) {
    assert.match(scanner, new RegExp(`case "${status}"`));
  }
  assert.match(scanner, /inFlightRef\.current/);
  assert.match(scanner, /aria-live=\{isSuccess \? "assertive" : "polite"\}/);
  assert.match(scanner, /Check-in manual tanpa kamera/);
});

test("EV2QR-05 scanner route fails closed and detail no longer accepts ticket token input", () => {
  assert.match(scanPage, /getCampusEventCheckInManagement/);
  assert.match(scanPage, /manage\/check-in/);
  assert.match(scanPage, /<EventQrScanner/);
  assert.match(detailPage, /\/manage/);
  assert.doesNotMatch(detailPage, /name="ticketToken"|Token tiket peserta/);
});
