-- Add private last_name to profiles for onboarding.
-- Not used in People discovery / public projections (RPC projections unchanged).

alter table public.profiles
  add column if not exists last_name text;

alter table public.profiles
  drop constraint if exists profiles_last_name_length;

alter table public.profiles
  add constraint profiles_last_name_length
  check (
    last_name is null
    or char_length(btrim(last_name)) between 1 and 80
  );

comment on column public.profiles.last_name is
  'Private family/last name from onboarding. Owner-scoped only; never returned by People discovery RPCs.';

-- Allow owners to update last_name alongside other editable profile fields.
grant update (
  first_name,
  last_name,
  campus,
  study_program,
  semester,
  city_region,
  short_intro,
  interests,
  connection_goals
) on table public.profiles to authenticated;

-- Replace onboarding RPC with last_name support (drop old signature overload).
drop function if exists public.complete_student_onboarding_v2(
  text, text, bytea, bytea, bytea, text, text, text, text, text, smallint,
  text, text, text[], text[], boolean, boolean, boolean, boolean, boolean,
  text, boolean, boolean, boolean
);

create or replace function public.complete_student_onboarding_v2(
  p_public_alias text,
  p_first_name text,
  p_last_name text,
  p_nim_ciphertext bytea,
  p_nim_iv bytea,
  p_nim_auth_tag bytea,
  p_nim_last_four text,
  p_nim_fingerprint text,
  p_campus text,
  p_study_program text,
  p_degree_level text,
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
  has_nim boolean := p_nim_ciphertext is not null;
  cleaned_last_name text := btrim(coalesce(p_last_name, ''));
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

  if char_length(btrim(coalesce(p_first_name, ''))) < 1
    or char_length(btrim(coalesce(p_first_name, ''))) > 80 then
    raise exception 'invalid first name' using errcode = '22023';
  end if;

  if char_length(cleaned_last_name) < 1 or char_length(cleaned_last_name) > 80 then
    raise exception 'invalid last name' using errcode = '22023';
  end if;

  if p_degree_level not in (
    'diploma', 'sarjana', 'magister', 'doktor', 'profesi', 'spesialis'
  ) then
    raise exception 'invalid degree level' using errcode = '22023';
  end if;

  if not (
    (
      p_nim_ciphertext is null
      and p_nim_iv is null
      and p_nim_auth_tag is null
      and p_nim_last_four is null
      and p_nim_fingerprint is null
    )
    or (
      p_nim_ciphertext is not null
      and p_nim_iv is not null
      and p_nim_auth_tag is not null
      and p_nim_last_four is not null
      and p_nim_fingerprint is not null
    )
  ) then
    raise exception 'incomplete encrypted NIM' using errcode = '22023';
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
    last_name,
    campus,
    study_program,
    degree_level,
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
    cleaned_last_name,
    btrim(p_campus),
    btrim(p_study_program),
    p_degree_level,
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
    last_name = excluded.last_name,
    campus = excluded.campus,
    study_program = excluded.study_program,
    degree_level = excluded.degree_level,
    semester = excluded.semester,
    city_region = excluded.city_region,
    short_intro = excluded.short_intro,
    interests = excluded.interests,
    connection_goals = excluded.connection_goals,
    is_discoverable = false,
    onboarding_completed_at = now();

  if has_nim then
    insert into public.onboarding_academic_claims (
      user_id,
      nim_ciphertext,
      nim_iv,
      nim_auth_tag,
      nim_last_four,
      nim_fingerprint
    )
    values (
      current_user_id,
      p_nim_ciphertext,
      p_nim_iv,
      p_nim_auth_tag,
      p_nim_last_four,
      p_nim_fingerprint
    )
    on conflict (user_id) do update set
      nim_ciphertext = excluded.nim_ciphertext,
      nim_iv = excluded.nim_iv,
      nim_auth_tag = excluded.nim_auth_tag,
      nim_last_four = excluded.nim_last_four,
      nim_fingerprint = excluded.nim_fingerprint;
  end if;

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

revoke all on function public.complete_student_onboarding_v2(
  text, text, text, bytea, bytea, bytea, text, text, text, text, text, smallint,
  text, text, text[], text[], boolean, boolean, boolean, boolean, boolean,
  text, boolean, boolean, boolean
) from public, anon, authenticated;

grant execute on function public.complete_student_onboarding_v2(
  text, text, text, bytea, bytea, bytea, text, text, text, text, text, smallint,
  text, text, text[], text[], boolean, boolean, boolean, boolean, boolean,
  text, boolean, boolean, boolean
) to authenticated;
