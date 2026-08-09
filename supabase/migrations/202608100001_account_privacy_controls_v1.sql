-- Account & Privacy Controls v1 (LOCAL-ONLY).
-- Adds safe settings projections, own-block management, and a non-destructive
-- deletion-request gate. Final cleanup remains disabled until Owner retention
-- and shared-history policies are approved.

-- ---------------------------------------------------------------------------
-- 1. Pending deletion state
-- ---------------------------------------------------------------------------

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique null references auth.users (id) on delete set null,
  status text not null default 'pending',
  requested_at timestamptz not null default timezone('utc', now()),
  processing_at timestamptz null,
  completed_at timestamptz null,
  failed_at timestamptz null,
  retry_count integer not null default 0,
  failure_code text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint account_deletion_requests_status_allowed check (
    status in ('pending', 'processing', 'completed', 'failed')
  ),
  constraint account_deletion_requests_retry_count_nonnegative check (
    retry_count >= 0
  ),
  constraint account_deletion_requests_failure_code_length check (
    failure_code is null or char_length(failure_code) between 1 and 80
  )
);

comment on table public.account_deletion_requests is
  'Internal idempotent account deletion queue. Cleanup processing is intentionally not exposed to students.';
comment on column public.account_deletion_requests.failure_code is
  'Sanitized internal category only; never returned to a student.';

create trigger account_deletion_requests_set_updated_at
before update on public.account_deletion_requests
for each row execute function public.set_updated_at();

alter table public.account_deletion_requests enable row level security;
revoke all on table public.account_deletion_requests
  from public, anon, authenticated;

-- One shared eligibility guard closes direct RPC bypasses across Introductions,
-- Anonymous Chat, Mutual, Identity, Contact, Circles, and Events.
create or replace function public.is_eligible_introduction_student(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.user_id = p_user_id
      and profile.onboarding_completed_at is not null
      and profile.deactivated_at is null
      and not exists (
        select 1
        from public.staff_members staff
        where staff.user_id = p_user_id
          and staff.status = 'active'
      )
      and not exists (
        select 1
        from public.account_deletion_requests deletion
        where deletion.user_id = p_user_id
          and deletion.status in ('pending', 'processing', 'failed')
      )
  );
$$;

revoke all on function public.is_eligible_introduction_student(uuid)
  from public, anon, authenticated;

create or replace function public.get_my_account_deletion_status()
returns table (
  status text,
  requested_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
  select deletion.status, deletion.requested_at
  from public.account_deletion_requests deletion
  where deletion.user_id = actor
  limit 1;
end;
$$;

create or replace function public.request_my_student_account_deletion()
returns table (
  status text,
  requested_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if public.is_active_staff_user(actor) then
    raise exception 'student account required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.profiles profile
    where profile.user_id = actor
      and profile.onboarding_completed_at is not null
  ) then
    raise exception 'completed profile required' using errcode = '42501';
  end if;

  insert into public.account_deletion_requests (user_id, status)
  values (actor, 'pending')
  on conflict (user_id) do nothing;

  update public.profiles
  set
    is_discoverable = false,
    deactivated_at = coalesce(deactivated_at, timezone('utc', now())),
    updated_at = timezone('utc', now())
  where user_id = actor;

  return query
  select deletion.status, deletion.requested_at
  from public.account_deletion_requests deletion
  where deletion.user_id = actor
  limit 1;
end;
$$;

revoke all on function public.get_my_account_deletion_status()
  from public, anon, authenticated;
revoke all on function public.request_my_student_account_deletion()
  from public, anon, authenticated;
grant execute on function public.get_my_account_deletion_status()
  to authenticated;
grant execute on function public.request_my_student_account_deletion()
  to authenticated;

-- A deletion request cannot be undone through the temporary-deactivation flow.
create or replace function public.reactivate_my_student_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if public.is_active_staff_user(actor) then
    raise exception 'staff accounts cannot use student reactivation'
      using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.account_deletion_requests deletion
    where deletion.user_id = actor
      and deletion.status in ('pending', 'processing', 'failed')
  ) then
    raise exception 'account deletion already requested' using errcode = '42501';
  end if;

  update public.profiles
  set deactivated_at = null, updated_at = timezone('utc', now())
  where user_id = actor;

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.reactivate_my_student_account()
  from public, anon, authenticated;
grant execute on function public.reactivate_my_student_account()
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Settings-safe profile mutation
-- ---------------------------------------------------------------------------

-- Ordinary clients must use the narrow RPC instead of forging direct updates.
revoke update on table public.profiles from authenticated;
revoke all on function public.update_my_student_profile(
  text, text, text, text, text, smallint, text, text, text[], text[], text, boolean
) from public, anon, authenticated;

create or replace function public.update_my_student_profile_settings(
  p_campus text,
  p_study_program text,
  p_degree_level text,
  p_semester smallint,
  p_city_region text,
  p_short_intro text,
  p_interests text[],
  p_connection_goals text[],
  p_avatar_mascot text,
  p_is_discoverable boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_profile public.profiles%rowtype;
  cleaned_campus text := btrim(coalesce(p_campus, ''));
  cleaned_program text := btrim(coalesce(p_study_program, ''));
  canonical_campus text;
  canonical_program text;
  cleaned_city text := nullif(btrim(coalesce(p_city_region, '')), '');
  cleaned_intro text := nullif(btrim(coalesce(p_short_intro, '')), '');
  cleaned_mascot text := nullif(btrim(coalesce(p_avatar_mascot, '')), '');
  cleaned_interests text[];
  cleaned_goals text[];
  allowed_interests text[] := array[
    'technology', 'design', 'business', 'languages', 'books', 'film',
    'music', 'sports', 'organizations', 'career', 'research', 'volunteering'
  ];
  allowed_goals text[] := array[
    'study', 'friendship', 'networking', 'collaboration',
    'campus_activities', 'meaningful_connection'
  ];
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'active student required' using errcode = '42501';
  end if;

  select * into current_profile
  from public.profiles profile
  where profile.user_id = actor
  for update;

  select option.name into canonical_campus
  from public.campus_options option
  where option.status = 'approved'
    and option.search_key = public.normalize_campus_search(cleaned_campus)
  limit 1;
  if canonical_campus is not null then
    cleaned_campus := canonical_campus;
  elsif cleaned_campus <> current_profile.campus then
    cleaned_campus := null;
  end if;
  if cleaned_campus is null
    or char_length(cleaned_campus) < 2
    or char_length(cleaned_campus) > 120 then
    raise exception 'invalid campus' using errcode = '22023';
  end if;

  select option.name into canonical_program
  from public.study_program_options option
  where option.status = 'approved'
    and option.search_key = public.normalize_campus_search(cleaned_program)
  limit 1;
  if canonical_program is not null then
    cleaned_program := canonical_program;
  elsif cleaned_program <> current_profile.study_program then
    cleaned_program := null;
  end if;
  if cleaned_program is null
    or char_length(cleaned_program) < 2
    or char_length(cleaned_program) > 120 then
    raise exception 'invalid study program' using errcode = '22023';
  end if;

  if p_degree_level not in (
    'diploma', 'sarjana', 'magister', 'doktor', 'profesi', 'spesialis'
  ) then
    raise exception 'invalid degree level' using errcode = '22023';
  end if;
  if p_semester is not null and (p_semester < 1 or p_semester > 16) then
    raise exception 'invalid semester' using errcode = '22023';
  end if;
  if cleaned_city is not null and char_length(cleaned_city) > 120 then
    raise exception 'invalid city' using errcode = '22023';
  end if;
  if cleaned_intro is not null and char_length(cleaned_intro) > 300 then
    raise exception 'invalid intro' using errcode = '22023';
  end if;
  if cleaned_mascot is not null
    and cleaned_mascot not in ('front', 'hello', 'chat', 'study') then
    raise exception 'invalid avatar mascot' using errcode = '22023';
  end if;

  if p_interests is null or cardinality(p_interests) not between 1 and 6 then
    raise exception 'invalid interests' using errcode = '22023';
  end if;
  select array_agg(distinct interest order by interest)
  into cleaned_interests
  from unnest(p_interests) interest
  where interest = any (allowed_interests);
  if cleaned_interests is null
    or cardinality(cleaned_interests)
      <> cardinality(array(select distinct unnest(p_interests))) then
    raise exception 'invalid interests' using errcode = '22023';
  end if;

  if p_connection_goals is null
    or cardinality(p_connection_goals) not between 1 and 6 then
    raise exception 'invalid connection goals' using errcode = '22023';
  end if;
  select array_agg(distinct goal order by goal)
  into cleaned_goals
  from unnest(p_connection_goals) goal
  where goal = any (allowed_goals);
  if cleaned_goals is null
    or cardinality(cleaned_goals)
      <> cardinality(array(select distinct unnest(p_connection_goals))) then
    raise exception 'invalid connection goals' using errcode = '22023';
  end if;

  if p_is_discoverable is null then
    raise exception 'visibility is required' using errcode = '22023';
  end if;
  if p_is_discoverable and not exists (
    select 1
    from public.student_social_contacts contacts
    where contacts.user_id = actor
      and contacts.linkedin_url is not null
  ) then
    raise exception 'linkedin required for discovery' using errcode = '22023';
  end if;

  update public.profiles
  set
    campus = cleaned_campus,
    study_program = cleaned_program,
    degree_level = p_degree_level,
    semester = p_semester,
    city_region = cleaned_city,
    short_intro = cleaned_intro,
    interests = cleaned_interests,
    connection_goals = cleaned_goals,
    avatar_mascot = cleaned_mascot,
    is_discoverable = p_is_discoverable,
    updated_at = timezone('utc', now())
  where user_id = actor;
end;
$$;

revoke all on function public.update_my_student_profile_settings(
  text, text, text, smallint, text, text, text[], text[], text, boolean
) from public, anon, authenticated;
grant execute on function public.update_my_student_profile_settings(
  text, text, text, smallint, text, text, text[], text[], text, boolean
) to authenticated;

-- Keep the dedicated visibility control active-account-only.
create or replace function public.set_people_discovery_visibility(
  p_is_discoverable boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'active student required' using errcode = '42501';
  end if;
  if p_is_discoverable is null then
    raise exception 'visibility is required' using errcode = '22023';
  end if;
  if p_is_discoverable and not exists (
    select 1
    from public.student_social_contacts contacts
    where contacts.user_id = actor
      and contacts.linkedin_url is not null
  ) then
    raise exception 'linkedin required for discovery' using errcode = '22023';
  end if;

  update public.profiles
  set is_discoverable = p_is_discoverable,
      updated_at = timezone('utc', now())
  where user_id = actor;

  return p_is_discoverable;
end;
$$;

revoke all on function public.set_people_discovery_visibility(boolean)
  from public, anon, authenticated;
grant execute on function public.set_people_discovery_visibility(boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Privacy-safe own block management
-- ---------------------------------------------------------------------------

create or replace function public.list_my_blocked_students()
returns table (
  public_alias text,
  campus text,
  study_program text,
  semester smallint,
  avatar_mascot text,
  blocked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'active student required' using errcode = '42501';
  end if;

  return query
  select
    profile.public_alias,
    profile.campus,
    profile.study_program,
    profile.semester,
    profile.avatar_mascot,
    block.created_at
  from public.user_blocks block
  join public.profiles profile on profile.user_id = block.blocked_id
  where block.blocker_id = actor
  order by block.created_at desc, profile.public_alias;
end;
$$;

create or replace function public.unblock_my_blocked_student(
  p_public_alias text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target uuid;
  removed boolean;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'active student required' using errcode = '42501';
  end if;
  if p_public_alias is null or p_public_alias !~ '^Partner #[0-9]{6}$' then
    raise exception 'invalid alias' using errcode = '22023';
  end if;

  select profile.user_id into target
  from public.profiles profile
  where profile.public_alias = p_public_alias;

  if target is null then
    return false;
  end if;

  delete from public.user_blocks block
  where block.blocker_id = actor
    and block.blocked_id = target;
  removed := found;
  return removed;
end;
$$;

revoke all on function public.list_my_blocked_students()
  from public, anon, authenticated;
revoke all on function public.unblock_my_blocked_student(text)
  from public, anon, authenticated;
grant execute on function public.list_my_blocked_students()
  to authenticated;
grant execute on function public.unblock_my_blocked_student(text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Discovery requester/target gate
-- ---------------------------------------------------------------------------

create or replace function public.list_people_discovery_profiles(
  p_campus text default null,
  p_study_program text default null,
  p_semester smallint default null,
  p_city_region text default null,
  p_connection_goal text default null,
  p_interest text default null,
  p_after_alias text default null,
  p_limit integer default 13
)
returns table (
  public_alias text,
  campus text,
  study_program text,
  semester smallint,
  city_region text,
  short_intro text,
  interests text[],
  connection_goals text[],
  is_verified boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 13), 1), 13);
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'active student required' using errcode = '42501';
  end if;
  if (p_campus is not null and char_length(btrim(p_campus)) > 120)
    or (p_study_program is not null and char_length(btrim(p_study_program)) > 120)
    or (p_city_region is not null and char_length(btrim(p_city_region)) > 120)
    or (p_semester is not null and p_semester not between 1 and 16)
    or (p_after_alias is not null and p_after_alias !~ '^Partner #[0-9]{6}$')
    or (p_connection_goal is not null and p_connection_goal not in (
      'study', 'friendship', 'networking', 'collaboration',
      'campus_activities', 'meaningful_connection'
    ))
    or (p_interest is not null and p_interest not in (
      'technology', 'design', 'business', 'languages', 'books', 'film',
      'music', 'sports', 'organizations', 'career', 'research', 'volunteering'
    )) then
    raise exception 'invalid discovery filter' using errcode = '22023';
  end if;

  return query
  select
    profile.public_alias,
    profile.campus,
    profile.study_program,
    profile.semester,
    profile.city_region,
    profile.short_intro,
    profile.interests,
    profile.connection_goals,
    profile.verification_status = 'verified'
  from public.profiles profile
  where profile.user_id <> actor
    and profile.is_discoverable = true
    and public.is_eligible_introduction_student(profile.user_id)
    and not public.users_are_blocked(actor, profile.user_id)
    and (p_campus is null
      or position(lower(btrim(p_campus)) in lower(profile.campus)) > 0)
    and (p_study_program is null
      or position(lower(btrim(p_study_program)) in lower(profile.study_program)) > 0)
    and (p_semester is null or profile.semester = p_semester)
    and (p_city_region is null
      or position(lower(btrim(p_city_region)) in lower(profile.city_region)) > 0)
    and (p_connection_goal is null
      or profile.connection_goals @> array[p_connection_goal])
    and (p_interest is null or profile.interests @> array[p_interest])
    and (p_after_alias is null or profile.public_alias > p_after_alias)
  order by profile.public_alias
  limit safe_limit;
end;
$$;

create or replace function public.get_people_discovery_profile(
  p_public_alias text
)
returns table (
  public_alias text,
  campus text,
  study_program text,
  semester smallint,
  city_region text,
  short_intro text,
  interests text[],
  connection_goals text[],
  is_verified boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'active student required' using errcode = '42501';
  end if;
  if p_public_alias is null or p_public_alias !~ '^Partner #[0-9]{6}$' then
    raise exception 'invalid discovery alias' using errcode = '22023';
  end if;

  return query
  select
    profile.public_alias,
    profile.campus,
    profile.study_program,
    profile.semester,
    profile.city_region,
    profile.short_intro,
    profile.interests,
    profile.connection_goals,
    profile.verification_status = 'verified'
  from public.profiles profile
  where profile.public_alias = p_public_alias
    and profile.user_id <> actor
    and profile.is_discoverable = true
    and public.is_eligible_introduction_student(profile.user_id)
    and not public.users_are_blocked(actor, profile.user_id)
  limit 1;
end;
$$;

revoke all on function public.list_people_discovery_profiles(
  text, text, smallint, text, text, text, text, integer
) from public, anon, authenticated;
revoke all on function public.get_people_discovery_profile(text)
  from public, anon, authenticated;
grant execute on function public.list_people_discovery_profiles(
  text, text, smallint, text, text, text, text, integer
) to authenticated;
grant execute on function public.get_people_discovery_profile(text)
  to authenticated;
