import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  CONTACT_LINK_KINDS,
  CONTACT_LINK_META,
  isAllowedContactUrl,
} from "../lib/marketing/contact-links-config.ts";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const migration = read("supabase/migrations/202610200002_public_contact_links_v1.sql");

test("contact URLs only accept official platform hosts over https", () => {
  assert.equal(isAllowedContactUrl("instagram", "https://www.instagram.com/studydate.id"), true);
  assert.equal(isAllowedContactUrl("instagram", "https://instagram.com.evil.com/x"), false);
  assert.equal(isAllowedContactUrl("instagram", "https://instagram.com@evil.com/x"), false);
  assert.equal(isAllowedContactUrl("youtube", "http://youtube.com/x"), false);
  assert.equal(isAllowedContactUrl("whatsapp", "https://wa.me/628123"), true);
  assert.equal(isAllowedContactUrl("telegram_bot", "https://t.me/StudyDateBot"), true);
  assert.equal(isAllowedContactUrl("x", "javascript:alert(1)"), false);
  assert.equal(isAllowedContactUrl("email", "mailto:halo@studydate.id"), true);
  assert.equal(isAllowedContactUrl("email", "https://studydate.id"), false);
});

test("TypeScript and SQL agree on kinds and hosts", () => {
  for (const kind of CONTACT_LINK_KINDS) {
    assert.match(migration, new RegExp(`'${kind}'`), kind);
    for (const host of CONTACT_LINK_META[kind].hosts) {
      assert.match(migration, new RegExp(`'${host.replaceAll(".", "\\.")}'`), `${kind} ${host}`);
    }
  }
});

test("contact links are private, owner-managed, and never seeded", () => {
  assert.match(migration, /revoke all on table public\.public_contact_links from public, anon, authenticated/);
  assert.match(migration, /owner_save_contact_link[\s\S]*is_current_active_staff\(array\['owner'\]::text\[\], false\)/);
  assert.doesNotMatch(migration, /insert into public\.public_contact_links \(kind, url, is_visible\)\s*values/);
  const footer = read("components/marketing/public-footer.tsx");
  assert.match(footer, /rel: "noopener noreferrer"/);
  assert.match(footer, /if \(!links\.length\) return null;/);
});
