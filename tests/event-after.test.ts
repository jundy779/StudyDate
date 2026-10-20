import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  CERTIFICATE_CODE_PATTERN,
  eventCertificateClaimSchema,
  eventFeedbackSchema,
  eventRecapSchema,
  isValidCertificateName,
  normalizeCertificateCode,
  ratingDistributionPercent,
} from "../lib/events/after-rules.ts";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/202610210004_event_after_v1.sql");
const fn = (name: string) =>
  migration.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`))?.[0] ?? "";
const slug = "event-0123456789abcdef01234567";

test("nama sertifikat: huruf dan tanda baca nama saja", () => {
  for (const name of ["Budi Santoso", "Siti Nur'aini", "R. A. Kartini", "Ni Luh Putu Ayu", "Jean-Luc"]) {
    assert.equal(isValidCertificateName(name), true, name);
  }
  for (const name of ["B", "Budi123", "Budi <b>", "Budi  Santoso", "@budi", "x".repeat(81)]) {
    assert.equal(isValidCertificateName(name), false, name);
  }
  const parsed = eventCertificateClaimSchema.safeParse({
    publicSlug: slug,
    recipientName: "  Budi   Santoso ",
    confirmsPublicName: true,
  });
  assert.equal(parsed.success && parsed.data.recipientName, "Budi Santoso");
  assert.equal(
    eventCertificateClaimSchema.safeParse({ publicSlug: slug, recipientName: "Budi", confirmsPublicName: false })
      .success,
    false,
  );
});

test("kode sertifikat: 12 karakter tanpa huruf atau angka yang mirip", () => {
  assert.match("5KXV-V9X7-Z7FX", CERTIFICATE_CODE_PATTERN);
  assert.equal(normalizeCertificateCode(" 5kxv-v9x7-z7fx "), "5KXV-V9X7-Z7FX");
  for (const bad of ["5KXV-V9X7-Z7F0", "OKXV-V9X7-Z7FX", "IKXV-V9X7-Z7FX", "5KXVV9X7Z7FX"]) {
    assert.doesNotMatch(bad, CERTIFICATE_CODE_PATTERN, bad);
  }
  assert.match(migration, /'23456789ABCDEFGHJKMNPQRSTUVWXYZ'/);
});

test("ulasan dan rekap divalidasi sama dengan database", () => {
  assert.equal(
    eventFeedbackSchema.safeParse({ publicSlug: slug, rating: "5", comment: "", wouldAttendAgain: "yes" }).success,
    true,
  );
  for (const rating of ["0", "6", "x"]) {
    assert.equal(
      eventFeedbackSchema.safeParse({ publicSlug: slug, rating, comment: "", wouldAttendAgain: "" }).success,
      false,
    );
  }
  assert.equal(
    eventFeedbackSchema.safeParse({ publicSlug: slug, rating: "4", comment: "<b>hi</b>", wouldAttendAgain: "" }).success,
    false,
  );
  assert.equal(eventRecapSchema.safeParse({ publicSlug: slug, body: "pendek" }).success, false);
  assert.equal(eventRecapSchema.safeParse({ publicSlug: slug, body: "" }).success, true);
  assert.match(fn("submit_campus_event_feedback"), /interval '14 days'/);
  assert.match(migration, /char_length\(body\) between 20 and 3000/);
});

test("ulasan hanya dari peserta terdaftar, bukan penyelenggara, setelah acara selesai", () => {
  const submit = fn("submit_campus_event_feedback");
  assert.match(submit, /event_row\.organizer_user_id = actor/);
  assert.match(submit, /campus_event_has_ended/);
  assert.match(submit, /rsvp\.status = 'going'/);
  assert.match(submit, /'feedback_hour', 20, 3600/);
});

test("penyelenggara melihat angka gabungan; komentar tanpa identitas dan baru setelah 3 ulasan", () => {
  const comments = fn("list_campus_event_feedback_comments");
  assert.match(comments, /< 3 then\s+return;/);
  assert.match(comments, /select f\.rating, f\.comment, f\.would_attend_again/);
  assert.doesNotMatch(comments, /user_id|public_alias|created_at/);
  assert.match(comments, /order by md5\(f\.id::text\)/);
  assert.match(fn("get_campus_event_after_summary"), /can_manage_campus_event_content/);
});

test("penyelenggara tidak pernah melihat nama di sertifikat", () => {
  const recipients = fn("list_campus_event_certificate_recipients");
  assert.doesNotMatch(recipients, /recipient_name/);
  const organizerPage = read("app/app/events/[publicSlug]/manage/after/page.tsx");
  assert.doesNotMatch(organizerPage, /recipient_name|recipientName/);
  assert.match(fn("revoke_campus_event_certificate"), /rsvp\.public_id = p_registration_public_id/);
});

test("syarat klaim sertifikat dicek di database", () => {
  const blocker = fn("campus_event_certificate_blocker");
  for (const reason of [
    "disabled", "not_ended", "window_closed", "organizer", "not_registered",
    "revoked_by_organizer", "not_checked_in", "feedback_required",
  ]) {
    assert.match(blocker, new RegExp(`'${reason}'`), reason);
  }
  const claim = fn("claim_campus_event_certificate");
  assert.match(claim, /campus_event_certificate_blocker\(event_row\.id, actor\)/);
  assert.match(claim, /campus_event_certificate_name_valid\(clean_name\)/);
  assert.match(claim, /'certificate_day', 10, 86400/);
});

test("cek publik tidak membocorkan sertifikat yang dicabut atau akun yang dihapus", () => {
  const verify = fn("verify_campus_event_certificate");
  assert.match(verify, /is_account_deletion_locked\(cert\.user_id\)/);
  assert.match(verify, /'revoked'::text, null::text/);
  assert.match(verify, /return query select 'valid'::text, cert\.recipient_name, cert\.event_title,/);
  assert.doesNotMatch(verify, /cert\.user_id,|cert\.event_id|cert\.verify_code,/);
  assert.match(migration, /grant execute on function public\.verify_campus_event_certificate\(text\) to anon/);
  const page = read("app/(public-docs)/certificates/[code]/page.tsx");
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(read("app/robots.ts"), /"\/certificates\/"/);
  const image = read("app/(public-docs)/certificates/[code]/image/route.tsx");
  assert.match(image, /"Cache-Control", "no-store"/);
});

test("tabel baru privat dan terkunci saat akun dihapus", () => {
  for (const table of [
    "campus_event_feedback", "campus_event_recaps",
    "campus_event_certificate_settings", "campus_event_certificates",
  ]) {
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`), table);
  }
  for (const table of ["campus_event_feedback", "campus_event_recaps", "campus_event_certificates"]) {
    assert.match(migration, new RegExp(`${table}_reject_deletion_locked_mutation`), table);
  }
});

test("notifikasi baru terdaftar di database dan aplikasi", () => {
  const constants = read("lib/notifications/constants.ts");
  for (const type of ["EVENT_FEEDBACK_REQUEST", "EVENT_RECAP_PUBLISHED"]) {
    assert.equal((migration.match(new RegExp(`'${type}'`, "g")) ?? []).length >= 4, true, type);
    assert.match(constants, new RegExp(`"${type}"`));
    assert.match(constants, new RegExp(`${type}: "`));
  }
  const tick =
    migration.match(/create or replace function public\.product_scheduler_tick\(\)[\s\S]*?\$function\$;/)?.[0] ?? "";
  assert.match(tick, /EVENT_FEEDBACK_REQUEST/);
  assert.match(tick, /interval '48 hours'/);
  assert.match(tick, /sent\.dedupe_key = 'event_feedback_request:'/);
  assert.match(tick, /EVENT_REMINDER_24H/);
  assert.match(tick, /purge_expired_meeting_plan_details/);
});

test("persentase sebaran nilai", () => {
  assert.deepEqual(ratingDistributionPercent([0, 0, 1, 0, 3]), [0, 0, 25, 0, 75]);
  assert.deepEqual(ratingDistributionPercent([0, 0, 0, 0, 0]), [0, 0, 0, 0, 0]);
});
