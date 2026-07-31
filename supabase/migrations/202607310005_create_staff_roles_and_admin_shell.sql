create table public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  verification_reviewer boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz null,
  constraint staff_members_role_allowed check (role in ('owner', 'admin')),
  constraint staff_members_status_allowed check (status in ('active', 'inactive')),
  constraint staff_members_disabled_state check (
    (status = 'active' and disabled_at is null)
    or (status = 'inactive' and disabled_at is not null)
  )
);

create unique index staff_members_single_owner_idx
  on public.staff_members (role)
  where role = 'owner';
create index staff_members_active_role_idx
  on public.staff_members (status, role)
  where status = 'active';

create table public.staff_role_events (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid null references auth.users(id) on delete set null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  event_type text not null,
  created_at timestamptz not null default now(),
  constraint staff_role_events_type_allowed check (event_type in (
    'owner_bootstrapped',
    'admin_granted',
    'admin_deactivated',
    'admin_reactivated',
    'reviewer_granted',
    'reviewer_removed'
  ))
);

create index staff_role_events_created_idx
  on public.staff_role_events (created_at desc);
create index staff_role_events_target_created_idx
  on public.staff_role_events (target_user_id, created_at desc);
create unique index staff_role_events_one_owner_bootstrap_idx
  on public.staff_role_events (target_user_id, event_type)
  where event_type = 'owner_bootstrapped';

drop trigger if exists staff_members_set_updated_at on public.staff_members;
create trigger staff_members_set_updated_at
before update on public.staff_members
for each row execute function public.set_updated_at();

alter table public.staff_members enable row level security;
alter table public.staff_role_events enable row level security;
revoke all on table public.staff_members from public, anon, authenticated;
revoke all on table public.staff_role_events from public, anon, authenticated;

create or replace function public.is_current_active_staff(
  p_allowed_roles text[],
  p_require_reviewer boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members staff
    where staff.user_id = auth.uid()
      and staff.status = 'active'
      and staff.role = any(p_allowed_roles)
      and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = staff.role
      and (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'verification_reviewer', 'false') = 'true'
      ) = staff.verification_reviewer
      and (not p_require_reviewer or staff.verification_reviewer = true)
  );
$$;

revoke all on function public.is_current_active_staff(text[], boolean)
  from public, anon, authenticated;

create or replace function public.get_current_staff_membership()
returns table (
  role text,
  status text,
  verification_reviewer boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select staff.role, staff.status, staff.verification_reviewer
  from public.staff_members staff
  where staff.user_id = auth.uid()
    and public.is_current_active_staff(
      array['owner', 'admin']::text[],
      false
    );
$$;

revoke all on function public.get_current_staff_membership()
  from public, anon;
grant execute on function public.get_current_staff_membership()
  to authenticated;

create or replace function public.bootstrap_initial_owner(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_users integer;
  existing_owner_id uuid;
  already_configured boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'trusted bootstrap required' using errcode = '42501';
  end if;

  select count(*) into matched_users
  from auth.users
  where id = p_user_id;
  if matched_users <> 1 then
    raise exception 'exactly one auth user is required' using errcode = 'P0002';
  end if;

  select user_id into existing_owner_id
  from public.staff_members
  where role = 'owner'
  limit 1
  for update;
  if existing_owner_id is not null and existing_owner_id <> p_user_id then
    raise exception 'an owner already exists' using errcode = '23505';
  end if;

  select exists (
    select 1 from public.staff_members
    where user_id = p_user_id
      and role = 'owner'
      and status = 'active'
      and verification_reviewer = true
  ) into already_configured;

  insert into public.staff_members (
    user_id, role, status, verification_reviewer, created_by
  ) values (
    p_user_id, 'owner', 'active', true, p_user_id
  )
  on conflict (user_id) do update set
    role = 'owner',
    status = 'active',
    verification_reviewer = true,
    disabled_at = null;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'role', 'owner',
      'verification_reviewer', true
    )
  where id = p_user_id;

  update public.profiles
  set is_discoverable = false
  where user_id = p_user_id;

  insert into public.staff_role_events (
    target_user_id, actor_user_id, event_type
  ) values (
    p_user_id, p_user_id, 'owner_bootstrapped'
  ) on conflict do nothing;

  return not already_configured;
end;
$$;

revoke all on function public.bootstrap_initial_owner(uuid)
  from public, anon, authenticated;
grant execute on function public.bootstrap_initial_owner(uuid)
  to service_role;

create or replace function public.manage_staff_member(
  p_target_user_id uuid,
  p_action text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  current_staff public.staff_members%rowtype;
  target_metadata jsonb;
  event_name text;
  changed boolean := false;
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  select coalesce(raw_app_meta_data, '{}'::jsonb) into target_metadata
  from auth.users where id = p_target_user_id;
  if p_target_user_id is null or target_metadata is null then
    raise exception 'existing auth user required' using errcode = 'P0002';
  end if;
  if p_target_user_id = actor_user_id then
    raise exception 'owner cannot manage their own role' using errcode = '42501';
  end if;
  if p_action not in (
    'grant_admin', 'deactivate_admin', 'reactivate_admin',
    'grant_reviewer', 'remove_reviewer'
  ) then
    raise exception 'invalid staff action' using errcode = '22023';
  end if;

  select * into current_staff
  from public.staff_members
  where user_id = p_target_user_id
  for update;
  if current_staff.role = 'owner' then
    raise exception 'owner role is immutable here' using errcode = '42501';
  end if;

  if p_action = 'grant_admin' then
    insert into public.staff_members (
      user_id, role, status, verification_reviewer, created_by
    ) values (
      p_target_user_id, 'admin', 'active', true, actor_user_id
    )
    on conflict (user_id) do update set
      role = 'admin', status = 'active', verification_reviewer = true,
      disabled_at = null;
    event_name := 'admin_granted';
    changed := current_staff.user_id is null
      or current_staff.role is distinct from 'admin'
      or current_staff.status is distinct from 'active'
      or current_staff.verification_reviewer is distinct from true
      or coalesce(target_metadata ->> 'role', '') <> 'admin'
      or coalesce(target_metadata ->> 'verification_reviewer', 'false') <> 'true';
  elsif current_staff.user_id is null or current_staff.role <> 'admin' then
    raise exception 'admin membership required' using errcode = 'P0002';
  elsif p_action = 'deactivate_admin' then
    if current_staff.status = 'active' then
      update public.staff_members set status = 'inactive', disabled_at = now()
      where user_id = p_target_user_id;
      changed := true;
      event_name := 'admin_deactivated';
    end if;
  elsif p_action = 'reactivate_admin' then
    if current_staff.status = 'inactive' then
      update public.staff_members set status = 'active', disabled_at = null
      where user_id = p_target_user_id;
      changed := true;
      event_name := 'admin_reactivated';
    end if;
  elsif p_action = 'grant_reviewer' then
    if current_staff.verification_reviewer = false then
      update public.staff_members set verification_reviewer = true
      where user_id = p_target_user_id;
      changed := true;
      event_name := 'reviewer_granted';
    end if;
  elsif p_action = 'remove_reviewer' then
    if current_staff.verification_reviewer = true then
      update public.staff_members set verification_reviewer = false
      where user_id = p_target_user_id;
      changed := true;
      event_name := 'reviewer_removed';
    end if;
  end if;

  if changed then
    update auth.users auth_user
    set raw_app_meta_data = case
      when staff.status = 'inactive' then
        (coalesce(auth_user.raw_app_meta_data, '{}'::jsonb) - 'role')
          || jsonb_build_object('verification_reviewer', false)
      else
        coalesce(auth_user.raw_app_meta_data, '{}'::jsonb)
          || jsonb_build_object(
            'role', 'admin',
            'verification_reviewer', staff.verification_reviewer
          )
      end
    from public.staff_members staff
    where auth_user.id = p_target_user_id
      and staff.user_id = p_target_user_id;

    update public.profiles
    set is_discoverable = false
    where user_id = p_target_user_id;

    insert into public.staff_role_events (
      target_user_id, actor_user_id, event_type
    ) values (
      p_target_user_id, actor_user_id, event_name
    );
  end if;

  return changed;
end;
$$;

revoke all on function public.manage_staff_member(uuid, text)
  from public, anon;
grant execute on function public.manage_staff_member(uuid, text)
  to authenticated;

create or replace function public.list_staff_members()
returns table (
  user_id uuid,
  role text,
  status text,
  verification_reviewer boolean,
  created_at timestamptz,
  updated_at timestamptz,
  disabled_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  return query
  select staff.user_id, staff.role, staff.status,
    staff.verification_reviewer, staff.created_at, staff.updated_at,
    staff.disabled_at
  from public.staff_members staff
  order by staff.role desc, staff.created_at asc;
end;
$$;

revoke all on function public.list_staff_members() from public, anon;
grant execute on function public.list_staff_members() to authenticated;

create or replace function public.list_staff_role_events(p_limit integer default 50)
returns table (
  target_suffix text,
  actor_suffix text,
  event_type text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  return query
  select right(event.target_user_id::text, 8),
    right(event.actor_user_id::text, 8), event.event_type, event.created_at
  from public.staff_role_events event
  order by event.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

revoke all on function public.list_staff_role_events(integer)
  from public, anon;
grant execute on function public.list_staff_role_events(integer)
  to authenticated;

create or replace function public.list_staff_verification_requests(
  p_status text default null,
  p_limit integer default 50
)
returns table (
  request_id uuid,
  status text,
  method text,
  pddikti_match_status text,
  ownership_status text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  rejection_reason_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_current_active_staff(
    array['owner', 'admin']::text[], true
  ) then
    raise exception 'reviewer authorization required' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in (
    'pending', 'under_review', 'needs_action', 'verified',
    'rejected', 'expired', 'cancelled'
  ) then
    raise exception 'invalid verification status' using errcode = '22023';
  end if;
  return query
  select request.id, request.status, request.method,
    request.pddikti_match_status, request.ownership_status,
    request.submitted_at, request.reviewed_at,
    request.rejection_reason_code
  from public.student_verification_requests request
  where p_status is null or request.status = p_status
  order by request.submitted_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

revoke all on function public.list_staff_verification_requests(text, integer)
  from public, anon;
grant execute on function public.list_staff_verification_requests(text, integer)
  to authenticated;

create or replace function public.finalize_staff_verification_review(
  p_request_id uuid,
  p_request_status text,
  p_pddikti_match_status text,
  p_ownership_status text,
  p_rejection_reason_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  target_user_id uuid;
  target_method text;
  event_name text;
begin
  if not public.is_current_active_staff(
    array['owner', 'admin']::text[], true
  ) then
    raise exception 'reviewer authorization required' using errcode = '42501';
  end if;
  if p_request_status not in (
    'under_review', 'needs_action', 'verified', 'rejected', 'expired'
  ) then
    raise exception 'invalid review status' using errcode = '22023';
  end if;
  if p_request_status = 'verified' and not (
    p_pddikti_match_status = 'matched'
    and p_ownership_status in ('campus_email_verified', 'document_verified')
  ) then
    raise exception 'combined verification required' using errcode = '23514';
  end if;

  select request.user_id, request.method
  into target_user_id, target_method
  from public.student_verification_requests request
  where request.id = p_request_id
  for update;
  if target_user_id is null then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if target_user_id = actor_user_id then
    raise exception 'self review is not allowed' using errcode = '42501';
  end if;
  if p_ownership_status = 'campus_email_verified'
    and target_method <> 'campus_email' then
    raise exception 'ownership method mismatch' using errcode = '23514';
  end if;
  if p_ownership_status = 'document_verified'
    and target_method <> 'student_card' then
    raise exception 'ownership method mismatch' using errcode = '23514';
  end if;

  update public.student_verification_requests
  set status = p_request_status,
    pddikti_match_status = p_pddikti_match_status,
    ownership_status = p_ownership_status,
    reviewed_at = now(),
    verified_at = case when p_request_status = 'verified' then now() else null end,
    evidence_deletion_at = case
      when evidence_path is null then null
      when p_request_status in ('verified', 'rejected', 'expired')
        then now() + interval '30 days'
      else evidence_deletion_at
    end,
    pddikti_evidence_deletion_at = case
      when pddikti_evidence_path is null then null
      when p_request_status in ('verified', 'rejected', 'expired')
        then now() + interval '30 days'
      else pddikti_evidence_deletion_at
    end,
    rejection_reason_code = case
      when p_request_status in ('needs_action', 'rejected')
        then p_rejection_reason_code
      else null
    end
  where id = p_request_id;

  update public.profiles
  set verification_status = case
    when p_request_status = 'verified' then 'verified'
    when p_request_status = 'rejected' then 'rejected'
    else 'pending'
  end
  where user_id = target_user_id;

  event_name := case p_request_status
    when 'under_review' then 'review_started'
    when 'needs_action' then 'action_requested'
    when 'verified' then 'verification_approved'
    when 'rejected' then 'verification_rejected'
    when 'expired' then 'request_expired'
  end;
  insert into public.verification_events (
    request_id, user_id, actor_id, event_type
  ) values (
    p_request_id, target_user_id, actor_user_id, event_name
  );
end;
$$;

revoke all on function public.finalize_staff_verification_review(
  uuid, text, text, text, text
) from public, anon;
grant execute on function public.finalize_staff_verification_review(
  uuid, text, text, text, text
) to authenticated;

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
  public_alias text, campus text, study_program text, semester smallint,
  city_region text, short_intro text, interests text[],
  connection_goals text[], is_verified boolean
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
    select 1 from public.profiles requester
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
  select profile.public_alias, profile.campus, profile.study_program,
    profile.semester, profile.city_region, profile.short_intro,
    profile.interests, profile.connection_goals,
    profile.verification_status = 'verified'
  from public.profiles profile
  where profile.user_id <> current_user_id
    and profile.is_discoverable = true
    and profile.onboarding_completed_at is not null
    and not exists (
      select 1 from public.staff_members staff
      where staff.user_id = profile.user_id and staff.status = 'active'
    )
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

create or replace function public.get_people_discovery_profile(p_public_alias text)
returns table (
  public_alias text, campus text, study_program text, semester smallint,
  city_region text, short_intro text, interests text[],
  connection_goals text[], is_verified boolean
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
    select 1 from public.profiles requester
    where requester.user_id = current_user_id
      and requester.onboarding_completed_at is not null
  ) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;
  if p_public_alias !~ '^Partner #[0-9]{6}$' then
    raise exception 'invalid public alias' using errcode = '22023';
  end if;

  return query
  select profile.public_alias, profile.campus, profile.study_program,
    profile.semester, profile.city_region, profile.short_intro,
    profile.interests, profile.connection_goals,
    profile.verification_status = 'verified'
  from public.profiles profile
  where profile.public_alias = p_public_alias
    and profile.user_id <> current_user_id
    and profile.is_discoverable = true
    and profile.onboarding_completed_at is not null
    and not exists (
      select 1 from public.staff_members staff
      where staff.user_id = profile.user_id and staff.status = 'active'
    )
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
  if p_is_discoverable and exists (
    select 1 from public.staff_members staff
    where staff.user_id = current_user_id and staff.status = 'active'
  ) then
    raise exception 'staff profiles are not discoverable' using errcode = '42501';
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
