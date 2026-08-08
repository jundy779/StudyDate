-- Student profile self-edit (private fields + mascot avatar key).
-- Clear face photos remain Identity Reveal–scoped; People uses mascot only.

alter table public.profiles
  add column if not exists avatar_mascot text;

alter table public.profiles
  drop constraint if exists profiles_avatar_mascot_allowed;

alter table public.profiles
  add constraint profiles_avatar_mascot_allowed
  check (
    avatar_mascot is null
    or avatar_mascot in ('front', 'hello', 'chat', 'study')
  );

comment on column public.profiles.avatar_mascot is
  'Anonymous People avatar mascot key. Not a clear-face photo.';

grant update (
  first_name,
  last_name,
  campus,
  study_program,
  semester,
  city_region,
  short_intro,
  interests,
  connection_goals,
  avatar_mascot
) on table public.profiles to authenticated;

create or replace function public.update_my_student_profile(
  p_first_name text,
  p_last_name text,
  p_campus text,
  p_study_program text,
  p_degree_level text,
  p_semester smallint,
  p_city_region text,
  p_short_intro text,
  p_avatar_mascot text,
  p_is_discoverable boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  cleaned_first text := btrim(coalesce(p_first_name, ''));
  cleaned_last text := btrim(coalesce(p_last_name, ''));
  cleaned_campus text := btrim(coalesce(p_campus, ''));
  cleaned_program text := btrim(coalesce(p_study_program, ''));
  cleaned_city text := nullif(btrim(coalesce(p_city_region, '')), '');
  cleaned_intro text := nullif(btrim(coalesce(p_short_intro, '')), '');
  cleaned_mascot text := nullif(btrim(coalesce(p_avatar_mascot, '')), '');
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.user_id = current_user_id
      and profile.onboarding_completed_at is not null
  ) then
    raise exception 'completed profile required' using errcode = '42501';
  end if;

  if public.is_active_staff_user(current_user_id) then
    raise exception 'staff cannot edit student profile surface' using errcode = '42501';
  end if;

  if char_length(cleaned_first) < 1 or char_length(cleaned_first) > 80 then
    raise exception 'invalid first name' using errcode = '22023';
  end if;

  if char_length(cleaned_last) < 1 or char_length(cleaned_last) > 80 then
    raise exception 'invalid last name' using errcode = '22023';
  end if;

  if char_length(cleaned_campus) < 2 or char_length(cleaned_campus) > 120 then
    raise exception 'invalid campus' using errcode = '22023';
  end if;

  if char_length(cleaned_program) < 2 or char_length(cleaned_program) > 120 then
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

  if p_is_discoverable is null then
    raise exception 'visibility is required' using errcode = '22023';
  end if;

  if p_is_discoverable and public.is_active_staff_user(current_user_id) then
    raise exception 'staff cannot enable discovery' using errcode = '42501';
  end if;

  update public.profiles
  set
    first_name = cleaned_first,
    last_name = cleaned_last,
    campus = cleaned_campus,
    study_program = cleaned_program,
    degree_level = p_degree_level,
    semester = p_semester,
    city_region = cleaned_city,
    short_intro = cleaned_intro,
    avatar_mascot = cleaned_mascot,
    is_discoverable = p_is_discoverable,
    updated_at = timezone('utc', now())
  where user_id = current_user_id;
end;
$$;

revoke all on function public.update_my_student_profile(
  text, text, text, text, text, smallint, text, text, text, boolean
) from public, anon, authenticated;

grant execute on function public.update_my_student_profile(
  text, text, text, text, text, smallint, text, text, text, boolean
) to authenticated;
