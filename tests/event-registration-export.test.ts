import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { buildEventRegistrationCsv } from "../lib/events/registration-export.ts";

const root = process.cwd();
const routeSource = readFileSync(
  join(
    root,
    "app/api/events/[publicSlug]/registrations/export/route.ts",
  ),
  "utf8",
);
const pageSource = readFileSync(
  join(
    root,
    "app/app/events/[publicSlug]/manage/registrations/page.tsx",
  ),
  "utf8",
);

test("event CSV contains only the privacy-safe organizer projection", () => {
  const csv = buildEventRegistrationCsv({
    timezone: "Asia/Jakarta",
    questions: [
      {
        question_public_id: "a".repeat(32),
        question_type: "short_text",
        prompt: "Tujuan mengikuti acara",
        options: [],
        is_required: false,
        sort_order: 0,
      },
    ],
    registrations: [
      {
        registration_public_id: "b".repeat(32),
        public_alias: "Mahasiswa #100001",
        campus: "STT Terpadu Nurul Fikri",
        study_program: "Sistem Informasi",
        semester: 8,
        interests: ["Teknologi"],
        registration_status: "going",
        registration_answers: {
          ["a".repeat(32)]: "Belajar bersama",
        },
        checked_in_at: null,
        checkin_method: null,
        rsvped_at: "2026-09-29T07:00:00.000Z",
      },
    ],
  });

  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.match(csv, /Alias peserta/);
  assert.match(csv, /Mahasiswa #100001/);
  assert.match(csv, /Tujuan mengikuti acara/);
  assert.match(csv, /Belajar bersama/);
  assert.doesNotMatch(csv, /bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/);
  assert.doesNotMatch(csv, /user_id|email|nim|nomor telepon/i);
});

test("event CSV neutralizes spreadsheet formulas and escapes quotes", () => {
  const csv = buildEventRegistrationCsv({
    timezone: "Asia/Jakarta",
    questions: [],
    registrations: [
      {
        registration_public_id: "c".repeat(32),
        public_alias: "=HYPERLINK(\"https://example.com\")",
        campus: "+SUM(1,1)",
        study_program: "@cmd",
        semester: null,
        interests: [],
        registration_status: "pending",
        registration_answers: {},
        checked_in_at: null,
        checkin_method: null,
        rsvped_at: "2026-09-29T07:00:00.000Z",
      },
    ],
  });

  assert.match(csv, /'=HYPERLINK\(""https:\/\/example\.com""\)/);
  assert.match(csv, /'\+SUM\(1,1\)/);
  assert.match(csv, /'@cmd/);
});

test("event CSV route stays manager-only, bounded, and non-cacheable", () => {
  assert.match(routeSource, /getAuthenticatedUser/);
  assert.match(routeSource, /can_manage_registrations/);
  assert.match(routeSource, /EXPORT_PAGE_LIMIT = 20/);
  assert.match(routeSource, /private, no-store/);
  assert.match(routeSource, /text\/csv; charset=utf-8/);
  assert.match(routeSource, /X-Content-Type-Options/);
  assert.doesNotMatch(routeSource, /service[_-]?role|adminClient/i);
});

test("registration manager exposes a filtered CSV download without mobile scrolling", () => {
  assert.match(pageSource, /Unduh CSV/);
  assert.match(pageSource, /\?status=\$\{activeStatus\}/);
  assert.match(pageSource, /aria-label="Filter status registrasi"/);
  assert.match(pageSource, /className="flex flex-wrap gap-2"/);
  assert.doesNotMatch(
    pageSource.match(/aria-label="Filter status registrasi"[\s\S]*?<\/nav>/)?.[0] ?? "",
    /overflow-x-auto/,
  );
});

