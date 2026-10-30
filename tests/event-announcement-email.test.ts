import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { buildEventAnnouncementEmail } from "../lib/email/event-announcement-template.ts";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/202610300001_early_access_duplicates_event_email_v1.sql");
const runner = read("lib/events/announcement-email.ts");
const actions = read("app/app/events/actions.ts");
const manage = read("app/app/events/[publicSlug]/manage/page.tsx");
const settings = read("app/app/settings/page.tsx");
const unsubscribePage = read("app/email/berhenti/page.tsx");
const unsubscribeAction = read("app/email/berhenti/actions.ts");
const envExample = read(".env.example");

const base = {
  eventTitle: "Kelas Statistik",
  eventStartsAt: "2026-11-02T03:00:00Z",
  eventTimezone: "Asia/Jakarta",
  announcementTitle: "Pindah ruang",
  announcementBody: "Ruang pindah ke B201.\nBawa laptop.",
  eventUrl: "https://studydate.id/app/events/kelas#event-announcements",
  unsubscribeUrl: `https://studydate.id/email/berhenti?token=${"a".repeat(64)}`,
  logoSrc: "cid:logo",
};

test("announcement email escapes organizer content", () => {
  const email = buildEventAnnouncementEmail({
    ...base,
    announcementTitle: "<script>alert(1)</script>",
    announcementBody: "Halo <b>semua</b> & \"teman\"",
  });
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /Halo &lt;b&gt;semua&lt;\/b&gt; &amp; &quot;teman&quot;/);
});

test("announcement email subject is a single bounded line", () => {
  const email = buildEventAnnouncementEmail({
    ...base,
    announcementTitle: "Judul\r\nBcc: orang@contoh.com",
    eventTitle: "x".repeat(300),
  });
  assert.doesNotMatch(email.subject, /[\r\n]/);
  assert.ok(email.subject.length <= 150);
});

test("announcement email always carries event link and unsubscribe link", () => {
  const email = buildEventAnnouncementEmail(base);
  assert.match(email.text, /event-announcements/);
  assert.match(email.text, /email\/berhenti\?token=/);
  assert.match(email.html, /Berhenti menerima email pengumuman acara/);
  assert.match(email.html, /Bawa laptop/);
  assert.match(email.html, /<br \/>/);
});

test("recipient addresses stay server-side and service-role only", () => {
  assert.match(migration, /claim_campus_event_email_batch[\s\S]*coalesce\(auth\.role\(\), ''\) <> 'service_role'/);
  assert.match(migration, /revoke all on table public\.campus_event_email_deliveries from public, anon, authenticated/);
  assert.match(migration, /revoke all on table public\.user_email_preferences from public, anon, authenticated/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /announcement_email_day/);
  assert.match(runner, /import "server-only"/);
  assert.match(runner, /createServerAdminClient/);
  assert.doesNotMatch(manage, /recipient_email/);
});

test("event email is fail-closed behind a server flag and opt-out aware", () => {
  assert.match(runner, /process\.env\.EVENT_EMAIL_ENABLED === "true"/);
  assert.match(envExample, /EVENT_EMAIL_ENABLED=false/);
  assert.doesNotMatch(manage, /NEXT_PUBLIC_EVENT_EMAIL/);
  assert.match(actions, /formData\.get\("sendEmail"\) === "on"/);
  assert.match(actions, /isEventEmailEnabled\(\)/);
  assert.match(manage, /Kirim juga lewat email/);
  assert.match(settings, /Email pengumuman acara/);
  assert.match(migration, /event_announcements_enabled/);
});

test("unsubscribe needs an explicit confirmation and never acts on GET", () => {
  assert.match(unsubscribePage, /<form action=\{unsubscribeEventEmailAction\}/);
  assert.match(unsubscribePage, /robots: \{ index: false, follow: false \}/);
  assert.match(unsubscribeAction, /"use server"/);
  assert.match(runner, /\^\[a-f0-9\]\{64\}\$/);
  assert.doesNotMatch(unsubscribePage, /unsubscribeEventEmail\(/);
});
