create index if not exists profiles_people_discovery_alias_idx
  on public.profiles (public_alias)
  where is_discoverable = true and onboarding_completed_at is not null;

create index if not exists profiles_people_discovery_interests_idx
  on public.profiles using gin (interests);

create index if not exists profiles_people_discovery_goals_idx
  on public.profiles using gin (connection_goals);

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
  current_user_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 13), 1), 13);
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles requester
    where requester.user_id = current_user_id
      and requester.onboarding_completed_at is not null
  ) then
    raise exception 'onboarding required' using errcode = '42501';
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
  where profile.user_id <> current_user_id
    and profile.is_discoverable = true
    and profile.onboarding_completed_at is not null
    and (p_campus is null or position(lower(btrim(p_campus)) in lower(profile.campus)) > 0)
    and (p_study_program is null or position(lower(btrim(p_study_program)) in lower(profile.study_program)) > 0)
    and (p_semester is null or profile.semester = p_semester)
    and (p_city_region is null or position(lower(btrim(p_city_region)) in lower(profile.city_region)) > 0)
    and (p_connection_goal is null or profile.connection_goals @> array[p_connection_goal])
    and (p_interest is null or profile.interests @> array[p_interest])
    and (p_after_alias is null or profile.public_alias > p_after_alias)
  order by profile.public_alias asc
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
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles requester
    where requester.user_id = current_user_id
      and requester.onboarding_completed_at is not null
  ) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  if p_public_alias !~ '^Partner #[0-9]{6}$' then
    raise exception 'invalid public alias' using errcode = '22023';
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
    and profile.user_id <> current_user_id
    and profile.is_discoverable = true
    and profile.onboarding_completed_at is not null
  limit 1;
end;
$$;

create or replace function public.set_people_discovery_visibility(
  p_is_discoverable boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_is_discoverable is null then
    raise exception 'visibility is required' using errcode = '22023';
  end if;

  update public.profiles
  set is_discoverable = p_is_discoverable
  where user_id = current_user_id
    and onboarding_completed_at is not null;

  if not found then
    raise exception 'completed profile required' using errcode = '42501';
  end if;

  return p_is_discoverable;
end;
$$;

revoke all on function public.list_people_discovery_profiles(
  text, text, smallint, text, text, text, text, integer
) from public, anon;
revoke all on function public.get_people_discovery_profile(text)
  from public, anon;
revoke all on function public.set_people_discovery_visibility(boolean)
  from public, anon;

grant execute on function public.list_people_discovery_profiles(
  text, text, smallint, text, text, text, text, integer
) to authenticated;
grant execute on function public.get_people_discovery_profile(text)
  to authenticated;
grant execute on function public.set_people_discovery_visibility(boolean)
  to authenticated;

comment on function public.list_people_discovery_profiles(
  text, text, smallint, text, text, text, text, integer
) is 'Returns only the approved anonymous People Discovery projection.';
comment on function public.get_people_discovery_profile(text)
  is 'Returns one discovery-eligible anonymous profile by public alias.';
comment on function public.set_people_discovery_visibility(boolean)
  is 'Lets an onboarded user change only their own discovery visibility.';
