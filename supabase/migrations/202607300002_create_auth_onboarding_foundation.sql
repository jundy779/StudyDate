create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_alias text not null unique,
  first_name text not null,
  campus text not null,
  study_program text not null,
  semester smallint null,
  city_region text null,
  short_intro text null,
  interests text[] not null default '{}',
  connection_goals text[] not null default '{}',
  verification_status text not null default 'unverified',
  is_discoverable boolean not null default false,
  onboarding_completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_public_alias_format
    check (public_alias ~ '^Partner #[0-9]{6}$'),
  constraint profiles_first_name_length
    check (char_length(btrim(first_name)) between 1 and 80),
  constraint profiles_campus_length
    check (char_length(btrim(campus)) between 2 and 120),
  constraint profiles_study_program_length
    check (char_length(btrim(study_program)) between 2 and 120),
  constraint profiles_semester_range
    check (semester is null or semester between 1 and 16),
  constraint profiles_city_region_length
    check (city_region is null or char_length(btrim(city_region)) between 1 and 120),
  constraint profiles_short_intro_length
    check (short_intro is null or char_length(btrim(short_intro)) between 1 and 300),
  constraint profiles_interests_count
    check (cardinality(interests) between 1 and 6),
  constraint profiles_interests_allowed
    check (
      interests <@ array[
        'technology', 'design', 'business', 'languages', 'books', 'film',
        'music', 'sports', 'organizations', 'career', 'research', 'volunteering'
      ]::text[]
    ),
  constraint profiles_connection_goals_count
    check (cardinality(connection_goals) between 1 and 6),
  constraint profiles_connection_goals_allowed
    check (
      connection_goals <@ array[
        'study', 'friendship', 'networking', 'collaboration',
        'campus_activities', 'meaningful_connection'
      ]::text[]
    ),
  constraint profiles_verification_status_allowed
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected'))
);

create table if not exists public.privacy_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  online_first boolean not null default true,
  group_first boolean not null default false,
  verified_users_only boolean not null default false,
  same_campus_preferred boolean not null default false,
  cross_campus_allowed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,
  policy_version text not null,
  consented_at timestamptz not null default now(),
  revoked_at timestamptz null,
  constraint user_consents_type_allowed
    check (consent_type in ('terms', 'privacy', 'community_guidelines')),
  constraint user_consents_policy_version_length
    check (char_length(btrim(policy_version)) between 1 and 40),
  constraint user_consents_revocation_order
    check (revoked_at is null or revoked_at >= consented_at)
);

create index if not exists user_consents_user_id_idx
  on public.user_consents (user_id);

create unique index if not exists user_consents_one_active_type_idx
  on public.user_consents (user_id, consent_type)
  where revoked_at is null;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists privacy_preferences_set_updated_at
  on public.privacy_preferences;
create trigger privacy_preferences_set_updated_at
before update on public.privacy_preferences
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.privacy_preferences enable row level security;
alter table public.user_consents enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.privacy_preferences from anon, authenticated;
revoke all on table public.user_consents from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (
  first_name,
  campus,
  study_program,
  semester,
  city_region,
  short_intro,
  interests,
  connection_goals
) on table public.profiles to authenticated;

grant select on table public.privacy_preferences to authenticated;
grant update (
  online_first,
  group_first,
  verified_users_only,
  same_campus_preferred,
  cross_campus_allowed
) on table public.privacy_preferences to authenticated;

grant select on table public.user_consents to authenticated;

drop policy if exists "Profiles are private to their owner" on public.profiles;
create policy "Profiles are private to their owner"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Profiles can only be inserted for their owner"
  on public.profiles;
create policy "Profiles can only be inserted for their owner"
on public.profiles
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and verification_status = 'unverified'
  and is_discoverable = false
);

drop policy if exists "Owners can update editable profile data"
  on public.profiles;
create policy "Owners can update editable profile data"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Privacy preferences are private to their owner"
  on public.privacy_preferences;
create policy "Privacy preferences are private to their owner"
on public.privacy_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Privacy preferences can only be inserted for their owner"
  on public.privacy_preferences;
create policy "Privacy preferences can only be inserted for their owner"
on public.privacy_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can update their privacy preferences"
  on public.privacy_preferences;
create policy "Owners can update their privacy preferences"
on public.privacy_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Consent records are private to their owner"
  on public.user_consents;
create policy "Consent records are private to their owner"
on public.user_consents
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Consent records can only be inserted for their owner"
  on public.user_consents;
create policy "Consent records can only be inserted for their owner"
on public.user_consents
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create or replace function public.complete_student_onboarding(
  p_public_alias text,
  p_first_name text,
  p_campus text,
  p_study_program text,
  p_semester smallint,
  p_city_region text,
  p_short_intro text,
  p_interests text[],
  p_connection_goals text[],
  p_online_first boolean,
  p_group_first boolean,
  p_verified_users_only boolean,
  p_same_campus_preferred boolean,
  p_cross_campus_allowed boolean,
  p_policy_version text,
  p_terms_accepted boolean,
  p_privacy_accepted boolean,
  p_community_guidelines_accepted boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_interests text[];
  normalized_connection_goals text[];
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not (
    p_terms_accepted
    and p_privacy_accepted
    and p_community_guidelines_accepted
  ) then
    raise exception 'all consents are required' using errcode = '22023';
  end if;

  select array_agg(distinct value order by value)
  into normalized_interests
  from unnest(p_interests) as interest(value);

  select array_agg(distinct value order by value)
  into normalized_connection_goals
  from unnest(p_connection_goals) as goal(value);

  insert into public.profiles (
    user_id,
    public_alias,
    first_name,
    campus,
    study_program,
    semester,
    city_region,
    short_intro,
    interests,
    connection_goals,
    verification_status,
    is_discoverable,
    onboarding_completed_at
  )
  values (
    current_user_id,
    p_public_alias,
    btrim(p_first_name),
    btrim(p_campus),
    btrim(p_study_program),
    p_semester,
    nullif(btrim(p_city_region), ''),
    nullif(btrim(p_short_intro), ''),
    normalized_interests,
    normalized_connection_goals,
    'unverified',
    false,
    now()
  )
  on conflict (user_id) do update set
    first_name = excluded.first_name,
    campus = excluded.campus,
    study_program = excluded.study_program,
    semester = excluded.semester,
    city_region = excluded.city_region,
    short_intro = excluded.short_intro,
    interests = excluded.interests,
    connection_goals = excluded.connection_goals,
    is_discoverable = false,
    onboarding_completed_at = now();

  insert into public.privacy_preferences (
    user_id,
    online_first,
    group_first,
    verified_users_only,
    same_campus_preferred,
    cross_campus_allowed
  )
  values (
    current_user_id,
    p_online_first,
    p_group_first,
    p_verified_users_only,
    p_same_campus_preferred,
    p_cross_campus_allowed
  )
  on conflict (user_id) do update set
    online_first = excluded.online_first,
    group_first = excluded.group_first,
    verified_users_only = excluded.verified_users_only,
    same_campus_preferred = excluded.same_campus_preferred,
    cross_campus_allowed = excluded.cross_campus_allowed;

  insert into public.user_consents (
    user_id,
    consent_type,
    policy_version
  )
  values
    (current_user_id, 'terms', btrim(p_policy_version)),
    (current_user_id, 'privacy', btrim(p_policy_version)),
    (current_user_id, 'community_guidelines', btrim(p_policy_version))
  on conflict do nothing;
end;
$$;

revoke execute on function public.complete_student_onboarding(
  text,
  text,
  text,
  text,
  smallint,
  text,
  text,
  text[],
  text[],
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  text,
  boolean,
  boolean,
  boolean
) from public, anon;

grant execute on function public.complete_student_onboarding(
  text,
  text,
  text,
  text,
  smallint,
  text,
  text,
  text[],
  text[],
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  text,
  boolean,
  boolean,
  boolean
) to authenticated;
