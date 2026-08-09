import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const room = read("components/messages/conversation-room.tsx");
const identityService = read("lib/identity-reveal/service.ts");
const contactService = read("lib/contact-reveal/service.ts");
const messageRoute = read("app/api/messages/[publicId]/route.ts");
const globalError = read("app/global-error.tsx");
const navigation = read("components/navigation/responsive-navigation.tsx");
const landing = read("components/marketing/landing-page.tsx");

test("reveal infrastructure failures are unavailable, never normal empty state", () => {
  assert.doesNotMatch(
    identityService,
    /if \(error\) \{\s*return mapState\(null\)/,
  );
  assert.doesNotMatch(
    contactService,
    /if \(error\) \{\s*return emptyContactRevealState\(\)/,
  );
  assert.match(identityService, /throw new Error\(IDENTITY_REVEAL_COPY\.genericError\)/);
  assert.match(contactService, /throw new Error\(CONTACT_REVEAL_COPY\.genericError\)/);
  assert.match(messageRoute, /status: 503/);
  assert.match(room, /Data pembukaan belum dapat diperbarui\./);
  assert.match(room, /setContactCompleted\(\(current\)/);
});

test("global error boundary is minimal and does not expose exception details", () => {
  assert.match(globalError, /^"use client";/);
  assert.match(globalError, /<html lang="id">/);
  assert.match(globalError, /<body/);
  assert.match(globalError, /onClick=\{reset\}/);
  assert.doesNotMatch(globalError, /error\.message|error\.stack|digest/);
});

test("hidden and secondary responsive images are no longer preloaded", () => {
  assert.doesNotMatch(
    navigation,
    /className="h-10 w-10 object-contain lg:hidden"\s*priority/,
  );
  assert.doesNotMatch(
    navigation,
    /className="hidden h-auto w-\[158px\] lg:block"\s*priority/,
  );
  assert.doesNotMatch(
    landing,
    /className="h-6 w-6 object-contain"\s*priority/,
  );
  assert.match(landing, /<BrandLogo priority \/>/);
});

test("security and privacy projections remain free of forbidden payload fields", () => {
  for (const source of [room, messageRoute]) {
    assert.doesNotMatch(
      source,
      /dangerouslySetInnerHTML|innerHTML\s*=|\beval\(|contact_ciphertext|contact_auth_tag|mine_iv|counterpart_iv|nim_ciphertext|service_role|SUPABASE_SERVICE_ROLE_KEY|CONTACT_REVEAL_ENCRYPTION_KEY/,
    );
  }
  assert.doesNotMatch(messageRoute, /participant_sender_id|participant_recipient_id/);
});
