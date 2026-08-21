-- Launch operations clarity + Identity Reveal media hardening.
-- Forward-only. Apply remotely only after explicit preflight approval.

-- ---------------------------------------------------------------------------
-- 1. Safe student support references and projections
-- ---------------------------------------------------------------------------

create or replace function public.student_account_ops_ref(p_user_id uuid)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when p_user_id is null then null
    else 'akun-' || left(
      encode(extensions.digest(p_user_id::text, 'sha256'), 'hex'),
      16
    )
  end;
$$;

revoke all on function public.student_account_ops_ref(uuid)
  from public, anon, authenticated;

create or replace function public.mask_account_email(p_email text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when nullif(btrim(coalesce(p_email, '')), '') is null
      or position('@' in p_email) <= 1
      then 'Email tidak tersedia'
    else
      left(split_part(lower(p_email), '@', 1), 2)
      || '***@'
      || split_part(lower(p_email), '@', 2)
  end;
$$;

revoke all on function public.mask_account_email(text)
  from public, anon, authenticated;

alter table public.staff_ops_audit_events
  drop constraint if exists staff_ops_audit_events_type_allowed;

alter table public.staff_ops_audit_events
  add constraint staff_ops_audit_events_type_allowed check (
    event_type in (
      'early_access_viewed',
      'user_support_viewed',
      'student_account_viewed',
      'staff_capability_changed',
      'staff_assigned_by_email'
    )
  );

drop function if exists public.list_student_account_ops(
  text, text, integer, integer
);

create function public.list_student_account_ops(
  p_alias text default null,
  p_email text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  account_ref text,
  alias text,
  email_display text,
  account_status text,
  onboarding_status text,
  campus text,
  study_program text,
  semester smallint,
  is_discoverable boolean,
  verification_summary text,
  membership_plan text,
  created_at timestamptz,
  deactivated boolean,
  deletion_pending boolean,
  total_count bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  safe_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  normalized_alias text :=
    nullif(lower(btrim(coalesce(p_alias, ''))), '');
  normalized_email text :=
    nullif(lower(btrim(coalesce(p_email, ''))), '');
  actor uuid := auth.uid();
begin
  if not public.staff_has_ops_capability('users.read') then
    raise exception 'users read authorization required' using errcode = '42501';
  end if;

  if normalized_email is not null
    and not public.staff_has_ops_capability('users.support') then
    raise exception 'users support authorization required' using errcode = '42501';
  end if;

  if normalized_email is not null then
    insert into public.staff_ops_audit_events (actor_user_id, event_type)
    values (actor, 'user_support_viewed');
  end if;

  return query
  with base as (
    select
      auth_user.id as user_id,
      auth_user.email as auth_email,
      auth_user.created_at as auth_created_at,
      profile.public_alias,
      profile.campus,
      profile.study_program,
      profile.semester,
      coalesce(profile.is_discoverable, false) as is_discoverable,
      coalesce(profile.verification_status, 'unverified') as verification_status,
      profile.onboarding_completed_at,
      profile.deactivated_at,
      exists (
        select 1
        from public.account_deletion_requests deletion
        where deletion.user_id = auth_user.id
          and deletion.status in ('pending', 'processing', 'failed')
      ) as deletion_pending
    from auth.users auth_user
    left join public.profiles profile on profile.user_id = auth_user.id
    where not exists (
      select 1
      from public.staff_members staff
      where staff.user_id = auth_user.id
        and staff.status = 'active'
    )
      and (
        normalized_alias is null
        or lower(coalesce(profile.public_alias, '')) = normalized_alias
      )
      and (
        normalized_email is null
        or lower(coalesce(auth_user.email, '')) = normalized_email
      )
  ),
  counted as (
    select count(*)::bigint as total from base
  )
  select
    public.student_account_ops_ref(base.user_id),
    coalesce(base.public_alias, 'Belum onboarding'),
    public.mask_account_email(base.auth_email),
    case
      when base.deletion_pending then 'Penghapusan diproses'
      when base.deactivated_at is not null then 'Dinonaktifkan'
      else 'Aktif'
    end,
    case
      when base.onboarding_completed_at is not null then 'Onboarding selesai'
      else 'Onboarding belum selesai'
    end,
    coalesce(base.campus, 'Belum diisi'),
    coalesce(base.study_program, 'Belum diisi'),
    base.semester,
    base.is_discoverable,
    case base.verification_status
      when 'verified' then 'Terverifikasi'
      when 'pending' then 'Sedang diproses'
      when 'rejected' then 'Perlu tindakan'
      else 'Belum diverifikasi'
    end,
    case public.effective_membership_plan(base.user_id)
      when 'plus' then 'StudyDate Plus'
      else 'StudyDate Free'
    end,
    base.auth_created_at,
    base.deactivated_at is not null,
    base.deletion_pending,
    counted.total
  from base
  cross join counted
  order by base.auth_created_at desc
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

create or replace function public.get_student_account_ops_detail(
  p_account_ref text
)
returns table (
  account_ref text,
  alias text,
  email_display text,
  account_status text,
  onboarding_status text,
  campus text,
  study_program text,
  degree_level text,
  semester smallint,
  city_region text,
  short_intro text,
  interests text[],
  connection_goals text[],
  is_discoverable boolean,
  verification_summary text,
  membership_plan text,
  membership_ends_at timestamptz,
  created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_user_id uuid;
begin
  if not public.staff_has_ops_capability('users.read') then
    raise exception 'users read authorization required' using errcode = '42501';
  end if;

  if p_account_ref is null
    or p_account_ref !~ '^akun-[a-f0-9]{16}$' then
    return;
  end if;

  select auth_user.id
  into target_user_id
  from auth.users auth_user
  where public.student_account_ops_ref(auth_user.id) = p_account_ref
    and not exists (
      select 1
      from public.staff_members staff
      where staff.user_id = auth_user.id
        and staff.status = 'active'
    )
  limit 1;

  if target_user_id is null then
    return;
  end if;

  insert into public.staff_ops_audit_events (
    actor_user_id,
    event_type,
    subject_suffix
  )
  values (
    actor,
    'student_account_viewed',
    right(p_account_ref, 8)
  );

  return query
  select
    p_account_ref,
    coalesce(profile.public_alias, 'Belum onboarding'),
    public.mask_account_email(auth_user.email),
    case
      when exists (
        select 1
        from public.account_deletion_requests deletion
        where deletion.user_id = auth_user.id
          and deletion.status in ('pending', 'processing', 'failed')
      ) then 'Penghapusan diproses'
      when profile.deactivated_at is not null then 'Dinonaktifkan'
      else 'Aktif'
    end,
    case
      when profile.onboarding_completed_at is not null then 'Onboarding selesai'
      else 'Onboarding belum selesai'
    end,
    coalesce(profile.campus, 'Belum diisi'),
    coalesce(profile.study_program, 'Belum diisi'),
    coalesce(profile.degree_level, 'Belum diisi'),
    profile.semester,
    coalesce(profile.city_region, 'Belum diisi'),
    coalesce(profile.short_intro, 'Belum ada bio.'),
    coalesce(profile.interests, '{}'::text[]),
    coalesce(profile.connection_goals, '{}'::text[]),
    coalesce(profile.is_discoverable, false),
    case coalesce(profile.verification_status, 'unverified')
      when 'verified' then 'Terverifikasi'
      when 'pending' then 'Sedang diproses'
      when 'rejected' then 'Perlu tindakan'
      else 'Belum diverifikasi'
    end,
    case public.effective_membership_plan(auth_user.id)
      when 'plus' then 'StudyDate Plus'
      else 'StudyDate Free'
    end,
    (
      select entitlement.ends_at
      from public.user_entitlements entitlement
      where entitlement.user_id = auth_user.id
        and entitlement.plan_code = 'plus'
        and entitlement.status = 'active'
        and entitlement.starts_at <= timezone('utc', now())
        and (
          entitlement.ends_at is null
          or entitlement.ends_at > timezone('utc', now())
        )
      order by entitlement.ends_at desc nulls first
      limit 1
    ),
    auth_user.created_at
  from auth.users auth_user
  left join public.profiles profile on profile.user_id = auth_user.id
  where auth_user.id = target_user_id;
end;
$$;

revoke all on function public.get_student_account_ops_detail(text)
  from public, anon;
grant execute on function public.get_student_account_ops_detail(text)
  to authenticated;

create or replace function public.list_staff_ops_audit_events(
  p_limit integer default 50
)
returns table (
  actor_suffix text,
  event_type text,
  subject_suffix text,
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
  select
    case
      when event.actor_user_id is null then null
      else right(event.actor_user_id::text, 8)
    end,
    event.event_type,
    event.subject_suffix,
    event.created_at
  from public.staff_ops_audit_events event
  order by event.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

revoke all on function public.list_staff_ops_audit_events(integer)
  from public, anon;
grant execute on function public.list_staff_ops_audit_events(integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Durable cleanup queue for superseded/orphan Identity Reveal photos
-- ---------------------------------------------------------------------------

create table if not exists public.identity_reveal_photo_cleanup_queue (
  object_key text primary key,
  profile_version_id uuid null,
  created_at timestamptz not null default timezone('utc', now()),
  attempt_count integer not null default 0,
  last_attempt_at timestamptz null,
  constraint identity_reveal_photo_cleanup_key_format check (
    object_key ~ '^[a-f0-9]{32}/[a-f0-9]{32}\.jpg$'
  ),
  constraint identity_reveal_photo_cleanup_attempt_nonnegative check (
    attempt_count >= 0
  )
);

alter table public.identity_reveal_photo_cleanup_queue enable row level security;
revoke all on table public.identity_reveal_photo_cleanup_queue
  from public, anon, authenticated;

create or replace function public.queue_superseded_identity_reveal_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.superseded_at is null and new.superseded_at is not null then
    insert into public.identity_reveal_photo_cleanup_queue (
      object_key,
      profile_version_id
    )
    values (new.photo_object_key, new.id)
    on conflict (object_key) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.queue_superseded_identity_reveal_photo()
  from public, anon, authenticated;

drop trigger if exists identity_reveal_profile_versions_queue_cleanup
  on public.identity_reveal_profile_versions;
create trigger identity_reveal_profile_versions_queue_cleanup
after update of superseded_at on public.identity_reveal_profile_versions
for each row
execute function public.queue_superseded_identity_reveal_photo();

create or replace function public.enqueue_identity_reveal_orphan_photo(
  p_object_key text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_object_key is null
    or p_object_key !~ '^[a-f0-9]{32}/[a-f0-9]{32}\.jpg$' then
    raise exception 'invalid photo key' using errcode = '22023';
  end if;

  insert into public.identity_reveal_photo_cleanup_queue (
    object_key,
    profile_version_id
  )
  values (p_object_key, null)
  on conflict (object_key) do nothing;
end;
$$;

revoke all on function public.enqueue_identity_reveal_orphan_photo(text)
  from public, anon, authenticated;
grant execute on function public.enqueue_identity_reveal_orphan_photo(text)
  to service_role;

create or replace function public.list_identity_reveal_photo_cleanup_candidates(
  p_limit integer default 50
)
returns table (
  object_key text,
  profile_version_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  return query
  with candidates as (
    select candidate.object_key
    from public.identity_reveal_photo_cleanup_queue candidate
    where (
        candidate.last_attempt_at is null
        or candidate.last_attempt_at
          < timezone('utc', now()) - interval '15 minutes'
      )
      and (
        candidate.profile_version_id is null
        or (
          not exists (
            select 1
            from public.conversation_identity_reveals reveal
            where reveal.sender_profile_version_id = candidate.profile_version_id
              or reveal.recipient_profile_version_id = candidate.profile_version_id
          )
          and not exists (
            select 1
            from public.conversation_identity_reveal_consents consent
            where consent.profile_version_id = candidate.profile_version_id
              and consent.withdrawn_at is null
          )
        )
      )
    order by candidate.created_at asc
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
    for update skip locked
  ),
  claimed as (
    update public.identity_reveal_photo_cleanup_queue queue
    set
      attempt_count = queue.attempt_count + 1,
      last_attempt_at = timezone('utc', now())
    from candidates
    where queue.object_key = candidates.object_key
    returning queue.object_key, queue.profile_version_id
  )
  select claimed.object_key, claimed.profile_version_id
  from claimed;
end;
$$;

revoke all on function public.list_identity_reveal_photo_cleanup_candidates(integer)
  from public, anon, authenticated;
grant execute on function public.list_identity_reveal_photo_cleanup_candidates(integer)
  to service_role;

create or replace function public.finalize_identity_reveal_photo_cleanup(
  p_object_key text,
  p_profile_version_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if p_profile_version_id is not null then
    if exists (
      select 1
      from public.conversation_identity_reveals reveal
      where reveal.sender_profile_version_id = p_profile_version_id
        or reveal.recipient_profile_version_id = p_profile_version_id
    ) then
      raise exception 'completed reveal photo must be retained'
        using errcode = '42501';
    end if;

    delete from public.conversation_identity_reveal_consents consent
    where consent.profile_version_id = p_profile_version_id
      and consent.withdrawn_at is not null;

    delete from public.identity_reveal_profile_versions version
    where version.id = p_profile_version_id
      and version.photo_object_key = p_object_key
      and version.superseded_at is not null
      and not exists (
        select 1
        from public.conversation_identity_reveal_consents consent
        where consent.profile_version_id = version.id
      );

    if found then
      delete from public.identity_reveal_photo_cleanup_queue queue
      where queue.object_key = p_object_key;
    end if;
    return;
  end if;

  delete from public.identity_reveal_photo_cleanup_queue queue
  where queue.object_key = p_object_key
    and queue.profile_version_id is null;
end;
$$;

revoke all on function public.finalize_identity_reveal_photo_cleanup(text, uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_identity_reveal_photo_cleanup(text, uuid)
  to service_role;

-- Any version deletion also clears its queued work (including account deletion).
create or replace function public.drop_identity_reveal_photo_cleanup_for_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.identity_reveal_photo_cleanup_queue queue
  where queue.object_key = old.photo_object_key;
  return old;
end;
$$;

revoke all on function public.drop_identity_reveal_photo_cleanup_for_version()
  from public, anon, authenticated;

drop trigger if exists identity_reveal_profile_versions_drop_cleanup
  on public.identity_reveal_profile_versions;
create trigger identity_reveal_profile_versions_drop_cleanup
before delete on public.identity_reveal_profile_versions
for each row
execute function public.drop_identity_reveal_photo_cleanup_for_version();
