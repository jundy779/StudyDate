-- Close live-audit gaps found after Account & Privacy Controls v1 deployment.
-- Forward-only: 202608100001 and 202608100002 are already applied remotely.

-- The request must lock the profile before creating the queue row so the
-- generic locked-account write guard can reject every later student mutation.
create or replace function public.request_my_student_account_deletion()
returns table (status text, requested_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_profile public.profiles%rowtype;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.staff_members staff where staff.user_id = actor
  ) then
    raise exception 'student account required' using errcode = '42501';
  end if;

  select * into target_profile
  from public.profiles profile
  where profile.user_id = actor
  for update;

  if target_profile.user_id is null
    or target_profile.onboarding_completed_at is null then
    raise exception 'completed profile required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.account_deletion_requests deletion
    where deletion.user_id = actor
  ) then
    update public.profiles
    set
      is_discoverable = false,
      deactivated_at = coalesce(deactivated_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
    where user_id = actor;

    insert into public.account_deletion_requests (user_id, status)
    values (actor, 'pending');
  end if;

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

-- Defense in depth for legacy RPCs that predate the shared eligibility helper.
-- A trusted service operation has no student auth.uid() and remains unaffected.
create or replace function public.reject_account_deletion_locked_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is not null and public.is_account_deletion_locked(actor) then
    raise exception 'account unavailable' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.reject_account_deletion_locked_mutation()
  from public, anon, authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'profiles',
    'onboarding_academic_claims',
    'privacy_preferences',
    'user_consents',
    'student_social_contacts',
    'campus_options',
    'study_program_options',
    'student_verification_requests',
    'introduction_requests',
    'conversation_shells',
    'anonymous_messages',
    'conversation_mutual_interests',
    'conversation_identity_reveal_consents',
    'conversation_contact_reveal_consents',
    'user_blocks',
    'user_reports',
    'user_notifications',
    'study_circles',
    'study_circle_memberships',
    'study_circle_messages',
    'campus_events',
    'campus_event_rsvps'
  ]
  loop
    execute format(
      'create trigger %I before insert or update or delete on public.%I '
      'for each row execute function public.reject_account_deletion_locked_mutation()',
      target_table || '_reject_deletion_locked_mutation',
      target_table
    );
  end loop;
end;
$$;

-- Finalization only removes non-active participation. Active membership/RSVP
-- survives until Auth deletion nulls its FK, preserving shared tombstones.
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
  set status = 'archived',
      archived_at = coalesce(archived_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where owner_user_id = target_user_id and status <> 'archived';

  update public.campus_events
  set status = 'cancelled',
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

  -- ponytail: blocking leaves no shared-history projection; delete both edges.
  delete from public.user_blocks
  where blocker_id = target_user_id or blocked_id = target_user_id;
  delete from public.conversation_mutual_interests
  where participant_id = target_user_id;
  -- ponytail: retain active shared rows for tombstones; remove terminal private
  -- participation only. Add a separate history ledger if per-exit retention is
  -- later required.
  delete from public.study_circle_memberships
  where user_id = target_user_id and status <> 'active';
  delete from public.campus_event_rsvps
  where user_id = target_user_id and status <> 'going';
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

revoke all on function public.cleanup_account_deletion_database(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cleanup_account_deletion_database(uuid, uuid)
  to service_role;

-- Auth is the final deletion step. Reject accidental or out-of-band Auth
-- deletion while an Account/Privacy request still needs database cleanup.
create or replace function public.prevent_auth_delete_before_account_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.account_deletion_requests deletion
    where deletion.user_id = old.id
      and deletion.status in ('pending', 'processing', 'failed')
      and deletion.database_cleanup_at is null
  ) then
    raise exception 'account cleanup required before auth deletion'
      using errcode = '42501';
  end if;

  return old;
end;
$$;

revoke all on function public.prevent_auth_delete_before_account_cleanup()
  from public, anon, authenticated;

create trigger auth_users_account_cleanup_first
before delete on auth.users
for each row execute function public.prevent_auth_delete_before_account_cleanup();

-- Fixture-scoped claim for controlled operations. The original global queue
-- claim remains available to the trusted scheduled runner.
create or replace function public.claim_account_deletion_job_by_id(
  p_request_id uuid
)
returns table (request_id uuid, user_id uuid, lease_token uuid)
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
  if p_request_id is null then
    raise exception 'deletion request required' using errcode = '22023';
  end if;

  select * into target
  from public.account_deletion_requests deletion
  where deletion.id = p_request_id
    and (
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
  for update skip locked;

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

revoke all on function public.claim_account_deletion_job_by_id(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_account_deletion_job_by_id(uuid)
  to service_role;

-- Completed queue metadata follows the same centralized security-audit window.
create or replace function public.purge_expired_account_deletion_requests(
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
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select * into policy
  from public.account_privacy_policy
  where singleton = true;

  with due as (
    select deletion.id
    from public.account_deletion_requests deletion
    where deletion.status = 'completed'
      and deletion.completed_at
        <= timezone('utc', now())
          - make_interval(days => policy.security_audit_retention_days)
      and not exists (
        select 1
        from public.user_reports report
        where report.account_deletion_request_id = deletion.id
          and report.moderation_status in ('submitted', 'under_review')
      )
    order by deletion.completed_at
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  )
  delete from public.account_deletion_requests deletion
  using due
  where deletion.id = due.id;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_expired_account_deletion_requests(integer)
  from public, anon, authenticated;
grant execute on function public.purge_expired_account_deletion_requests(integer)
  to service_role;
