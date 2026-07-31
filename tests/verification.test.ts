import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  campusEmailCodeSchema,
  campusEmailSchema,
  normalizeNim,
  verificationSubmissionSchema,
} from "../lib/verification/validation.ts";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202607310001_create_student_verification_center.sql",
    import.meta.url,
  ),
  "utf8",
);
const refinementMigration = readFileSync(
  new URL(
    "../supabase/migrations/202607310002_refine_academic_verification.sql",
    import.meta.url,
  ),
  "utf8",
);
const service = readFileSync(
  new URL("../lib/verification/service.ts", import.meta.url),
  "utf8",
);
const review = readFileSync(
  new URL("../lib/verification/review.ts", import.meta.url),
  "utf8",
);
const routes = [
  "../app/api/verification/submit/route.ts",
  "../app/api/verification/campus-email/send/route.ts",
  "../app/api/verification/campus-email/confirm/route.ts",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));

const validSubmission = {
  nim: "12.34-5678",
  legalName: "Nadia Putri",
  campus: "Universitas Contoh",
  studyProgram: "Sistem Informasi",
  degreeLevel: "sarjana",
  semester: "6",
  method: "campus_email",
  consent: "true",
};

test("submission validation normalizes acceptable academic data", () => {
  const result = verificationSubmissionSchema.parse(validSubmission);
  assert.equal(normalizeNim(result.nim), "12345678");
  assert.equal(result.legalName, "Nadia Putri");
  assert.equal(result.semester, 6);
});

test("invalid NIM, unknown enums, extra fields, and missing consent fail", () => {
  for (const payload of [
    { ...validSubmission, nim: "A" },
    { ...validSubmission, nim: "1---2" },
    { ...validSubmission, nim: "1234<script>" },
    { ...validSubmission, degreeLevel: "undergraduate" },
    { ...validSubmission, method: "selfie" },
    { ...validSubmission, consent: undefined },
    { ...validSubmission, verificationStatus: "verified" },
  ]) {
    assert.equal(verificationSubmissionSchema.safeParse(payload).success, false);
  }
});

test("oversized strings are rejected", () => {
  assert.equal(
    verificationSubmissionSchema.safeParse({
      ...validSubmission,
      legalName: "A".repeat(161),
    }).success,
    false,
  );
});

test("campus email is normalized and code is exactly six digits", () => {
  assert.equal(
    campusEmailSchema.parse({
      requestId: "2d11dd60-39a6-4bdc-ad9a-96f018a25d43",
      email: "STUDENT@CAMPUS.AC.ID",
    }).email,
    "student@campus.ac.id",
  );
  assert.equal(
    campusEmailCodeSchema.safeParse({
      requestId: "2d11dd60-39a6-4bdc-ad9a-96f018a25d43",
      code: "123456",
    }).success,
    true,
  );
  for (const code of ["12345", "1234567", "abcdef"]) {
    assert.equal(
      campusEmailCodeSchema.safeParse({
        requestId: "2d11dd60-39a6-4bdc-ad9a-96f018a25d43",
        code,
      }).success,
      false,
    );
  }
});

test("migration creates verification tables, indexes, constraints, and RLS", () => {
  for (const table of [
    "student_verification_requests",
    "campus_email_domains",
    "campus_email_verifications",
    "verification_events",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all on table public\\.${table} from public, anon, authenticated`,
      ),
    );
  }
  assert.match(migration, /student_verification_active_nim_idx/);
  assert.match(migration, /verification_events_request_created_idx/);
});

test("sensitive identity is encrypted and duplicate detection is keyed", () => {
  assert.match(migration, /nim_ciphertext bytea not null/);
  assert.match(migration, /legal_name_ciphertext bytea not null/);
  assert.match(migration, /nim_fingerprint text not null/);
  assert.doesNotMatch(migration, /\bnim text\b/);
  assert.doesNotMatch(migration, /\blegal_name text\b/);
  assert.match(service, /fingerprintNim/);
  assert.match(service, /encryptVerificationValue/);
});

test("owner select is sanitized and cross-user access is denied by RLS", () => {
  const grant = migration.match(
    /grant select \(([\s\S]*?)\) on table public\.student_verification_requests to authenticated;/,
  );
  assert.ok(grant);
  for (const sensitive of [
    "nim_ciphertext",
    "nim_fingerprint",
    "legal_name_ciphertext",
    "evidence_path",
  ]) {
    assert.doesNotMatch(grant[1], new RegExp(sensitive));
  }
  assert.match(
    migration,
    /using \(\(select auth\.uid\(\)\) = user_id\)/,
  );
  assert.doesNotMatch(
    migration,
    /grant (insert|update|delete)[\s\S]{0,100}student_verification_requests to authenticated/,
  );
});

test("a user can only cancel an owned pending request", () => {
  const cancelRpc = migration.slice(
    migration.indexOf("public.cancel_student_verification_request"),
    migration.indexOf("public.create_student_verification_request"),
  );
  assert.match(cancelRpc, /current_user_id uuid := auth\.uid\(\)/);
  assert.match(cancelRpc, /user_id = current_user_id/);
  assert.match(cancelRpc, /status in \('pending', 'needs_action'\)/);
  assert.doesNotMatch(cancelRpc, /status = 'verified'/);
});

test("server-only RPCs reject client-selected verification updates", () => {
  for (const name of [
    "create_student_verification_request",
    "confirm_student_campus_email_code",
    "finalize_student_verification_review",
  ]) {
    const start = migration.indexOf(`public.${name}`);
    assert.notEqual(start, -1);
    const section = migration.slice(start);
    assert.match(section, /security definer/);
    assert.match(section, /set search_path = ''/);
    assert.match(section, /auth\.role\(\) <> 'service_role'/);
    assert.match(section, /from public, anon, authenticated/);
    assert.match(section, /to service_role/);
  }
});

test("verified status requires academic match and ownership proof", () => {
  assert.match(migration, /student_verification_verified_requirements/);
  assert.match(
    migration,
    /p_request_status = 'verified'[\s\S]*p_pddikti_match_status = 'matched'[\s\S]*p_ownership_status in \('campus_email_verified', 'document_verified'\)/,
  );
});

test("academic-only and ownership-only approval paths are impossible", () => {
  const reviewRpc = migration.slice(
    migration.indexOf("public.finalize_student_verification_review"),
  );
  assert.match(reviewRpc, /raise exception 'combined verification required'/);
  assert.doesNotMatch(
    reviewRpc,
    /p_request_status = 'verified'\s+or/,
  );
});

test("campus email challenge enforces expiry, attempts, cooldown, and hashes", () => {
  assert.match(migration, /expires_at <= now\(\)/);
  assert.match(migration, /challenge\.attempts >= p_max_attempts/);
  assert.match(migration, /attempts = least\(attempts \+ 1, p_max_attempts\)/);
  assert.match(service, /CODE_RESEND_SECONDS/);
  assert.match(service, /hashCampusEmailCode/);
  assert.doesNotMatch(migration, /\bcode text\b/);
});

test("campus domains require explicit approval rather than any ac.id suffix", () => {
  assert.match(migration, /campus_email_domains/);
  assert.match(service, /\.eq\("status", "approved"\)/);
  assert.doesNotMatch(service, /endsWith\(["']\.ac\.id/);
});

test("student-card evidence is private, limited, and scheduled for deletion", () => {
  assert.match(migration, /'student-verification-evidence'/);
  assert.match(migration, /\sfalse,\s+5242880,/);
  assert.match(migration, /image\/jpeg/);
  assert.match(migration, /storage\.foldername\(name\)/);
  assert.match(migration, /evidence_deletion_at/);
  assert.match(review, /createSignedUrl\(request\.evidence_path, 300\)/);
  assert.match(review, /deleteExpiredVerificationEvidence/);
  assert.match(review, /app_metadata\?\.verification_reviewer !== true/);
  assert.doesNotMatch(service, /\/public/);
});

test("PDDikti screenshot has a separate private lifecycle", () => {
  assert.match(refinementMigration, /pddikti_evidence_path text null/);
  assert.match(
    refinementMigration,
    /pddikti_evidence_deletion_at timestamptz null/,
  );
  assert.match(
    refinementMigration,
    /create_student_verification_request_v2/,
  );
  assert.match(
    refinementMigration,
    /if p_pddikti_evidence_path is null then/,
  );
  assert.match(service, /p_pddikti_evidence_path: pddiktiEvidencePath/);
  assert.match(review, /createPddiktiEvidenceReviewUrl/);
  assert.match(review, /pddikti_evidence_deleted_at/);
});

test("audit events are append-only and contain controlled sanitized types", () => {
  assert.match(migration, /verification_event_type_allowed/);
  assert.match(
    migration,
    /revoke all on table public\.verification_events from public, anon, authenticated/,
  );
  assert.doesNotMatch(migration, /verification_events[\s\S]{0,80}(nim|legal_name|evidence_path)/);
});

test("all routes authenticate, cap payloads, and return generic errors", () => {
  for (const route of routes) {
    assert.match(route, /supabase\.auth\.getUser\(\)/);
    assert.match(route, /content-length/);
    assert.doesNotMatch(route, /console\.(log|error|warn)/);
  }
});

test("verification APIs enforce the server readiness gate", () => {
  for (const route of routes) {
    assert.match(route, /isVerificationRequestAllowed/);
    assert.match(route, /status: 503/);
  }
});

test("verification code, email, NIM, legal name, URLs, and tokens are never logged", () => {
  for (const source of [service, review, ...routes]) {
    assert.doesNotMatch(source, /console\.(log|error|warn|info)/);
  }
});
