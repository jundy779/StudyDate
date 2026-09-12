import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read(
  "../supabase/migrations/202608110003_extend_student_verification_pddikti_lookup_v1.sql",
);
const lookupRoute = read("../app/api/verification/academic-lookup/route.ts");
const submitRoute = read("../app/api/verification/submit/route.ts");
const lookupService = read("../lib/verification/lookup-service.ts");
const lookupCore = read("../lib/verification/lookup-core.ts");
const verificationService = read("../lib/verification/service.ts");
const emailSender = read("../lib/verification/email-sender.ts");
const studentStatus = read("../lib/verification/status.ts");
const provider = read("../lib/verification/pddikti-provider.ts");
const evidence = read("../lib/verification/evidence-core.ts");
const studentUi = read("../components/verification/verification-form.tsx");
const reviewerUi = read("../app/admin/verifications/[requestId]/page.tsx");
const evidenceRoute = read(
  "../app/api/staff/verifications/[requestId]/evidence/route.ts",
);
const deletion = read(
  "../supabase/migrations/202608100002_finalize_account_deletion_lifecycle.sql",
);
const privacySurfaces = [
  "../supabase/migrations/202607310004_create_people_discovery.sql",
  "../supabase/migrations/202608060003_create_anonymous_chat_v1.sql",
  "../supabase/migrations/202608070013_create_notifications_v1.sql",
  "../supabase/migrations/202608090001_create_study_circles_v1.sql",
  "../supabase/migrations/202608090003_create_campus_events_v1.sql",
  "../supabase/migrations/202608110001_create_telegram_anonymous_chat_companion_v1.sql",
].map(read);

test("student endpoint is authenticated, bounded, self-scoped, and rate limited", () => {
  assert.match(lookupRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(lookupRoute, /MAX_BYTES = 2_048/);
  assert.match(lookupRoute, /verification_lookup_hour[\s\S]*limit: 3/);
  assert.match(lookupRoute, /verification_lookup_day[\s\S]*limit: 6/);
  assert.doesNotMatch(lookupRoute, /p_user_id|userId:\s*payload/);
  assert.match(lookupService, /is_eligible_verification_student/);
  assert.doesNotMatch(lookupService, /is_eligible_introduction_student/);
  assert.match(
    migration,
    /perform public\.lock_eligible_verification_student\(p_user_id\)/,
  );
  assert.match(lookupRoute, /academicLookupSchema\.safeParse\(payload\)/);
  assert.match(studentUi, /providerConsent/);
  assert.match(studentUi, /layanan data akademik eksternal/);
});

test("verification precheck is service-only and checks only current student eligibility", () => {
  const precheck = migration.slice(
    migration.indexOf("is_eligible_verification_student"),
    migration.indexOf("lock_eligible_verification_student"),
  );
  assert.match(precheck, /security invoker/);
  assert.match(precheck, /set search_path = ''/);
  assert.match(precheck, /auth\.role\(\) <> 'service_role'/);
  assert.match(precheck, /p_user_id is null[\s\S]*return false/);
  assert.match(precheck, /profile\.onboarding_completed_at is not null/);
  assert.match(precheck, /profile\.deactivated_at is null/);
  assert.match(precheck, /staff\.status = 'active'/);
  assert.match(precheck, /deletion\.status in \('pending', 'processing', 'failed'\)/);
  assert.doesNotMatch(precheck, /block|cooldown|conversation|discoverable|introduction/);
  assert.match(
    precheck,
    /revoke all on function public\.is_eligible_verification_student\(uuid\)[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    precheck,
    /grant execute on function public\.is_eligible_verification_student\(uuid\)[\s\S]*to service_role/,
  );
  assert.doesNotMatch(
    precheck,
    /grant execute on function public\.is_eligible_verification_student\(uuid\)[\s\S]*to (?:public|anon|authenticated)/,
  );
});

test("source ordering keeps consent, provider flag, and eligibility before provider lookup", () => {
  assert.match(lookupRoute, /academicLookupSchema\.safeParse\(payload\)/);
  assert.match(
    lookupRoute,
    /academicLookupSchema\.safeParse\(payload\)[\s\S]*lookupAcademicIdentity\([\s\S]*user\.id,[\s\S]*parsed\.data,[\s\S]*request\.signal/,
  );
  assert.match(
    lookupService,
    /is_eligible_verification_student[\s\S]*runAcademicLookupProvider/,
  );
  assert.match(
    lookupCore,
    /gate\.eligible[\s\S]*input\.providerConsent !== "true"[\s\S]*gate\.providerReady[\s\S]*provider\.lookup\(input, signal\)/,
  );
  assert.doesNotMatch(lookupRoute, /payload\.(?:userId|user_id)/);
});

test("global verification and provider flags remain disabled by default", () => {
  const env = read("../.env.example");
  assert.match(env, /STUDENT_VERIFICATION_ENABLED=false/);
  assert.match(env, /PDDIKTI_LOOKUP_PROVIDER_ENABLED=false/);
  assert.doesNotMatch(env, /PDDIKTI_PROVIDER_ACCESS_KEY=.+/);
  assert.doesNotMatch(env, /NEXT_PUBLIC_PDDIKTI/);
});

test("provider call is server-only, bounded, sanitized, and never returns raw candidates", () => {
  assert.match(provider, /AbortSignal\.timeout\(TIMEOUT_MS\)/);
  assert.match(provider, /MAX_ATTEMPTS = 1/);
  assert.match(provider, /MAX_RESPONSE_BYTES = 256_000/);
  assert.match(provider, /cache: "no-store"/);
  assert.doesNotMatch(provider, /console\./);
  assert.doesNotMatch(lookupRoute, /aksesKey|PDDIKTI_PROVIDER_ACCESS_KEY/);
  assert.doesNotMatch(lookupService, /candidates|payload|nama|nim:/);
});

test("academic match cannot directly verify and ownership proof remains mandatory", () => {
  const create = migration.slice(
    migration.indexOf("create_pddikti_academic_match_request"),
    migration.indexOf("complete_student_verification_ownership"),
  );
  assert.match(create, /method, status[\s\S]*'academic_pending', 'under_review'/);
  assert.match(create, /pddikti_match_status[\s\S]*'matched', 'not_checked'/);
  assert.doesNotMatch(create, /verification_status = 'verified'/);
  assert.match(migration, /final_status := case[\s\S]*pddikti_match_status = 'matched'/);
  assert.match(reviewerUi, /Setujui data akademik/);
  assert.match(reviewerUi, /Pemeriksaan data akademik manual/);
  assert.doesNotMatch(
    reviewerUi,
    /Manual academic review|Auto lookup match|Review claim akademik|Sedang direview/,
  );
  assert.doesNotMatch(reviewerUi, />Verify user</);
});

test("manual evidence approval cannot directly verify a user", () => {
  const review = migration.slice(
    migration.indexOf("approve_manual_academic_match"),
    migration.indexOf("list_staff_verification_requests"),
  );
  assert.match(review, /pddikti_match_status = case when p_approved then 'matched'/);
  assert.match(review, /when p_approved then 'under_review'/);
  assert.doesNotMatch(review, /verification_status = 'verified'/);
  assert.match(review, /target_user = actor/);
  assert.match(review, /is_current_active_staff/);
  assert.match(
    review,
    /perform public\.lock_eligible_verification_student\(target_user\)/,
  );
});

test("manual academic review can still continue campus-email ownership", () => {
  const service = read("../lib/verification/service.ts");
  assert.match(
    service,
    /\["pending", "under_review", "needs_action"\]\.includes\(request\.status\)/,
  );
});

test("staff queue function is dropped before its return projection changes", () => {
  assert.match(
    migration,
    /drop function public\.list_staff_verification_requests\(text, integer\);[\s\S]*create or replace function public\.list_staff_verification_requests/,
  );
});

test("duplicate NIM remains keyed, unique, and generic", () => {
  assert.match(migration, /academic identity unavailable/);
  assert.match(lookupService, /fingerprintNim/);
  assert.match(lookupService, /error\.code === "23505"/);
  assert.doesNotMatch(lookupRoute, /belongs to|akun X|account/);
});

test("NIM, legal name, fingerprints, and paths are never student-writable or projected", () => {
  assert.match(migration, /revoke select \(nim_last_four\)/);
  assert.match(migration, /revoke all on function public\.create_pddikti/);
  assert.match(migration, /from public, anon, authenticated/);
  for (const surface of privacySurfaces) {
    const projection = surface.toLowerCase();
    assert.doesNotMatch(projection, /returns table \([\s\S]{0,300}\bnim\b/);
    assert.doesNotMatch(projection, /returns table \([\s\S]{0,300}\blegal_name\b/);
  }
});

test("all trusted verification transitions serialize against the target privacy lock", () => {
  const helper = migration.slice(
    migration.indexOf("lock_eligible_verification_student"),
    migration.indexOf("create_pddikti_academic_match_request"),
  );
  assert.match(helper, /from public\.profiles as profile[\s\S]*for update/);
  assert.match(helper, /target_profile\.deactivated_at is not null/);
  assert.match(helper, /public\.is_account_deletion_locked\(p_user_id\)/);

  for (const functionName of [
    "create_pddikti_academic_match_request",
    "complete_student_verification_ownership",
    "prepare_student_campus_email_challenge",
    "authorize_student_campus_email_delivery",
    "confirm_student_campus_email_code",
    "create_manual_academic_review_request",
  ]) {
    const start = migration.indexOf(`public.${functionName}`);
    assert.notEqual(start, -1, functionName);
    const next = migration.indexOf("create or replace function public.", start + 1);
    const body = migration.slice(start, next === -1 ? undefined : next);
    assert.match(
      body,
      /perform public\.lock_eligible_verification_student\(p_user_id\)/,
      functionName,
    );
  }

  const finalize = migration.slice(
    migration.indexOf("finalize_staff_verification_review"),
    migration.indexOf("list_staff_verification_requests"),
  );
  assert.match(
    finalize,
    /perform public\.lock_eligible_verification_student\(target\.user_id\)/,
  );
});

test("mid-provider deletion or deactivation rejects persistence without changing ownership or badge", () => {
  assert.match(
    lookupService,
    /runAcademicLookupProvider\(input, provider[\s\S]*create_pddikti_academic_match_request/,
  );
  assert.match(lookupCore, /provider\.lookup\(input, signal\)/);
  const lock = migration.slice(
    migration.indexOf("lock_eligible_verification_student"),
    migration.indexOf("create_pddikti_academic_match_request"),
  );
  assert.match(lock, /from public\.profiles as profile[\s\S]*for update/);
  assert.match(lock, /target_profile\.deactivated_at is not null/);
  assert.match(lock, /public\.is_account_deletion_locked\(p_user_id\)/);

  const persistence = migration.slice(
    migration.indexOf("create_pddikti_academic_match_request"),
    migration.indexOf("complete_student_verification_ownership"),
  );
  assert.match(
    persistence,
    /perform public\.lock_eligible_verification_student\(p_user_id\)[\s\S]*insert into public\.student_verification_requests/,
  );
  assert.match(persistence, /ownership_status[\s\S]*'not_checked'/);
  assert.doesNotMatch(persistence, /verification_status = 'verified'/);
});

test("request identifiers remain target-scoped for ownership and evidence association", () => {
  const ownership = migration.slice(
    migration.indexOf("complete_student_verification_ownership"),
    migration.indexOf("prepare_student_campus_email_challenge"),
  );
  assert.match(ownership, /where id = p_request_id[\s\S]*and user_id = p_user_id/);

  const challenge = migration.slice(
    migration.indexOf("prepare_student_campus_email_challenge"),
    migration.indexOf("authorize_student_campus_email_delivery"),
  );
  assert.match(
    challenge,
    /request\.id = p_request_id[\s\S]*request\.user_id = p_user_id/,
  );

  const confirmation = migration.slice(
    migration.indexOf("confirm_student_campus_email_code"),
    migration.indexOf("create_manual_academic_review_request"),
  );
  assert.match(
    confirmation,
    /request_id = p_request_id and user_id = p_user_id/,
  );
});

test("campus email is reauthorized after challenge creation and before transport", () => {
  assert.match(
    verificationService,
    /prepare_student_campus_email_challenge/,
  );
  assert.match(
    verificationService,
    /await sender\.send[\s\S]*authorizeDelivery[\s\S]*authorize_student_campus_email_delivery/,
  );
  assert.match(
    emailSender,
    /await message\.authorizeDelivery\(\)[\s\S]*sendStudyDateEmail\(/,
  );
  assert.doesNotMatch(emailSender, /JSON\.stringify\(message\)/);
  assert.match(
    migration,
    /create trigger account_deletion_requests_invalidate_verification[\s\S]*before insert on public\.account_deletion_requests/,
  );
  assert.match(
    migration,
    /delete from public\.campus_email_verifications as challenge[\s\S]*challenge\.verified_at is null/,
  );
  assert.match(
    migration,
    /confirm_student_campus_email_code[\s\S]*perform public\.lock_eligible_verification_student\(p_user_id\)/,
  );
});

test("ordinary student projection excludes internal academic match source", () => {
  assert.doesNotMatch(studentStatus, /academic_match_source/);
  assert.doesNotMatch(
    migration,
    /grant select \(academic_match_source\)[\s\S]*to authenticated/,
  );
  assert.match(
    migration,
    /list_staff_verification_requests[\s\S]*academic_match_source text/,
  );
});

test("images are decoded, dimension-limited, re-encoded, and metadata-stripped", () => {
  assert.match(evidence, /failOn: "warning"/);
  assert.match(evidence, /limitInputPixels: MAX_PIXELS/);
  assert.match(evidence, /ACCEPTED_FORMATS/);
  assert.match(evidence, /\(metadata\.pages \?\? 1\) !== 1/);
  assert.match(evidence, /\.rotate\(\)/);
  assert.match(evidence, /\.jpeg\(/);
  assert.doesNotMatch(evidence, /withMetadata/);
  assert.match(submitRoute, /MAX_VERIFICATION_REQUEST_BYTES/);
});

test("evidence is private, random-named, reviewer-only, proxied, and cleanup-scoped", () => {
  const service = read("../lib/verification/service.ts");
  assert.match(service, /randomUUID\(\).*processed\.extension/);
  assert.match(service, /VERIFICATION_BUCKET/);
  assert.match(evidenceRoute, /verificationReviewer/);
  assert.match(evidenceRoute, /cache-control": "no-store, private"/);
  assert.match(evidenceRoute, /new NextResponse\(await upstream\.arrayBuffer\(\)/);
  assert.doesNotMatch(evidenceRoute, /NextResponse\.redirect\(url/);
  assert.match(deletion, /request\.pddikti_evidence_path/);
  assert.match(deletion, /delete from public\.student_verification_requests/);
});

test("student UI distinguishes lookup outcomes and manual supporting evidence", () => {
  for (const copy of [
    "Memeriksa data akademik...",
    "Data akademik ditemukan.",
    "Data mahasiswa belum berhasil ditemukan.",
    "Layanan pengecekan akademik sedang tidak tersedia.",
    "Data yang ditemukan belum cocok",
    "Lanjutkan pemeriksaan manual",
    "bukan bukti kepemilikan",
  ]) {
    assert.match(studentUi, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("provider secret and identity are absent from client-facing sources", () => {
  const clientSources = [studentUi, lookupRoute, reviewerUi];
  for (const source of clientSources) {
    assert.doesNotMatch(source, /aksesKey|provider access key|PDDIKTI_PROVIDER_ACCESS_KEY/);
    assert.doesNotMatch(source, /pddikti_evidence_path|nim_ciphertext|legal_name_ciphertext/);
  }
});
