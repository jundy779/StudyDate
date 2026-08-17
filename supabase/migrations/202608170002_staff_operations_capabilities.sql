-- Staff operations capabilities + Early Access / User ops projections
-- Least privilege: new admins do not auto-receive verification or ops capabilities.
-- Owner retains full operational access via role checks (not column flags alone).

alter table public.staff_members
  add column if not exists can_early_access_read boolean not null default false,
  add column if not exists can_users_read boolean not null default false,
  add column if not exists can_users_support boolean not null default false;

comment on column public.staff_members.can_early_access_read is
  'Admin may read Early Access waitlist ops projection.';
comment on column public.staff_members.can_users_read is
  'Admin may read sanitized student account ops list.';
comment on column public.staff_members.can_users_support is
  'Admin may search exact email and view full operational email.';

-- Existing owners: ensure discoverability lock remains; capabilities are role-implied.
-- Existing admins keep false defaults (explicit grant required).

alter table public.staff_role_events
  drop constraint if exists staff_role_events_type_allowed;

alter table public.staff_role_events
  add constraint staff_role_events_type_allowed check (event_type in (
    'owner_bootstrapped',
    'admin_granted',
    'admin_deactivated',
    'admin_reactivated',
    'reviewer_granted',
    'reviewer_removed',
    'early_access_granted',
    'early_access_removed',
    'users_read_granted',
    'users_read_removed',
    'users_support_granted',
    'users_support_removed'
  ));

create table if not exists public.staff_ops_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users (id) on delete set null,
  event_type text not null,
  subject_suffix text null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint staff_ops_audit_events_type_allowed check (
    event_type in (
      'early_access_viewed',
      'user_support_viewed',
      'staff_capability_changed',
      'staff_assigned_by_email'
    )
  ),
  constraint staff_ops_audit_events_subject_suffix_length check (
    subject_suffix is null or char_length(subject_suffix) between 1 and 16
  )
);

create index if not exists staff_ops_audit_events_created_at_idx
  on public.staff_ops_audit_events (created_at desc);

alter table public.staff_ops_audit_events enable row level security;
revoke all on table public.staff_ops_audit_events from anon, authenticated;

create or replace function public.staff_has_ops_capability(
  p_capability text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  membership public.staff_members%rowtype;
begin
  if auth.uid() is null then
    return false;
  end if;
  if not public.is_current_active_staff(array['owner', 'admin']::text[], false) then
    return false;
  end if;

  select * into membership
  from public.staff_members
  where user_id = auth.uid()
    and status = 'active';

  if not found then
    return false;
  end if;

  if membership.role = 'owner' then
    return true;
  end if;

  if p_capability = 'early_access.read' then
    return membership.can_early_access_read;
  end if;
  if p_capability = 'users.read' then
    return membership.can_users_read or membership.can_users_support;
  end if;
  if p_capability = 'users.support' then
    return membership.can_users_support;
  end if;
  if p_capability = 'staff.manage' then
    return false;
  end if;
  if p_capability = 'verification.review' then
    return membership.verification_reviewer
      and public.is_current_active_staff(array['owner', 'admin']::text[], true);
  end if;
  if p_capability = 'moderation.review' then
    return false;
  end if;

  return false;
end;
$$;

revoke all on function public.staff_has_ops_capability(text)
  from public, anon, authenticated;

create or replace function public.get_current_staff_membership()
returns table (
  role text,
  status text,
  verification_reviewer boolean,
  can_early_access_read boolean,
  can_users_read boolean,
  can_users_support boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    staff.role,
    staff.status,
    staff.verification_reviewer,
    staff.can_early_access_read,
    staff.can_users_read,
    staff.can_users_support
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

-- Least-privilege grant_admin: no auto verification_reviewer / ops caps.
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
    'grant_reviewer', 'remove_reviewer',
    'grant_early_access', 'remove_early_access',
    'grant_users_read', 'remove_users_read',
    'grant_users_support', 'remove_users_support'
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
      user_id, role, status, verification_reviewer,
      can_early_access_read, can_users_read, can_users_support, created_by
    ) values (
      p_target_user_id, 'admin', 'active', false,
      false, false, false, actor_user_id
    )
    on conflict (user_id) do update set
      role = 'admin',
      status = 'active',
      disabled_at = null,
      verification_reviewer = case
        when public.staff_members.role = 'admin'
          then public.staff_members.verification_reviewer
        else false
      end,
      can_early_access_read = case
        when public.staff_members.role = 'admin'
          then public.staff_members.can_early_access_read
        else false
      end,
      can_users_read = case
        when public.staff_members.role = 'admin'
          then public.staff_members.can_users_read
        else false
      end,
      can_users_support = case
        when public.staff_members.role = 'admin'
          then public.staff_members.can_users_support
        else false
      end;
    event_name := 'admin_granted';
    changed := current_staff.user_id is null
      or current_staff.role is distinct from 'admin'
      or current_staff.status is distinct from 'active'
      or coalesce(target_metadata ->> 'role', '') <> 'admin';
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
  elsif p_action = 'grant_early_access' then
    if current_staff.can_early_access_read = false then
      update public.staff_members set can_early_access_read = true
      where user_id = p_target_user_id;
      changed := true;
      event_name := 'early_access_granted';
    end if;
  elsif p_action = 'remove_early_access' then
    if current_staff.can_early_access_read = true then
      update public.staff_members set can_early_access_read = false
      where user_id = p_target_user_id;
      changed := true;
      event_name := 'early_access_removed';
    end if;
  elsif p_action = 'grant_users_read' then
    if current_staff.can_users_read = false then
      update public.staff_members set can_users_read = true
      where user_id = p_target_user_id;
      changed := true;
      event_name := 'users_read_granted';
    end if;
  elsif p_action = 'remove_users_read' then
    if current_staff.can_users_read = true then
      update public.staff_members
      set can_users_read = false,
          can_users_support = false
      where user_id = p_target_user_id;
      changed := true;
      event_name := 'users_read_removed';
    end if;
  elsif p_action = 'grant_users_support' then
    if current_staff.can_users_support = false then
      update public.staff_members
      set can_users_support = true,
          can_users_read = true
      where user_id = p_target_user_id;
      changed := true;
      event_name := 'users_support_granted';
    end if;
  elsif p_action = 'remove_users_support' then
    if current_staff.can_users_support = true then
      update public.staff_members set can_users_support = false
      where user_id = p_target_user_id;
      changed := true;
      event_name := 'users_support_removed';
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

    if event_name in (
      'early_access_granted', 'early_access_removed',
      'users_read_granted', 'users_read_removed',
      'users_support_granted', 'users_support_removed'
    ) then
      insert into public.staff_ops_audit_events (
        actor_user_id, event_type, subject_suffix
      ) values (
        actor_user_id,
        'staff_capability_changed',
        right(p_target_user_id::text, 8)
      );
    end if;
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
  can_early_access_read boolean,
  can_users_read boolean,
  can_users_support boolean,
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
  select
    staff.user_id,
    staff.role,
    staff.status,
    staff.verification_reviewer,
    staff.can_early_access_read,
    staff.can_users_read,
    staff.can_users_support,
    staff.created_at,
    staff.updated_at,
    staff.disabled_at
  from public.staff_members staff
  order by staff.role desc, staff.created_at asc;
end;
$$;

revoke all on function public.list_staff_members() from public, anon;
grant execute on function public.list_staff_members() to authenticated;

create or replace function public.list_early_access_waitlist_ops(
  p_email text default null,
  p_status text default null,
  p_campus text default null,
  p_interest text default null,
  p_source text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  email text,
  campus text,
  interests text[],
  source text,
  status text,
  created_at timestamptz,
  activation_label text,
  claimed_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  safe_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  actor uuid := auth.uid();
begin
  if not public.staff_has_ops_capability('early_access.read') then
    raise exception 'early access authorization required' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in ('waiting', 'claimed') then
    raise exception 'invalid status filter' using errcode = '22023';
  end if;
  if p_interest is not null and p_interest not in ('people', 'groups', 'events') then
    raise exception 'invalid interest filter' using errcode = '22023';
  end if;
  if p_source is not null and p_source not in ('navbar', 'hero', 'final-cta') then
    raise exception 'invalid source filter' using errcode = '22023';
  end if;

  normalized_email := nullif(lower(btrim(coalesce(p_email, ''))), '');

  if normalized_email is not null then
    insert into public.staff_ops_audit_events (actor_user_id, event_type)
    values (actor, 'early_access_viewed');
  end if;

  return query
  with filtered as (
    select waitlist.*
    from public.early_access_waitlist waitlist
    where (normalized_email is null or lower(waitlist.email) = normalized_email)
      and (p_status is null or waitlist.status = p_status)
      and (
        p_campus is null
        or btrim(p_campus) = ''
        or lower(coalesce(waitlist.campus, '')) like '%' || lower(btrim(p_campus)) || '%'
      )
      and (p_interest is null or waitlist.interests @> array[p_interest]::text[])
      and (p_source is null or waitlist.source = p_source)
  ),
  counted as (
    select count(*)::bigint as total from filtered
  )
  select
    filtered.email,
    filtered.campus,
    filtered.interests,
    filtered.source,
    filtered.status,
    filtered.created_at,
    case
      when filtered.status = 'claimed' and filtered.claimed_at is not null
        then 'Sudah diaktifkan'
      else 'Belum diaktifkan'
    end as activation_label,
    filtered.claimed_at,
    counted.total
  from filtered
  cross join counted
  order by filtered.created_at desc
  limit safe_limit
  offset safe_offset;
end;
$$;

revoke all on function public.list_early_access_waitlist_ops(
  text, text, text, text, text, integer, integer
) from public, anon;
grant execute on function public.list_early_access_waitlist_ops(
  text, text, text, text, text, integer, integer
) to authenticated;

create or replace function public.list_student_account_ops(
  p_alias text default null,
  p_email text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  alias text,
  email_display text,
  account_status text,
  onboarding_status text,
  campus text,
  study_program text,
  semester smallint,
  is_discoverable boolean,
  verification_summary text,
  created_at timestamptz,
  deactivated boolean,
  deletion_pending boolean,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  safe_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  normalized_alias text;
  normalized_email text;
  allow_full_email boolean;
  actor uuid := auth.uid();
begin
  if not public.staff_has_ops_capability('users.read') then
    raise exception 'users read authorization required' using errcode = '42501';
  end if;

  allow_full_email := public.staff_has_ops_capability('users.support');
  normalized_alias := nullif(lower(btrim(coalesce(p_alias, ''))), '');
  normalized_email := nullif(lower(btrim(coalesce(p_email, ''))), '');

  if normalized_email is not null and not allow_full_email then
    raise exception 'users support authorization required' using errcode = '42501';
  end if;

  if allow_full_email and (normalized_email is not null or normalized_alias is not null) then
    insert into public.staff_ops_audit_events (actor_user_id, event_type)
    values (actor, 'user_support_viewed');
  end if;

  return query
  with base as (
    select
      profile.user_id,
      profile.public_alias,
      auth_user.email as auth_email,
      profile.campus,
      profile.study_program,
      profile.semester,
      profile.is_discoverable,
      profile.verification_status,
      profile.onboarding_completed_at,
      profile.deactivated_at,
      profile.created_at,
      exists (
        select 1
        from public.account_deletion_requests deletion
        where deletion.user_id = profile.user_id
          and deletion.status in ('pending', 'processing', 'failed')
      ) as deletion_pending
    from public.profiles profile
    join auth.users auth_user on auth_user.id = profile.user_id
    where not exists (
      select 1
      from public.staff_members staff
      where staff.user_id = profile.user_id
        and staff.status = 'active'
    )
      and (
        normalized_alias is null
        or lower(profile.public_alias) = normalized_alias
      )
      and (
        normalized_email is null
        or lower(auth_user.email) = normalized_email
      )
  ),
  counted as (
    select count(*)::bigint as total from base
  )
  select
    base.public_alias as alias,
    case
      when allow_full_email then base.auth_email
      else
        left(split_part(base.auth_email, '@', 1), 2)
        || '***@'
        || split_part(base.auth_email, '@', 2)
    end as email_display,
    case
      when base.deletion_pending then 'Penghapusan diproses'
      when base.deactivated_at is not null then 'Dinonaktifkan'
      else 'Aktif'
    end as account_status,
    case
      when base.onboarding_completed_at is not null then 'Onboarding selesai'
      else 'Onboarding belum selesai'
    end as onboarding_status,
    base.campus,
    base.study_program,
    base.semester,
    base.is_discoverable,
    case base.verification_status
      when 'verified' then 'Terverifikasi'
      when 'pending' then 'Sedang diproses'
      when 'rejected' then 'Perlu tindakan'
      else 'Belum diverifikasi'
    end as verification_summary,
    base.created_at,
    base.deactivated_at is not null as deactivated,
    base.deletion_pending,
    counted.total
  from base
  cross join counted
  order by base.created_at desc
  limit safe_limit
  offset safe_offset;
end;
$$;

revoke all on function public.list_student_account_ops(
  text, text, integer, integer
) from public, anon;
grant execute on function public.list_student_account_ops(
  text, text, integer, integer
) to authenticated;
