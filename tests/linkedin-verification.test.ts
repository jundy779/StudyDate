import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const service = source("lib/verification/linkedin.ts");
const startRoute = source(
  "app/api/verification/linkedin/start/route.ts",
);
const callbackRoute = source(
  "app/api/verification/linkedin/callback/route.ts",
);
const card = source(
  "components/verification/linkedin-verification-card.tsx",
);
const page = source("app/app/verification/page.tsx");
const actions = source("app/app/verification/actions.ts");
const migration = source(
  "supabase/migrations/202609120001_linkedin_verification_links_v1.sql",
);
const environment = source(".env.example");
const product = source("context/PRD.md");

test("LinkedIn is a separate optional trust signal", () => {
  assert.match(card, /Verifikasi tambahan/);
  assert.match(card, /tanpa mengganti proses\s+verifikasi mahasiswa/);
  assert.match(card, /Status mahasiswa tetap diperiksa lewat PDDikti/);
  assert.match(product, /LinkedIn tidak menggantikan PDDikti/);
  assert.doesNotMatch(service, /profiles[\s\S]*verification_status/);
  assert.match(page, /LinkedInVerificationCard/);
});

test("LinkedIn flow is fail-closed behind server-only configuration", () => {
  assert.match(environment, /LINKEDIN_VERIFICATION_ENABLED=false/);
  assert.match(service, /LINKEDIN_VERIFICATION_ENABLED !== "true"/);
  assert.match(service, /redirectUri\?\.startsWith\("https:\/\/"\)/);
  assert.match(service, /LINKEDIN_MEMBER_HASH_KEY/);
  assert.match(service, /decoded\.length === 32/);
});

test("LinkedIn OAuth uses authenticated short-lived CSRF state", () => {
  assert.match(startRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(startRoute, /randomBytes\(32\)/);
  assert.match(startRoute, /httpOnly: true/);
  assert.match(startRoute, /sameSite: "lax"/);
  assert.match(startRoute, /maxAge: 10 \* 60/);
  assert.match(callbackRoute, /timingSafeEqual/);
  assert.match(callbackRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(callbackRoute, /request\.cookies\.get\(LINKEDIN_STATE_COOKIE\)/);
  assert.doesNotMatch(startRoute + callbackRoute, /console\.(log|warn|error)/);
});

test("LinkedIn API reads official verification categories only", () => {
  assert.match(service, /r_profile_basicinfo r_verify_details/);
  assert.match(service, /\/rest\/identityMe/);
  assert.match(service, /\/rest\/verificationReport/);
  assert.match(service, /categories\.has\("IDENTITY"\)/);
  assert.match(service, /categories\.has\("WORKPLACE"\)/);
  assert.doesNotMatch(service, /r_most_recent_education/);
});

test("LinkedIn tokens and raw member IDs are not persisted", () => {
  assert.match(service, /createHmac\("sha256", config\.memberHashKey\)/);
  assert.match(migration, /member_id_hash text not null/);
  assert.doesNotMatch(migration, /access_token|refresh_token|raw_response/i);
  assert.doesNotMatch(
    service.slice(service.indexOf("saveLinkedInVerification")),
    /access_token|accessToken/,
  );
});

test("LinkedIn rows are read-only and owner-scoped for students", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(
    migration,
    /revoke all on table public\.linkedin_verification_links[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant select on table public\.linkedin_verification_links to authenticated/,
  );
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.doesNotMatch(migration, /for (insert|update|delete)/i);
  assert.match(migration, /member_hash_unique/);
});

test("students can remove only their own LinkedIn connection", () => {
  assert.match(card, /Putuskan dari StudyDate/);
  assert.match(page, /unlinkLinkedInVerification/);
  assert.match(actions, /supabase\.auth\.getUser\(\)/);
  assert.match(actions, /\.eq\("user_id", user\.id\)/);
  assert.doesNotMatch(actions, /formData.*user/i);
});
