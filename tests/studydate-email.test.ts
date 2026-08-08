import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const mailer = readFileSync(join(root, "lib/email/mailer.ts"), "utf8");
const template = readFileSync(
  join(root, "lib/email/magic-link-template.ts"),
  "utf8",
);
const delivery = readFileSync(
  join(root, "lib/auth/magic-link-delivery.ts"),
  "utf8",
);
const studentRoute = readFileSync(
  join(root, "app/api/auth/magic-link/route.ts"),
  "utf8",
);
const staffRoute = readFileSync(
  join(root, "app/api/auth/staff-magic-link/route.ts"),
  "utf8",
);
const pkg = readFileSync(join(root, "package.json"), "utf8");

test("magic-link routes never call Supabase Auth mailer signInWithOtp", () => {
  assert.doesNotMatch(studentRoute, /signInWithOtp/);
  assert.doesNotMatch(staffRoute, /signInWithOtp/);
  assert.match(delivery, /generateLink/);
  assert.match(delivery, /sendStudyDateEmail/);
  assert.match(delivery, /\/auth\/confirm/);
});

test("StudyDate email templates are branded and omit Supabase wording", () => {
  assert.match(template, /StudyDate ID/);
  assert.match(template, /#014FE7/);
  assert.match(template, /MEET • CONNECT • GROW/);
  assert.match(template, /logoSrc|STUDYDATE_EMAIL_LOGO_CID|alt="StudyDate ID"/);
  assert.doesNotMatch(template, /supabase|Supabase/i);
});

test("magic-link delivery attaches StudyDate brand logo inline", () => {
  assert.match(delivery, /logo-horizontal-color\.png/);
  assert.match(delivery, /STUDYDATE_EMAIL_LOGO_CID/);
  assert.match(delivery, /inlineAttachments/);
});

test("mailer supports Resend or SMTP and requires StudyDate from address", () => {
  assert.match(mailer, /STUDYDATE_RESEND_API_KEY/);
  assert.match(mailer, /STUDYDATE_SMTP_HOST/);
  assert.match(mailer, /STUDYDATE_EMAIL_FROM/);
  assert.match(mailer, /inlineAttachments/);
  assert.doesNotMatch(mailer, /signInWithOtp/);
});

test("local start/dev listen on port 3010 to match SITE_URL convention", () => {
  assert.match(pkg, /next start --port 3010/);
  assert.match(pkg, /next dev --port 3010/);
});
