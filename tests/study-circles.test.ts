import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { CircleBehaviorModel } from "../lib/circles/behavior-model.ts";
import {
  circleFormSchema,
  circleMessageSchema,
} from "../lib/circles/validation.ts";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/202608090001_create_study_circles_v1.sql"),
  "utf8",
);
const ambiguityFixMigration = readFileSync(
  join(
    root,
    "supabase/migrations/202608090002_fix_study_circle_rpc_ambiguity.sql",
  ),
  "utf8",
);
const service = readFileSync(join(root, "lib/circles/service.ts"), "utf8");
const detailPage = readFileSync(
  join(root, "app/app/circles/[publicSlug]/page.tsx"),
  "utf8",
);
const navigation = readFileSync(
  join(root, "components/navigation/responsive-navigation.tsx"),
  "utf8",
);
const packageJson = readFileSync(join(root, "package.json"), "utf8");

const A = "student-a";
const B = "student-b";
const C = "student-c";
const STAFF = "staff";

function seed() {
  const model = new CircleBehaviorModel();
  model.addUser({ id: A, alias: "Partner #100001", campus: "Kampus A" });
  model.addUser({ id: B, alias: "Partner #100002", campus: "Kampus A" });
  model.addUser({ id: C, alias: "Partner #100003", campus: "Kampus B" });
  model.addUser({
    id: STAFF,
    alias: "Partner #100004",
    campus: "Kampus A",
    activeStaff: true,
  });
  return model;
}

test("SC-01 anon cannot access Circle member APIs", () => {
  assert.match(
    migration,
    /revoke all on table public\.study_circle_memberships from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.list_study_circle_members\(text\)\s+from public, anon/i,
  );
});

test("SC-02–SC-03 actor cannot create as B and owner is server-derived", () => {
  const model = seed();
  assert.throws(
    () =>
      model.create(A, {
        ownerId: B,
        name: "Circle Aman",
        scope: "open",
      }),
    /derived/,
  );
  const slug = model.create(A, { name: "Circle Aman", scope: "open" });
  assert.equal(model.get(slug).ownerId, A);
  assert.match(migration, /actor uuid := auth\.uid\(\)/);
  assert.doesNotMatch(migration, /p_owner_user_id/i);
});

test("SC-04–SC-06 eligible join, duplicate idempotency, and self-only leave", () => {
  const model = seed();
  const slug = model.create(A, { name: "Circle Aman", scope: "open" });
  assert.equal(model.join(B, slug), true);
  assert.equal(model.join(B, slug), false);
  assert.equal(model.leave(B, slug), true);
  assert.equal(model.listMembers(A, slug).length, 1);
  assert.equal(model.leave(A, slug), false);
});

test("SC-07–SC-09 owner-only mutation and no platform moderator escalation", () => {
  const model = seed();
  const slug = model.create(A, { name: "Circle Aman", scope: "open" });
  model.join(B, slug);
  assert.throws(() => model.remove(B, slug, A), /owner/);
  model.remove(A, slug, B);
  assert.throws(() => model.join(B, slug), /removed/);
  assert.doesNotMatch(migration, /circle_role[^;]*(admin|staff|moderator)/i);
  assert.match(migration, /role in \('owner', 'member'\)/);
});

test("SC-10 block prevents Circle Introduction bypass", () => {
  const model = seed();
  const slug = model.create(A, { name: "Circle Aman", scope: "open" });
  model.join(B, slug);
  model.block(A, B);
  assert.equal(model.canIntroduce(B, A), false);
  assert.equal(model.canIntroduce(A, B), false);
  assert.match(detailPage, /getIntroductionSendEligibility/);
});

test("SC-11–SC-17 member projection is allowlisted and contains no private fields", () => {
  const model = seed();
  const slug = model.create(A, { name: "Circle Aman", scope: "open" });
  model.join(B, slug);
  const projection = model.listMembers(A, slug)[1];
  assert.deepEqual(Object.keys(projection).sort(), [
    "campus",
    "circle_role",
    "public_alias",
  ]);
  const memberProjection = migration.match(
    /create or replace function public\.list_study_circle_members[\s\S]*?returns table \(([\s\S]*?)\)\nlanguage/,
  )?.[0];
  const memberFunction = migration.match(
    /create or replace function public\.list_study_circle_members[\s\S]*?create or replace function public\.list_study_circle_messages/,
  )?.[0];
  assert.ok(memberProjection);
  assert.ok(memberFunction);
  assert.doesNotMatch(
    memberProjection,
    /\b(email|nim|first_name|last_name|phone|telegram|instagram|linkedin|user_id)\b/i,
  );
  assert.match(memberFunction, /profile\.public_alias/);
});

test("SC-18–SC-21 discussion is member-only, bounded, and plain text", () => {
  const model = seed();
  const slug = model.create(A, { name: "Circle Aman", scope: "open" });
  assert.throws(() => model.listMessages(B, slug), /membership/);
  assert.throws(() => model.post(B, slug, "Halo"), /membership/);
  model.join(B, slug);
  const messageId = model.post(B, slug, "Mari bahas latihan bab dua.");
  assert.equal(model.listMessages(A, slug)[0].message_public_id, messageId);
  assert.throws(() => model.post(B, slug, "x".repeat(801)), /invalid/);
  assert.equal(
    circleMessageSchema.safeParse({
      publicSlug: slug,
      body: "<b>Halo</b>",
      idempotencyKey: "a".repeat(16),
    }).success,
    false,
  );
});

test("SC-22 atomic message and report rate-limit contracts exist", () => {
  assert.match(migration, /study_circle_rate_limits_pkey primary key/);
  assert.match(migration, /on conflict \(actor_user_id, bucket, window_start\)/);
  assert.match(migration, /'message_minute', 20, 60/);
  assert.match(migration, /'message_day', 300, 86400/);
  assert.match(migration, /'report_hour', 3, 3600/);
  assert.match(migration, /'report_day', 10, 86400/);
});

test("SC-23 obvious contact sharing is rejected without claiming perfection", () => {
  const model = seed();
  const slug = model.create(A, { name: "Circle Aman", scope: "open" });
  model.join(B, slug);
  assert.throws(
    () => model.post(B, slug, "telegram: partner_b"),
    /contact disclosure/,
  );
  assert.throws(
    () => model.post(B, slug, "emailku test@example.com"),
    /contact disclosure/,
  );
  assert.match(detailPage, /best-effort|Gunakan Perkenalan|Contact Reveal/i);
});

test("SC-24–SC-25 Circle and message reports remain report-scoped", () => {
  const model = seed();
  const slug = model.create(A, { name: "Circle Aman", scope: "open" });
  model.join(B, slug);
  const messageId = model.post(B, slug, "Pesan yang dilaporkan");
  model.reportMessage(A, slug, messageId);
  assert.deepEqual(model.latestReportEvidence(), {
    circleSlug: slug,
    excerpt: "Pesan yang dilaporkan",
  });
  assert.match(migration, /left\(target_message\.body, 280\)/);
  assert.doesNotMatch(migration, /grant select[^;]*study_circle_messages/i);
});

test("SC-26–SC-30 membership creates no private or reveal relationship", () => {
  const model = seed();
  const slug = model.create(A, { name: "Circle Aman", scope: "open" });
  model.join(B, slug);
  assert.equal(model.privateConnectionCount(), 0);
  assert.equal(model.revealCount(), 0);
  assert.doesNotMatch(
    migration,
    /insert into public\.(conversation_shells|conversation_mutual_interests|conversation_identity_reveals|conversation_contact_reveals)/i,
  );
});

test("SC-31 member Introduction uses existing eligibility and action", () => {
  assert.match(detailPage, /SendIntroductionDialog/);
  assert.match(detailPage, /getIntroductionSendEligibility/);
  assert.doesNotMatch(service, /create.*conversation/i);
});

test("SC-32–SC-33 Circle owner gets no chat, identity, or contact projection", () => {
  const ownerFunctions = migration.match(
    /create or replace function public\.(update_study_circle|remove_study_circle_member|archive_study_circle)[\s\S]*?grant execute/g,
  );
  assert.ok(ownerFunctions?.length);
  assert.doesNotMatch(
    ownerFunctions.join("\n"),
    /anonymous_messages|identity_reveal|contact_reveal/i,
  );
});

test("SC-34 archived Circle rejects joins and new messages but preserves history", () => {
  const model = seed();
  const slug = model.create(A, { name: "Circle Aman", scope: "open" });
  model.join(B, slug);
  model.post(B, slug, "Riwayat tetap ada");
  model.archive(A, slug);
  assert.throws(() => model.join(C, slug), /archived/);
  assert.throws(() => model.post(B, slug, "Pesan baru"), /archived/);
  assert.equal(model.listMessages(B, slug)[0].body, "Riwayat tetap ada");
});

test("SC-35 validation, routes, navigation, and regression command are wired", () => {
  assert.equal(
    circleFormSchema.safeParse({
      name: "Belajar TypeScript",
      description: "Membahas konsep TypeScript bersama setiap pekan.",
      topic: "coding",
      scope: "open",
      memberLimit: 12,
    }).success,
    true,
  );
  assert.match(navigation, /href: "\/app\/circles"/);
  assert.match(packageJson, /"test:circles"/);
});

test("SC-36 deployed member, message, and report RPCs avoid circle_id ambiguity", () => {
  for (const functionName of [
    "list_study_circle_members",
    "list_study_circle_messages",
    "report_study_circle_member",
  ]) {
    assert.match(
      ambiguityFixMigration,
      new RegExp(`create or replace function public\\.${functionName}\\(`),
    );
  }
  assert.match(ambiguityFixMigration, /target_circle_id uuid/);
  assert.doesNotMatch(ambiguityFixMigration, /^\s+circle_id uuid;$/m);
  assert.match(ambiguityFixMigration, /set search_path = ''/);
  assert.match(
    ambiguityFixMigration,
    /revoke all on function public\.list_study_circle_members\(text\)\s+from public, anon/i,
  );
});
