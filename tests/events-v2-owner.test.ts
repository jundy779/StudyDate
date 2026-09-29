import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  eventOfficialFlagSchema,
  eventOrganizerEligibilityLookupSchema,
  eventOrganizerEligibilityManageSchema,
} from "../lib/events/validation.ts";

const ownerPage = readFileSync(
  new URL("../app/owner/events/page.tsx", import.meta.url),
  "utf8",
);
const ownerActions = readFileSync(
  new URL("../app/owner/events/actions.ts", import.meta.url),
  "utf8",
);
const ownerOverview = readFileSync(
  new URL("../app/owner/page.tsx", import.meta.url),
  "utf8",
);
const navigation = readFileSync(
  new URL("../components/navigation/responsive-navigation.tsx", import.meta.url),
  "utf8",
);

test("EV2O-01 owner Events route is protected and linked", () => {
  assert.match(ownerPage, /await requireOwner\(\)/);
  assert.match(ownerActions, /await requireOwner\(\)/);
  assert.match(ownerPage, /current="events"/);
  assert.match(ownerOverview, /href="\/owner\/events"/);
  assert.match(navigation, /href: "\/owner\/events"/);
});

test("EV2O-02 organizer trust UI uses exact public alias without private IDs", () => {
  assert.match(ownerPage, /ownerLookupEventOrganizerEligibility/);
  assert.match(ownerPage, /StudyDate Plus[\s\S]*tidak otomatis memberi izin penyelenggara/);
  assert.match(ownerPage, /Terverifikasi/);
  assert.match(ownerPage, /Keputusan Owner/);
  assert.match(ownerPage, /Hasil akhir/);
  assert.doesNotMatch(ownerPage, /userId|user_id|UUID|email/i);
  assert.doesNotMatch(ownerActions, /userId|user_id|targetUserId/);
  assert.equal(
    eventOrganizerEligibilityLookupSchema.safeParse({
      publicAlias: " Partner #100001 ",
    }).success,
    true,
  );
  assert.equal(
    eventOrganizerEligibilityManageSchema.safeParse({
      publicAlias: "Partner #100001",
      action: "grant",
    }).success,
    true,
  );
});

test("EV2O-03 official control validates safe slug and stays server-authoritative", () => {
  const slug = `event-${"a".repeat(24)}`;
  assert.equal(
    eventOfficialFlagSchema.safeParse({
      publicSlug: slug,
      isOfficial: true,
    }).success,
    true,
  );
  assert.equal(
    eventOfficialFlagSchema.safeParse({
      publicSlug: "/app/events/example",
      isOfficial: true,
    }).success,
    false,
  );
  assert.match(ownerActions, /ownerSetCampusEventOfficial/);
  assert.match(ownerActions, /URLSearchParams/);
  assert.match(ownerPage, /OwnerEventDirectory/);
  assert.match(ownerPage, /listStaffCampusEvents/);
  assert.match(ownerPage, /Gunakan daftar acara di atas/);
  assert.doesNotMatch(ownerPage, /Belum ada listing operasional/);
  assert.doesNotMatch(ownerPage, /listCampusEvents|fake|contoh Event/i);
});
