alter table public.profiles
  add column degree_level text null,
  add constraint profiles_degree_level_allowed
    check (
      degree_level is null
      or degree_level in (
        'diploma', 'sarjana', 'magister', 'doktor', 'profesi', 'spesialis'
      )
    );

grant update (degree_level) on table public.profiles to authenticated;

create table public.onboarding_academic_claims (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nim_ciphertext bytea not null,
  nim_iv bytea not null,
  nim_auth_tag bytea not null,
  nim_last_four text not null,
  nim_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_academic_nim_last_four_format
    check (nim_last_four ~ '^[A-Z0-9]{4}$'),
  constraint onboarding_academic_nim_fingerprint_format
    check (nim_fingerprint ~ '^[a-f0-9]{64}$')
);

create index onboarding_academic_nim_fingerprint_idx
  on public.onboarding_academic_claims (nim_fingerprint);

drop trigger if exists onboarding_academic_claims_set_updated_at
  on public.onboarding_academic_claims;
create trigger onboarding_academic_claims_set_updated_at
before update on public.onboarding_academic_claims
for each row execute function public.set_updated_at();

alter table public.onboarding_academic_claims enable row level security;
revoke all on table public.onboarding_academic_claims
  from public, anon, authenticated;

create or replace function public.complete_student_onboarding_v2(
  p_public_alias text,
  p_first_name text,
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

revoke execute on function public.complete_student_onboarding_v2(
  text, text, bytea, bytea, bytea, text, text, text, text, text, smallint,
  text, text, text[], text[], boolean, boolean, boolean, boolean, boolean,
  text, boolean, boolean, boolean
) from public, anon;
grant execute on function public.complete_student_onboarding_v2(
  text, text, bytea, bytea, bytea, text, text, text, text, text, smallint,
  text, text, text[], text[], boolean, boolean, boolean, boolean, boolean,
  text, boolean, boolean, boolean
) to authenticated;

revoke execute on function public.complete_student_onboarding(
  text, text, text, text, smallint, text, text, text[], text[], boolean,
  boolean, boolean, boolean, boolean, text, boolean, boolean, boolean
) from authenticated;

alter table public.student_verification_requests
  add column semester_claim smallint null,
  add column pddikti_evidence_path text null,
  add column pddikti_evidence_deletion_at timestamptz null,
  add column pddikti_evidence_deleted_at timestamptz null,
  add constraint student_verification_semester_range
    check (semester_claim is null or semester_claim between 1 and 16),
  add constraint student_verification_pddikti_evidence_path_length
    check (
      pddikti_evidence_path is null
      or char_length(pddikti_evidence_path) between 10 and 500
    );

create index student_verification_pddikti_evidence_deletion_idx
  on public.student_verification_requests (pddikti_evidence_deletion_at)
  where pddikti_evidence_deletion_at is not null
    and pddikti_evidence_path is not null;

create or replace function public.schedule_pddikti_evidence_deletion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pddikti_evidence_path is not null then
    if new.status in ('verified', 'rejected', 'expired') then
      new.pddikti_evidence_deletion_at = now() + interval '30 days';
    elsif new.status = 'cancelled' then
      new.pddikti_evidence_deletion_at = now() + interval '24 hours';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists student_verification_schedule_pddikti_deletion
  on public.student_verification_requests;
create trigger student_verification_schedule_pddikti_deletion
before update of status on public.student_verification_requests
for each row execute function public.schedule_pddikti_evidence_deletion();

grant select (
  semester_claim,
  pddikti_evidence_deletion_at,
  pddikti_evidence_deleted_at
) on table public.student_verification_requests to authenticated;

create or replace function public.create_student_verification_request_v2(
  p_user_id uuid,
  p_request_id uuid,
  p_method text,
  p_campus_claim text,
  p_study_program_claim text,
  p_degree_level_claim text,
  p_semester_claim smallint,
  p_nim_ciphertext bytea,
  p_nim_iv bytea,
  p_nim_auth_tag bytea,
  p_nim_last_four text,
  p_nim_fingerprint text,
  p_legal_name_ciphertext bytea,
  p_legal_name_iv bytea,
  p_legal_name_auth_tag bytea,
  p_consent_version text,
  p_evidence_path text,
  p_pddikti_evidence_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_request_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if p_pddikti_evidence_path is null then
    raise exception 'PDDikti evidence required' using errcode = '22023';
  end if;

  select public.create_student_verification_request(
    p_user_id,
    p_request_id,
    p_method,
    p_campus_claim,
    p_study_program_claim,
    p_degree_level_claim,
    p_nim_ciphertext,
    p_nim_iv,
    p_nim_auth_tag,
    p_nim_last_four,
    p_nim_fingerprint,
    p_legal_name_ciphertext,
    p_legal_name_iv,
    p_legal_name_auth_tag,
    p_consent_version,
    p_evidence_path
  )
  into created_request_id;

  update public.student_verification_requests
  set
    semester_claim = p_semester_claim,
    pddikti_evidence_path = p_pddikti_evidence_path,
    pddikti_evidence_deletion_at = now() + interval '90 days'
  where id = created_request_id;

  return created_request_id;
end;
$$;

revoke execute on function public.create_student_verification_request_v2(
  uuid, uuid, text, text, text, text, smallint, bytea, bytea, bytea, text,
  text, bytea, bytea, bytea, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_student_verification_request_v2(
  uuid, uuid, text, text, text, text, smallint, bytea, bytea, bytea, text,
  text, bytea, bytea, bytea, text, text, text
) to service_role;
