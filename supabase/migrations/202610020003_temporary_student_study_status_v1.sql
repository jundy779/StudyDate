-- Temporary student study status v1
-- Repository implementation. The People page detects capability so rollout is safe
-- before this migration is applied remotely.

alter table public.profiles
  add column if not exists study_status text,
  add column if not exists study_status_expires_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_study_status_allowed;
alter table public.profiles
  add constraint profiles_study_status_allowed
  check (
    (study_status is null and study_status_expires_at is null)
    or (
      study_status in ('study_friend', 'discussion_friend', 'project_friend')
      and study_status_expires_at is not null
    )
  );

comment on column public.profiles.study_status is
  'Optional temporary public intent shown in People; never a dating or availability claim.';
comment on column public.profiles.study_status_expires_at is
  'UTC expiry. Public projections hide the status after this timestamp.';

create or replace function public.get_my_study_status()
returns table (
  study_status text,
  expires_at timestamptz
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

  return query
  select
    case
      when profile.study_status_expires_at > timezone('utc', now())
        then profile.study_status
      else null
    end,
    case
      when profile.study_status_expires_at > timezone('utc', now())
        then profile.study_status_expires_at
      else null
    end
  from public.profiles profile
  where profile.user_id = actor
  limit 1;
end;
$$;

create or replace function public.set_my_study_status(
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  normalized_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'active student required' using errcode = '42501';
  end if;
  if normalized_status is not null
    and normalized_status not in (
      'study_friend',
      'discussion_friend',
      'project_friend'
    ) then
    raise exception 'invalid study status' using errcode = '22023';
  end if;

  update public.profiles profile
  set study_status = normalized_status,
      study_status_expires_at = case
        when normalized_status is null then null
        else timezone('utc', now()) + interval '24 hours'
      end
  where profile.user_id = actor;

  if not found then
    raise exception 'profile unavailable' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.get_my_study_status()
  from public, anon, authenticated;
revoke all on function public.set_my_study_status(text)
  from public, anon, authenticated;
grant execute on function public.get_my_study_status()
  to authenticated;
grant execute on function public.set_my_study_status(text)
  to authenticated;

drop function if exists public.list_people_discovery_profiles(
  text, text, smallint, text, text, text, text, integer
);
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
  is_verified boolean,
  study_status text,
  study_status_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 13), 1), 13);
  plan text;
  filter_semester smallint := p_semester;
  filter_city text := p_city_region;
  filter_goal text := p_connection_goal;
  filter_interest text := p_interest;
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

  plan := public.effective_membership_plan(actor);
  if not public.membership_allows_advanced_discovery(plan) then
    filter_semester := null;
    filter_city := null;
    filter_goal := null;
    filter_interest := null;
  end if;

  if not public.consume_membership_quota(
    actor,
    'people_discovery_daily',
    public.membership_plan_limit(plan, 'people_discovery_daily')
  ) then
    raise exception 'discovery quota reached' using errcode = 'P0001';
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
    profile.verification_status = 'verified',
    case
      when profile.study_status_expires_at > timezone('utc', now())
        then profile.study_status
      else null
    end,
    case
      when profile.study_status_expires_at > timezone('utc', now())
        then profile.study_status_expires_at
      else null
    end
  from public.profiles profile
  where profile.user_id <> actor
    and profile.is_discoverable = true
    and public.is_eligible_introduction_student(profile.user_id)
    and not public.users_are_blocked(actor, profile.user_id)
    and (p_campus is null
      or position(lower(btrim(p_campus)) in lower(profile.campus)) > 0)
    and (p_study_program is null
      or position(lower(btrim(p_study_program)) in lower(profile.study_program)) > 0)
    and (filter_semester is null or profile.semester = filter_semester)
    and (filter_city is null
      or position(lower(btrim(filter_city)) in lower(profile.city_region)) > 0)
    and (filter_goal is null
      or profile.connection_goals @> array[filter_goal])
    and (filter_interest is null or profile.interests @> array[filter_interest])
    and (p_after_alias is null or profile.public_alias > p_after_alias)
  order by profile.public_alias
  limit safe_limit;
end;
$$;

drop function if exists public.get_people_discovery_profile(text);
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
  is_verified boolean,
  study_status text,
  study_status_expires_at timestamptz
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
    profile.verification_status = 'verified',
    case
      when profile.study_status_expires_at > timezone('utc', now())
        then profile.study_status
      else null
    end,
    case
      when profile.study_status_expires_at > timezone('utc', now())
        then profile.study_status_expires_at
      else null
    end
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
