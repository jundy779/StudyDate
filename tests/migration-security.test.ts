import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202607300002_create_auth_onboarding_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);

test("migration creates all private onboarding objects with RLS enabled", () => {
  for (const table of ["profiles", "privacy_preferences", "user_consents"]) {
    assert.match(
      migration,
      new RegExp(`create table if not exists public\\.${table}`),
    );
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all on table public\\.${table} from anon, authenticated`,
      ),
    );
  }
});

test("profile constraints protect aliases, verification, arrays, and lengths", () => {
  const requiredConstraints = [
    "profiles_public_alias_format",
    "profiles_first_name_length",
    "profiles_campus_length",
    "profiles_study_program_length",
    "profiles_semester_range",
    "profiles_city_region_length",
    "profiles_short_intro_length",
    "profiles_interests_count",
    "profiles_interests_allowed",
    "profiles_connection_goals_count",
    "profiles_connection_goals_allowed",
    "profiles_verification_status_allowed",
  ];

  for (const constraint of requiredConstraints) {
    assert.match(migration, new RegExp(`constraint ${constraint}`));
  }
  assert.match(migration, /public_alias text not null unique/);
  assert.match(migration, /user_id uuid primary key references auth\.users/);
});

test("consent records have controlled types, ordering, and no client update grant", () => {
  assert.match(migration, /user_consents_type_allowed/);
  assert.match(migration, /user_consents_revocation_order/);
  assert.match(migration, /user_consents_one_active_type_idx/);
  assert.doesNotMatch(
    migration,
    /grant update[^;]*on table public\.user_consents to authenticated;/,
  );
});

test("profile column grants exclude every protected field", () => {
  const profileGrant = migration.match(
    /grant update \(([\s\S]*?)\) on table public\.profiles to authenticated;/,
  );
  assert.ok(profileGrant);

  for (const protectedField of [
    "public_alias",
    "verification_status",
    "is_discoverable",
    "onboarding_completed_at",
    "created_at",
    "updated_at",
    "user_id",
  ]) {
    assert.doesNotMatch(profileGrant[1], new RegExp(protectedField));
  }
});

test("all private select policies scope rows to auth.uid()", () => {
  assert.match(
    migration,
    /create policy "Profiles are private to their owner"[\s\S]*?using \(\(select auth\.uid\(\)\) = user_id\)/,
  );
  assert.match(
    migration,
    /create policy "Privacy preferences are private to their owner"[\s\S]*?using \(\(select auth\.uid\(\)\) = user_id\)/,
  );
  assert.match(
    migration,
    /create policy "Consent records are private to their owner"[\s\S]*?using \(\(select auth\.uid\(\)\) = user_id\)/,
  );
  assert.doesNotMatch(migration, /for select[\s\S]{0,100}using \(true\)/);
});

test("atomic onboarding RPC has SECURITY DEFINER hardening", () => {
  const rpc = migration.slice(
    migration.indexOf(
      "create or replace function public.complete_student_onboarding",
    ),
  );

  assert.match(rpc, /security definer/);
  assert.match(rpc, /set search_path = ''/);
  assert.match(rpc, /current_user_id uuid := auth\.uid\(\)/);
  assert.match(rpc, /if current_user_id is null then/);
  assert.match(rpc, /revoke execute on function[\s\S]*from public, anon/);
  assert.match(rpc, /grant execute on function[\s\S]*to authenticated/);
  assert.doesNotMatch(rpc, /p_user_id/);

  for (const protectedParameter of [
    "p_verification_status",
    "p_is_discoverable",
    "p_onboarding_completed_at",
    "p_created_at",
    "p_updated_at",
  ]) {
    assert.doesNotMatch(rpc, new RegExp(protectedParameter));
  }
  assert.match(rpc, /'unverified',\s+false,\s+now\(\)/);
});
