import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const peopleDetail = readFileSync(
  join(root, "app/app/people/[alias]/page.tsx"),
  "utf8",
);
const privacyGrid = readFileSync(
  join(root, "components/people/privacy-field-grid.tsx"),
  "utf8",
);
const counterpartCard = readFileSync(
  join(root, "components/messages/counterpart-privacy-card.tsx"),
  "utf8",
);
const room = readFileSync(
  join(root, "components/messages/conversation-room.tsx"),
  "utf8",
);

test("people detail locks name and socials before mutual without real PII", () => {
  assert.match(peopleDetail, /Maskot profil/);
  assert.match(peopleDetail, /PrivacyFieldGrid/);
  assert.match(peopleDetail, /Identitas & kontak/);
  assert.match(peopleDetail, /LinkedIn/);
  assert.match(peopleDetail, /Instagram/);
  assert.match(peopleDetail, /state: "never"/);
  assert.match(peopleDetail, /NIM/);
  assert.doesNotMatch(peopleDetail, /linkedinUrl|instagramUsername|first_name/);
  assert.doesNotMatch(peopleDetail, /Matchu|FOTO DISAMARKAN/i);
});

test("privacy field grid uses StudyDate locked labels without fake secret blur", () => {
  assert.match(privacyGrid, /Terkunci/);
  assert.match(privacyGrid, /Never pass secrets for locked/i);
  assert.doesNotMatch(privacyGrid, /FakeBlurBar|••••/);
});

test("conversation unlocks fields by StudyDate reveal stages after mutual", () => {
  assert.match(room, /CounterpartPrivacyCard/);
  assert.match(counterpartCard, /sama-sama ingin kenal lebih jauh/);
  assert.match(counterpartCard, /setuju berbagi nama dan foto/);
  assert.match(counterpartCard, /setuju berbagi LinkedIn/);
  assert.match(counterpartCard, /state: "never"/);
  assert.doesNotMatch(counterpartCard, /Matchu/i);
});
