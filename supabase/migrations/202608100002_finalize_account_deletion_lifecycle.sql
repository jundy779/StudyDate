-- Account deletion lifecycle finalization (LOCAL-ONLY).
-- Forward-only follow-up to 202608100001. This migration preserves shared
-- history with tombstones and exposes cleanup only to service_role.

-- ---------------------------------------------------------------------------
-- 1. Central policy and retryable queue
-- ---------------------------------------------------------------------------

create table public.account_privacy_policy (
  singleton boolean primary key default true check (singleton),
  moderation_retention_days smallint not null default 180
    check (moderation_retention_days between 1 and 365),
  security_audit_retention_days smallint not null default 180
    check (security_audit_retention_days between 1 and 365),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger account_privacy_policy_set_updated_at
before update on public.account_privacy_policy
for each row execute function public.set_updated_at();

insert into public.account_privacy_policy (singleton)
values (true);

comment on table public.account_privacy_policy is
  'Single documented limited-rollout retention policy; revise only by approved policy change.';

alter table public.account_privacy_policy enable row level security;
revoke all on table public.account_privacy_policy
  from public, anon, authenticated;

alter table public.account_deletion_requests
  add column lease_token uuid null,
  add column lease_expires_at timestamptz null,
  add column database_cleanup_at timestamptz null,
  add column auth_deleted_at timestamptz null;

alter table public.account_deletion_requests
  add constraint account_deletion_requests_lease_consistency check (
    (lease_token is null and lease_expires_at is null)
    or (lease_token is not null and lease_expires_at is not null)
  );

create table public.account_deletion_audit_events (
  id uuid primary key default gen_random_uuid(),
  deletion_request_id uuid not null
    references public.account_deletion_requests (id) on delete cascade,
  event_type text not null check (
    event_type in ('claimed', 'database_cleaned', 'failed', 'completed')
  ),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index account_deletion_audit_events_once_idx
  on public.account_deletion_audit_events (deletion_request_id, event_type)
  where event_type in ('database_cleaned', 'completed');

comment on table public.account_deletion_audit_events is
  'Sanitized deletion operations audit. No user ID, email, path, private content, or raw error.';

alter table public.account_deletion_audit_events enable row level security;
revoke all on table public.account_deletion_audit_events
  from public, anon, authenticated;

alter table public.user_reports
  add column account_deletion_request_id uuid null
    references public.account_deletion_requests (id) on delete set null;

alter table public.introduction_events
  add column account_deletion_request_id uuid null
    references public.account_deletion_requests (id) on delete cascade;
alter table public.conversation_events
  add column account_deletion_request_id uuid null
    references public.account_deletion_requests (id) on delete cascade;
alter table public.study_circle_events
  add column account_deletion_request_id uuid null
    references public.account_deletion_requests (id) on delete cascade;
alter table public.campus_event_audit_events
  add column account_deletion_request_id uuid null
    references public.account_deletion_requests (id) on delete cascade;

create index user_reports_account_deletion_retention_idx
  on public.user_reports (
    account_deletion_request_id,
    moderation_status,
    resolved_at
  )
  where account_deletion_request_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Shared-history references must survive Auth deletion
-- ---------------------------------------------------------------------------

alter table public.introduction_requests
  alter column sender_id drop not null,
  alter column recipient_id drop not null,
  drop constraint introduction_requests_sender_id_fkey,
  drop constraint introduction_requests_recipient_id_fkey,
  add constraint introduction_requests_sender_id_fkey
    foreign key (sender_id) references auth.users (id) on delete set null,
  add constraint introduction_requests_recipient_id_fkey
    foreign key (recipient_id) references auth.users (id) on delete set null;

alter table public.conversation_shells
  alter column participant_sender_id drop not null,
  alter column participant_recipient_id drop not null,
  drop constraint conversation_shells_participant_sender_id_fkey,
  drop constraint conversation_shells_participant_recipient_id_fkey,
  add constraint conversation_shells_participant_sender_id_fkey
    foreign key (participant_sender_id) references auth.users (id) on delete set null,
  add constraint conversation_shells_participant_recipient_id_fkey
    foreign key (participant_recipient_id) references auth.users (id) on delete set null;

alter table public.introduction_events
  alter column actor_user_id drop not null,
  drop constraint introduction_events_actor_user_id_fkey,
  add constraint introduction_events_actor_user_id_fkey
    foreign key (actor_user_id) references auth.users (id) on delete set null;

alter table public.anonymous_messages
  alter column sender_id drop not null,
  drop constraint anonymous_messages_sender_id_fkey,
  add constraint anonymous_messages_sender_id_fkey
    foreign key (sender_id) references auth.users (id) on delete set null;

alter table public.user_reports
  alter column reporter_id drop not null,
  alter column subject_user_id drop not null,
  drop constraint user_reports_reporter_id_fkey,
  drop constraint user_reports_subject_user_id_fkey,
  add constraint user_reports_reporter_id_fkey
    foreign key (reporter_id) references auth.users (id) on delete set null,
  add constraint user_reports_subject_user_id_fkey
    foreign key (subject_user_id) references auth.users (id) on delete set null;

alter table public.study_circles
  alter column owner_user_id drop not null,
  drop constraint study_circles_owner_user_id_fkey,
  add constraint study_circles_owner_user_id_fkey
    foreign key (owner_user_id) references auth.users (id) on delete set null;

alter table public.study_circle_memberships
  alter column user_id drop not null,
  drop constraint study_circle_memberships_user_id_fkey,
  add constraint study_circle_memberships_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete set null;

alter table public.study_circle_messages
  alter column author_user_id drop not null,
  drop constraint study_circle_messages_author_user_id_fkey,
  add constraint study_circle_messages_author_user_id_fkey
    foreign key (author_user_id) references auth.users (id) on delete set null;

alter table public.campus_events
  alter column organizer_user_id drop not null,
  drop constraint campus_events_organizer_user_id_fkey,
  add constraint campus_events_organizer_user_id_fkey
    foreign key (organizer_user_id) references auth.users (id) on delete set null;

alter table public.campus_event_rsvps
  alter column user_id drop not null,
  drop constraint campus_event_rsvps_user_id_fkey,
  add constraint campus_event_rsvps_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 3. Shared privacy-lock helper and narrow student request
-- ---------------------------------------------------------------------------

create or replace function public.is_account_deletion_locked(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is null or exists (
    select 1
    from public.account_deletion_requests deletion
    where deletion.user_id = p_user_id
      and deletion.status in ('pending', 'processing', 'failed')
  );
$$;

revoke all on function public.is_account_deletion_locked(uuid)
  from public, anon, authenticated;

create or replace function public.request_my_student_account_deletion()
returns table (status text, requested_at timestamptz)
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
  if exists (
    select 1 from public.staff_members staff where staff.user_id = actor
  ) then
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

revoke all on function public.request_my_student_account_deletion()
  from public, anon, authenticated;
grant execute on function public.request_my_student_account_deletion()
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Service-only queue and cleanup contracts
-- ---------------------------------------------------------------------------

create or replace function public.claim_account_deletion_job()
returns table (
  request_id uuid,
  user_id uuid,
  lease_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.account_deletion_requests%rowtype;
  new_lease uuid := gen_random_uuid();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select * into target
  from public.account_deletion_requests deletion
  where (
      deletion.status in ('pending', 'failed')
      or (
        deletion.status = 'processing'
        and deletion.lease_expires_at < timezone('utc', now())
      )
    )
    and (
      deletion.user_id is not null
      or deletion.database_cleanup_at is not null
    )
  order by deletion.requested_at
  for update skip locked
  limit 1;

  if target.id is null then
    return;
  end if;

  update public.account_deletion_requests
  set
    status = 'processing',
    processing_at = coalesce(processing_at, timezone('utc', now())),
    failed_at = null,
    failure_code = null,
    retry_count = retry_count + 1,
    lease_token = new_lease,
    lease_expires_at = timezone('utc', now()) + interval '15 minutes'
  where id = target.id;

  insert into public.account_deletion_audit_events (
    deletion_request_id, event_type
  ) values (target.id, 'claimed');

  return query select target.id, target.user_id, new_lease;
end;
$$;

create or replace function public.list_account_deletion_storage_objects(
  p_request_id uuid,
  p_lease_token uuid
)
returns table (bucket_name text, object_key text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  cleanup_done boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select deletion.user_id, deletion.database_cleanup_at is not null
  into target_user_id, cleanup_done
  from public.account_deletion_requests deletion
  where deletion.id = p_request_id
    and deletion.status = 'processing'
    and deletion.lease_token = p_lease_token
    and deletion.lease_expires_at >= timezone('utc', now());

  if not found then
    raise exception 'deletion lease unavailable' using errcode = '42501';
  end if;
  if target_user_id is null and cleanup_done then return; end if;
  if target_user_id is null then
    raise exception 'deletion target unavailable' using errcode = '42501';
  end if;

  return query
  select 'identity-reveal-photos'::text, version.photo_object_key
  from public.identity_reveal_profile_versions version
  where version.owner_user_id = target_user_id
  union
  select 'student-verification-evidence'::text, request.evidence_path
  from public.student_verification_requests request
  where request.user_id = target_user_id and request.evidence_path is not null
  union
  select 'student-verification-evidence'::text, request.pddikti_evidence_path
  from public.student_verification_requests request
  where request.user_id = target_user_id
    and request.pddikti_evidence_path is not null;
end;
$$;

create or replace function public.cleanup_account_deletion_database(
  p_request_id uuid,
  p_lease_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  cleanup_done boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select deletion.user_id, deletion.database_cleanup_at is not null
  into target_user_id, cleanup_done
  from public.account_deletion_requests deletion
  where deletion.id = p_request_id
    and deletion.status = 'processing'
    and deletion.lease_token = p_lease_token
    and deletion.lease_expires_at >= timezone('utc', now())
  for update;

  if not found then
    raise exception 'deletion lease unavailable' using errcode = '42501';
  end if;
  if target_user_id is null and cleanup_done then return; end if;
  if target_user_id is null then
    raise exception 'deletion target unavailable' using errcode = '42501';
  end if;

  update public.study_circles
  set
    status = 'archived',
    archived_at = coalesce(archived_at, timezone('utc', now())),
    updated_at = timezone('utc', now())
  where owner_user_id = target_user_id
    and status <> 'archived';

  update public.campus_events
  set
    status = 'cancelled',
    cancelled_at = coalesce(cancelled_at, timezone('utc', now())),
    updated_at = timezone('utc', now())
  where organizer_user_id = target_user_id
    and status = 'scheduled'
    and starts_at > timezone('utc', now());

  update public.user_reports
  set account_deletion_request_id = p_request_id
  where (reporter_id = target_user_id or subject_user_id = target_user_id)
    and moderation_status in (
      'submitted', 'under_review', 'resolved', 'dismissed'
    );

  update public.introduction_events
  set account_deletion_request_id = p_request_id
  where actor_user_id = target_user_id;
  update public.conversation_events
  set account_deletion_request_id = p_request_id
  where actor_id = target_user_id;
  update public.study_circle_events
  set account_deletion_request_id = p_request_id
  where actor_user_id = target_user_id;
  update public.campus_event_audit_events
  set account_deletion_request_id = p_request_id
  where actor_user_id = target_user_id;

  -- ponytail: no cross-account suspension ledger exists yet; active reports
  -- retain moderation evidence, but recreation prevention needs that subsystem.
  delete from public.user_blocks
  where blocker_id = target_user_id or blocked_id = target_user_id;
  delete from public.conversation_mutual_interests
  where participant_id = target_user_id;
  delete from public.study_circle_memberships
  where user_id = target_user_id;
  delete from public.campus_event_rsvps
  where user_id = target_user_id;
  delete from public.study_circle_rate_limits
  where actor_user_id = target_user_id;
  delete from public.campus_event_rate_limits
  where actor_user_id = target_user_id;

  delete from public.conversation_contact_reveals reveal
  where exists (
    select 1
    from public.conversation_contact_versions version
    where version.owner_user_id = target_user_id
      and version.id in (
        reveal.sender_contact_version_id,
        reveal.recipient_contact_version_id
      )
  );
  delete from public.conversation_contact_reveal_consents
  where participant_id = target_user_id;
  delete from public.conversation_contact_versions
  where owner_user_id = target_user_id;

  delete from public.conversation_identity_reveals reveal
  where exists (
    select 1
    from public.identity_reveal_profile_versions version
    where version.owner_user_id = target_user_id
      and version.id in (
        reveal.sender_profile_version_id,
        reveal.recipient_profile_version_id
      )
  );
  delete from public.conversation_identity_reveal_consents
  where participant_id = target_user_id;
  delete from public.identity_reveal_profile_versions
  where owner_user_id = target_user_id;

  delete from public.student_verification_requests
  where user_id = target_user_id;
  delete from public.onboarding_academic_claims
  where user_id = target_user_id;
  delete from public.student_social_contacts
  where user_id = target_user_id;
  delete from public.privacy_preferences
  where user_id = target_user_id;
  delete from public.user_consents
  where user_id = target_user_id;
  delete from public.user_notifications
  where recipient_user_id = target_user_id;
  delete from public.profiles
  where user_id = target_user_id;

  update public.account_deletion_requests
  set database_cleanup_at = coalesce(
    database_cleanup_at,
    timezone('utc', now())
  )
  where id = p_request_id;

  if not exists (
    select 1
    from public.account_deletion_audit_events event
    where event.deletion_request_id = p_request_id
      and event.event_type = 'database_cleaned'
  ) then
    insert into public.account_deletion_audit_events (
      deletion_request_id, event_type
    ) values (p_request_id, 'database_cleaned');
  end if;
end;
$$;

create or replace function public.complete_account_deletion_job(
  p_request_id uuid,
  p_lease_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  update public.account_deletion_requests
  set
    status = 'completed',
    auth_deleted_at = coalesce(auth_deleted_at, timezone('utc', now())),
    completed_at = coalesce(completed_at, timezone('utc', now())),
    failed_at = null,
    failure_code = null,
    lease_token = null,
    lease_expires_at = null
  where id = p_request_id
    and status = 'processing'
    and lease_token = p_lease_token
    and database_cleanup_at is not null
    and user_id is null;

  if not found then
    if exists (
      select 1
      from public.account_deletion_requests deletion
      where deletion.id = p_request_id and deletion.status = 'completed'
    ) then
      return;
    end if;
    raise exception 'deletion completion unavailable' using errcode = '42501';
  end if;

  insert into public.account_deletion_audit_events (
    deletion_request_id, event_type
  ) values (p_request_id, 'completed')
  on conflict do nothing;
end;
$$;

create or replace function public.fail_account_deletion_job(
  p_request_id uuid,
  p_lease_token uuid,
  p_failure_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_failure_code not in (
    'storage_cleanup_failed',
    'database_cleanup_failed',
    'auth_cleanup_failed',
    'finalize_failed'
  ) then
    raise exception 'invalid failure category' using errcode = '22023';
  end if;

  update public.account_deletion_requests
  set
    status = 'failed',
    failed_at = timezone('utc', now()),
    failure_code = p_failure_code,
    lease_token = null,
    lease_expires_at = null
  where id = p_request_id
    and status = 'processing'
    and lease_token = p_lease_token;

  if found then
    insert into public.account_deletion_audit_events (
      deletion_request_id, event_type
    ) values (p_request_id, 'failed');
  end if;
end;
$$;

create or replace function public.purge_expired_account_deletion_retention(
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  policy public.account_privacy_policy%rowtype;
  removed integer := 0;
  affected integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select * into policy
  from public.account_privacy_policy
  where singleton = true;

  with due as (
    select report.id
    from public.user_reports report
    where report.account_deletion_request_id is not null
      and report.moderation_status in ('resolved', 'dismissed')
      and report.resolved_at is not null
      and report.resolved_at
        <= timezone('utc', now())
          - make_interval(days => policy.moderation_retention_days)
    order by report.resolved_at
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  )
  delete from public.user_reports report
  using due
  where report.id = due.id;
  get diagnostics removed = row_count;

  with due as (
    select event.id
    from public.account_deletion_audit_events event
    where event.created_at
      <= timezone('utc', now())
        - make_interval(days => policy.security_audit_retention_days)
    order by event.created_at
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  )
  delete from public.account_deletion_audit_events event
  using due
  where event.id = due.id;
  get diagnostics affected = row_count;
  removed := removed + affected;

  with due as (
    select deletion.id
    from public.account_deletion_requests deletion
    where deletion.status = 'completed'
      and deletion.completed_at
        <= timezone('utc', now())
          - make_interval(days => policy.security_audit_retention_days)
    order by deletion.completed_at
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ),
  removed_events as (
    delete from public.introduction_events event
    using due
    where event.account_deletion_request_id = due.id
    returning 1
  )
  select count(*)::integer into affected from removed_events;
  removed := removed + affected;

  with due as (
    select deletion.id
    from public.account_deletion_requests deletion
    where deletion.status = 'completed'
      and deletion.completed_at
        <= timezone('utc', now())
          - make_interval(days => policy.security_audit_retention_days)
    order by deletion.completed_at
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ),
  removed_events as (
    delete from public.conversation_events event
    using due
    where event.account_deletion_request_id = due.id
    returning 1
  )
  select count(*)::integer into affected from removed_events;
  removed := removed + affected;

  with due as (
    select deletion.id
    from public.account_deletion_requests deletion
    where deletion.status = 'completed'
      and deletion.completed_at
        <= timezone('utc', now())
          - make_interval(days => policy.security_audit_retention_days)
    order by deletion.completed_at
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ),
  removed_events as (
    delete from public.study_circle_events event
    using due
    where event.account_deletion_request_id = due.id
    returning 1
  )
  select count(*)::integer into affected from removed_events;
  removed := removed + affected;

  with due as (
    select deletion.id
    from public.account_deletion_requests deletion
    where deletion.status = 'completed'
      and deletion.completed_at
        <= timezone('utc', now())
          - make_interval(days => policy.security_audit_retention_days)
    order by deletion.completed_at
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ),
  removed_events as (
    delete from public.campus_event_audit_events event
    using due
    where event.account_deletion_request_id = due.id
    returning 1
  )
  select count(*)::integer into affected from removed_events;
  removed := removed + affected;

  return removed;
end;
$$;

revoke all on function public.claim_account_deletion_job()
  from public, anon, authenticated;
grant execute on function public.claim_account_deletion_job() to service_role;
revoke all on function public.list_account_deletion_storage_objects(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.list_account_deletion_storage_objects(uuid, uuid)
  to service_role;
revoke all on function public.cleanup_account_deletion_database(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cleanup_account_deletion_database(uuid, uuid)
  to service_role;
revoke all on function public.complete_account_deletion_job(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.complete_account_deletion_job(uuid, uuid)
  to service_role;
revoke all on function public.fail_account_deletion_job(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.fail_account_deletion_job(uuid, uuid, text)
  to service_role;
revoke all on function public.purge_expired_account_deletion_retention(integer)
  from public, anon, authenticated;
grant execute on function public.purge_expired_account_deletion_retention(integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5. Historical member/attendee projections retain deletion tombstones
-- ---------------------------------------------------------------------------

create or replace function public.list_study_circle_members(p_public_slug text)
returns table (
  public_alias text, campus text, study_program text, semester smallint,
  interests text[], connection_goals text[], is_verified boolean,
  circle_role text, joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_circle_id uuid;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select circle.id into target_circle_id from public.study_circles circle
    where circle.public_slug = p_public_slug;
  if target_circle_id is null
    or not public.is_active_study_circle_member(target_circle_id, actor) then
    raise exception 'circle membership required' using errcode = '42501';
  end if;

  return query select
    case when public.is_account_deletion_locked(membership.user_id)
      then 'Akun dihapus' else profile.public_alias end,
    case when public.is_account_deletion_locked(membership.user_id)
      then 'Tidak tersedia' else profile.campus end,
    case when public.is_account_deletion_locked(membership.user_id)
      then 'Tidak tersedia' else profile.study_program end,
    case when public.is_account_deletion_locked(membership.user_id)
      then null else profile.semester end,
    case when public.is_account_deletion_locked(membership.user_id)
      then array[]::text[] else profile.interests end,
    case when public.is_account_deletion_locked(membership.user_id)
      then array[]::text[] else profile.connection_goals end,
    case when public.is_account_deletion_locked(membership.user_id)
      then false else profile.verification_status = 'verified' end,
    membership.role, membership.joined_at
  from public.study_circle_memberships membership
  left join public.profiles profile on profile.user_id = membership.user_id
  where membership.circle_id = target_circle_id
    and membership.status = 'active'
  order by case membership.role when 'owner' then 0 else 1 end,
    membership.joined_at asc, profile.public_alias asc nulls last;
end;
$$;

create or replace function public.list_campus_event_attendees(
  p_public_slug text
)
returns table (
  public_alias text, campus text, study_program text, semester smallint,
  interests text[], connection_goals text[], is_verified boolean,
  is_organizer boolean, rsvped_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target public.campus_events%rowtype;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_public_slug is null or p_public_slug !~ '^event-[0-9a-f]{24}$' then
    return;
  end if;
  select * into target from public.campus_events event
    where event.public_slug = p_public_slug;
  if target.id is null or (
    target.organizer_user_id <> actor and not exists (
      select 1 from public.campus_event_rsvps caller
      where caller.event_id = target.id and caller.user_id = actor
        and caller.status = 'going'
    )
  ) then
    raise exception 'rsvp required' using errcode = '42501';
  end if;

  return query select
    case when public.is_account_deletion_locked(rsvp.user_id)
      then 'Akun dihapus' else profile.public_alias end,
    case when public.is_account_deletion_locked(rsvp.user_id)
      then 'Tidak tersedia' else profile.campus end,
    case when public.is_account_deletion_locked(rsvp.user_id)
      then 'Tidak tersedia' else profile.study_program end,
    case when public.is_account_deletion_locked(rsvp.user_id)
      then null else profile.semester end,
    case when public.is_account_deletion_locked(rsvp.user_id)
      then array[]::text[] else profile.interests end,
    case when public.is_account_deletion_locked(rsvp.user_id)
      then array[]::text[] else profile.connection_goals end,
    case when public.is_account_deletion_locked(rsvp.user_id)
      then false else profile.verification_status = 'verified' end,
    rsvp.user_id = target.organizer_user_id, rsvp.rsvped_at
  from public.campus_event_rsvps rsvp
  left join public.profiles profile on profile.user_id = rsvp.user_id
  where rsvp.event_id = target.id
    and rsvp.status = 'going'
    and (
      rsvp.user_id = actor
      or public.is_account_deletion_locked(rsvp.user_id)
      or not public.users_are_blocked(actor, rsvp.user_id)
    )
  order by (rsvp.user_id = target.organizer_user_id) desc,
    rsvp.rsvped_at asc, profile.public_alias asc nulls last;
end;
$$;

revoke all on function public.list_study_circle_members(text)
  from public, anon;
grant execute on function public.list_study_circle_members(text)
  to authenticated;
revoke all on function public.list_campus_event_attendees(text)
  from public, anon;
grant execute on function public.list_campus_event_attendees(text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Identity and Contact Reveal stop serving a deleting counterpart
-- ---------------------------------------------------------------------------

create or replace function public.get_completed_identity_reveal(p_public_id text)
returns table (
  completed boolean,
  completed_at timestamptz,
  mine_first_name text,
  counterpart_first_name text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  reveal public.conversation_identity_reveals%rowtype;
  counterpart_id uuid;
  mine public.identity_reveal_profile_versions%rowtype;
  counterpart public.identity_reveal_profile_versions%rowtype;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;
  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' then
    return query select false, null::timestamptz, null::text, null::text;
    return;
  end if;

  select * into shell from public.conversation_shells candidate
  where candidate.public_id = p_public_id;
  if shell.id is null
    or actor not in (shell.participant_sender_id, shell.participant_recipient_id)
    or shell.identity_revealed_at is null then
    return query select false, null::timestamptz, null::text, null::text;
    return;
  end if;

  select * into reveal from public.conversation_identity_reveals candidate
  where candidate.conversation_id = shell.id;
  if reveal.conversation_id is null then
    return query select false, null::timestamptz, null::text, null::text;
    return;
  end if;

  counterpart_id := public.conversation_counterpart_id(shell.id, actor);
  if actor = shell.participant_sender_id then
    select * into mine from public.identity_reveal_profile_versions version
      where version.id = reveal.sender_profile_version_id;
    select * into counterpart from public.identity_reveal_profile_versions version
      where version.id = reveal.recipient_profile_version_id;
  else
    select * into mine from public.identity_reveal_profile_versions version
      where version.id = reveal.recipient_profile_version_id;
    select * into counterpart from public.identity_reveal_profile_versions version
      where version.id = reveal.sender_profile_version_id;
  end if;

  if public.is_account_deletion_locked(counterpart_id) then
    return query select
      false, null::timestamptz, null::text, null::text;
    return;
  end if;

  return query select true, reveal.revealed_at, mine.first_name,
    case when shell.status = 'blocked'
      or public.users_are_blocked(actor, counterpart_id)
    then null::text else counterpart.first_name end;
end;
$$;

create or replace function public.resolve_identity_reveal_photo_key(
  p_public_id text,
  p_viewer_user_id uuid,
  p_which text
)
returns table (photo_object_key text, photo_content_type text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  shell public.conversation_shells%rowtype;
  reveal public.conversation_identity_reveals%rowtype;
  counterpart_id uuid;
  owner_id uuid;
  version_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_which not in ('mine', 'counterpart')
    or p_public_id is null
    or p_public_id !~ '^[0-9a-f]{32}$'
    or p_viewer_user_id is null then return; end if;

  select * into shell from public.conversation_shells candidate
  where candidate.public_id = p_public_id;
  if shell.id is null
    or p_viewer_user_id not in (
      shell.participant_sender_id, shell.participant_recipient_id
    ) then return; end if;

  select * into reveal from public.conversation_identity_reveals candidate
  where candidate.conversation_id = shell.id;
  if reveal.conversation_id is null then return; end if;

  counterpart_id := public.conversation_counterpart_id(
    shell.id, p_viewer_user_id
  );
  if p_which = 'counterpart' and (
    public.is_account_deletion_locked(counterpart_id)
    or shell.status = 'blocked'
    or public.users_are_blocked(p_viewer_user_id, counterpart_id)
  ) then return; end if;

  owner_id := case when p_which = 'mine' then p_viewer_user_id
    else counterpart_id end;
  if public.is_account_deletion_locked(owner_id) then return; end if;

  version_id := case
    when owner_id = shell.participant_sender_id
      then reveal.sender_profile_version_id
    else reveal.recipient_profile_version_id
  end;
  return query select version.photo_object_key, version.photo_content_type
  from public.identity_reveal_profile_versions version
  where version.id = version_id;
end;
$$;

create or replace function public.get_completed_contact_reveal_cipher(
  p_public_id text,
  p_viewer_user_id uuid,
  p_channel text
)
returns table (
  completed boolean,
  completed_at timestamptz,
  mine_ciphertext bytea,
  mine_iv bytea,
  mine_auth_tag bytea,
  mine_key_version smallint,
  counterpart_ciphertext bytea,
  counterpart_iv bytea,
  counterpart_auth_tag bytea,
  counterpart_key_version smallint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  shell public.conversation_shells%rowtype;
  reveal public.conversation_contact_reveals%rowtype;
  counterpart_id uuid;
  mine public.conversation_contact_versions%rowtype;
  counterpart public.conversation_contact_versions%rowtype;
  hide_counterpart boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$'
    or p_viewer_user_id is null
    or p_channel not in ('telegram', 'instagram', 'linkedin') then
    return query select false, null::timestamptz,
      null::bytea, null::bytea, null::bytea, null::smallint,
      null::bytea, null::bytea, null::bytea, null::smallint;
    return;
  end if;

  select * into shell from public.conversation_shells candidate
  where candidate.public_id = p_public_id;
  if shell.id is null
    or p_viewer_user_id not in (
      shell.participant_sender_id, shell.participant_recipient_id
    ) then
    return query select false, null::timestamptz,
      null::bytea, null::bytea, null::bytea, null::smallint,
      null::bytea, null::bytea, null::bytea, null::smallint;
    return;
  end if;

  select * into reveal from public.conversation_contact_reveals candidate
  where candidate.conversation_id = shell.id
    and candidate.channel = p_channel;
  if reveal.conversation_id is null then
    return query select false, null::timestamptz,
      null::bytea, null::bytea, null::bytea, null::smallint,
      null::bytea, null::bytea, null::bytea, null::smallint;
    return;
  end if;

  counterpart_id := public.conversation_counterpart_id(
    shell.id, p_viewer_user_id
  );
  if p_viewer_user_id = shell.participant_sender_id then
    select * into mine from public.conversation_contact_versions version
      where version.id = reveal.sender_contact_version_id;
    select * into counterpart from public.conversation_contact_versions version
      where version.id = reveal.recipient_contact_version_id;
  else
    select * into mine from public.conversation_contact_versions version
      where version.id = reveal.recipient_contact_version_id;
    select * into counterpart from public.conversation_contact_versions version
      where version.id = reveal.sender_contact_version_id;
  end if;

  if public.is_account_deletion_locked(counterpart_id) then
    return query select false, null::timestamptz,
      null::bytea, null::bytea, null::bytea, null::smallint,
      null::bytea, null::bytea, null::bytea, null::smallint;
    return;
  end if;

  hide_counterpart :=
    shell.status = 'blocked'
    or public.users_are_blocked(p_viewer_user_id, counterpart_id);

  return query select
    true, reveal.revealed_at,
    mine.contact_ciphertext, mine.contact_iv, mine.contact_auth_tag,
    mine.encryption_key_version,
    case when hide_counterpart then null else counterpart.contact_ciphertext end,
    case when hide_counterpart then null else counterpart.contact_iv end,
    case when hide_counterpart then null else counterpart.contact_auth_tag end,
    case when hide_counterpart then null else counterpart.encryption_key_version end;
end;
$$;

revoke all on function public.get_completed_identity_reveal(text)
  from public, anon;
grant execute on function public.get_completed_identity_reveal(text)
  to authenticated;
revoke all on function public.resolve_identity_reveal_photo_key(text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_completed_contact_reveal_cipher(text, uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Tombstone-safe shared projections
-- ---------------------------------------------------------------------------

create or replace function public.list_my_conversations(p_limit integer default 30)
returns table (
  public_id text, status text, counterpart_alias text, campus text,
  study_program text, semester smallint, is_verified boolean,
  preview_body text, last_activity_at timestamptz, unread_count integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 30), 1), 50);
begin
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;
  return query
  select shell.public_id, shell.status,
    case when public.is_account_deletion_locked(counterpart_id.user_id)
      then 'Akun dihapus' else profile.public_alias end,
    case when public.is_account_deletion_locked(counterpart_id.user_id)
      then 'Tidak tersedia' else profile.campus end,
    case when public.is_account_deletion_locked(counterpart_id.user_id)
      then 'Tidak tersedia' else profile.study_program end,
    case when public.is_account_deletion_locked(counterpart_id.user_id)
      then null else profile.semester end,
    case when public.is_account_deletion_locked(counterpart_id.user_id)
      then false else profile.verification_status = 'verified' end,
    (select message.body from public.anonymous_messages message
      where message.conversation_id = shell.id
        and message.moderation_status = 'visible'
      order by message.created_at desc, message.id desc limit 1),
    coalesce(
      (select message.created_at from public.anonymous_messages message
        where message.conversation_id = shell.id
          and message.moderation_status = 'visible'
        order by message.created_at desc, message.id desc limit 1),
      shell.activated_at, shell.created_at
    ),
    (select count(*)::integer from public.anonymous_messages message
      where message.conversation_id = shell.id
        and message.sender_id <> actor and message.read_at is null
        and message.moderation_status = 'visible'),
    shell.created_at
  from public.conversation_shells shell
  cross join lateral (
    select case when shell.participant_sender_id = actor
      then shell.participant_recipient_id
      else shell.participant_sender_id end as user_id
  ) counterpart_id
  left join public.profiles profile on profile.user_id = counterpart_id.user_id
  where actor in (shell.participant_sender_id, shell.participant_recipient_id)
  order by last_activity_at desc nulls last, shell.created_at desc
  limit safe_limit;
end;
$$;

create or replace function public.get_conversation_by_public_id(p_public_id text)
returns table (
  public_id text, status text, counterpart_alias text, campus text,
  study_program text, semester smallint, is_verified boolean,
  created_at timestamptz, activated_at timestamptz, ended_at timestamptz,
  unread_count integer, can_send boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  counterpart_id uuid;
  profile public.profiles%rowtype;
  deleted boolean;
begin
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;
  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' then return; end if;
  select * into shell from public.conversation_shells candidate
    where candidate.public_id = p_public_id;
  if shell.id is null
    or actor not in (
      shell.participant_sender_id, shell.participant_recipient_id
    ) then return; end if;

  counterpart_id := public.conversation_counterpart_id(shell.id, actor);
  deleted := public.is_account_deletion_locked(counterpart_id);
  select * into profile from public.profiles candidate
    where candidate.user_id = counterpart_id;

  return query select shell.public_id, shell.status,
    case when deleted then 'Akun dihapus' else profile.public_alias end,
    case when deleted then 'Tidak tersedia' else profile.campus end,
    case when deleted then 'Tidak tersedia' else profile.study_program end,
    case when deleted then null else profile.semester end,
    case when deleted then false
      else profile.verification_status = 'verified' end,
    shell.created_at, shell.activated_at, shell.ended_at,
    (select count(*)::integer from public.anonymous_messages message
      where message.conversation_id = shell.id
        and message.sender_id <> actor and message.read_at is null
        and message.moderation_status = 'visible'),
    shell.status in ('awaiting_chat', 'active')
      and not deleted
      and not public.users_are_blocked(actor, counterpart_id);
end;
$$;

create or replace function public.list_study_circle_messages(
  p_public_slug text,
  p_before_created_at timestamptz default null,
  p_before_public_id text default null,
  p_limit integer default 51
)
returns table (
  message_public_id text, author_alias text, author_is_verified boolean,
  body text, created_at timestamptz, is_mine boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_circle_id uuid;
  safe_limit integer := least(greatest(coalesce(p_limit, 51), 1), 101);
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if (p_before_created_at is null) <> (p_before_public_id is null)
    or (
      p_before_public_id is not null
      and p_before_public_id !~ '^[0-9a-f]{32}$'
    ) then
    raise exception 'invalid message cursor' using errcode = '22023';
  end if;
  select circle.id into target_circle_id from public.study_circles circle
    where circle.public_slug = p_public_slug;
  if target_circle_id is null
    or not public.is_active_study_circle_member(target_circle_id, actor) then
    raise exception 'circle membership required' using errcode = '42501';
  end if;

  return query select message.public_id,
    case when public.is_account_deletion_locked(message.author_user_id)
      then 'Akun dihapus' else profile.public_alias end,
    case when public.is_account_deletion_locked(message.author_user_id)
      then false else profile.verification_status = 'verified' end,
    message.body, message.created_at, message.author_user_id = actor
  from public.study_circle_messages message
  left join public.profiles profile on profile.user_id = message.author_user_id
  where message.circle_id = target_circle_id
    and message.moderation_status = 'visible'
    and (
      p_before_created_at is null
      or (message.created_at, message.public_id)
        < (p_before_created_at, p_before_public_id)
    )
  order by message.created_at desc, message.public_id desc
  limit safe_limit;
end;
$$;

create or replace function public.get_campus_event(p_public_slug text)
returns table (
  public_slug text, title text, description text, category text, scope text,
  campus_scope text, starts_at timestamptz, ends_at timestamptz,
  timezone_name text, venue_category text, venue_name text, venue_area text,
  city text, capacity integer, attendee_count integer, rsvp_status text,
  is_organizer boolean, organizer_alias text, organizer_is_verified boolean,
  status text, is_past boolean, can_rsvp boolean,
  can_cancel_rsvp boolean, can_edit boolean, schedule_venue_locked boolean,
  can_cancel_event boolean, can_archive boolean,
  cancelled_at timestamptz, archived_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_campus text;
  target public.campus_events%rowtype;
  own_rsvp public.campus_event_rsvps%rowtype;
  going_count integer;
  has_history boolean;
  organizer_deleted boolean;
  blocked boolean;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_public_slug is null or p_public_slug !~ '^event-[0-9a-f]{24}$' then
    return;
  end if;
  select * into target from public.campus_events event
    where event.public_slug = p_public_slug;
  if target.id is null then return; end if;
  select profile.campus into actor_campus from public.profiles profile
    where profile.user_id = actor;
  select * into own_rsvp from public.campus_event_rsvps rsvp
    where rsvp.event_id = target.id and rsvp.user_id = actor;
  has_history := own_rsvp.id is not null;
  blocked := public.users_are_blocked(actor, target.organizer_user_id);
  organizer_deleted := public.is_account_deletion_locked(
    target.organizer_user_id
  );
  if organizer_deleted and not has_history then return; end if;
  if target.status = 'archived'
    and target.organizer_user_id <> actor and not has_history then return; end if;
  if target.scope = 'campus' and target.campus_scope <> actor_campus
    and target.organizer_user_id <> actor and not has_history then return; end if;
  if blocked and target.organizer_user_id <> actor and not has_history then
    return;
  end if;
  select count(*)::integer into going_count
    from public.campus_event_rsvps rsvp
    where rsvp.event_id = target.id and rsvp.status = 'going';

  return query select target.public_slug, target.title, target.description,
    target.category, target.scope, target.campus_scope, target.starts_at,
    target.ends_at, target.timezone_name, target.venue_category,
    target.venue_name, target.venue_area, target.city, target.capacity::integer,
    going_count, own_rsvp.status, target.organizer_user_id = actor,
    case when organizer_deleted then 'Akun dihapus'
      else organizer.public_alias end,
    case when organizer_deleted then false
      else organizer.verification_status = 'verified' end,
    target.status, target.ends_at <= timezone('utc', now()),
    not organizer_deleted
      and target.status = 'scheduled'
      and target.starts_at > timezone('utc', now())
      and target.organizer_user_id <> actor
      and not blocked
      and (target.scope = 'open' or target.campus_scope = actor_campus)
      and own_rsvp.status is distinct from 'going'
      and going_count < target.capacity,
    own_rsvp.status = 'going'
      and target.organizer_user_id <> actor
      and target.status = 'scheduled'
      and target.starts_at > timezone('utc', now()),
    target.organizer_user_id = actor
      and target.status = 'scheduled'
      and target.starts_at > timezone('utc', now()) + interval '2 hours',
    exists (
      select 1 from public.campus_event_rsvps attendee
      where attendee.event_id = target.id
        and attendee.user_id <> target.organizer_user_id
        and attendee.status = 'going'
    ),
    target.organizer_user_id = actor
      and target.status = 'scheduled'
      and target.starts_at > timezone('utc', now()),
    target.organizer_user_id = actor
      and target.status <> 'archived'
      and (
        target.status = 'cancelled'
        or target.ends_at <= timezone('utc', now())
      ),
    target.cancelled_at, target.archived_at
  from (select 1) seed
  left join public.profiles organizer
    on organizer.user_id = target.organizer_user_id;
end;
$$;

revoke all on function public.list_my_conversations(integer) from public, anon;
grant execute on function public.list_my_conversations(integer) to authenticated;
revoke all on function public.get_conversation_by_public_id(text)
  from public, anon;
grant execute on function public.get_conversation_by_public_id(text)
  to authenticated;
revoke all on function public.list_study_circle_messages(
  text, timestamptz, text, integer
) from public, anon;
grant execute on function public.list_study_circle_messages(
  text, timestamptz, text, integer
) to authenticated;
revoke all on function public.get_campus_event(text) from public, anon;
grant execute on function public.get_campus_event(text) to authenticated;
