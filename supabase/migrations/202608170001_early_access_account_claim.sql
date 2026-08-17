-- Early Access Account Claim
-- Waitlist is not an account. Claim requires authenticated ownership of the same email.
-- Forward-only: preserve historical waitlist rows; do not broaden table grants.

alter table public.early_access_waitlist
  add column if not exists claimed_user_id uuid null
    references auth.users (id) on delete set null,
  add column if not exists claimed_at timestamptz null;

alter table public.early_access_waitlist
  drop constraint if exists early_access_waitlist_status_allowed;

alter table public.early_access_waitlist
  add constraint early_access_waitlist_status_allowed
  check (status in ('waiting', 'claimed'));

alter table public.early_access_waitlist
  drop constraint if exists early_access_waitlist_claim_consistency;

alter table public.early_access_waitlist
  add constraint early_access_waitlist_claim_consistency
  check (
    (
      status = 'waiting'
      and claimed_user_id is null
      and claimed_at is null
    )
    or (
      status = 'claimed'
      and claimed_user_id is not null
      and claimed_at is not null
    )
  );

create unique index if not exists early_access_waitlist_claimed_user_unique
  on public.early_access_waitlist (claimed_user_id)
  where claimed_user_id is not null;

comment on column public.early_access_waitlist.claimed_user_id is
  'Authenticated StudyDate user who claimed this waitlist row; null until claim.';
comment on column public.early_access_waitlist.claimed_at is
  'Timestamp of successful claim; cleared on account deletion cleanup.';

-- Atomic claim for the current authenticated user. Identity and email come from
-- auth.uid() / auth.users only — never from client payload.
create or replace function public.claim_early_access_for_me()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_email text;
  normalized_email text;
  waitlist_row public.early_access_waitlist%rowtype;
  waitlist_id uuid;
  outcome text;
  prefill jsonb := null;
  updated int;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.account_deletion_requests deletion
    where deletion.user_id = actor
      and deletion.status in ('pending', 'processing', 'failed')
  ) then
    return jsonb_build_object(
      'outcome', 'not_eligible',
      'prefill', null
    );
  end if;

  if exists (
    select 1
    from public.profiles profile
    where profile.user_id = actor
      and profile.deactivated_at is not null
  ) then
    return jsonb_build_object(
      'outcome', 'not_eligible',
      'prefill', null
    );
  end if;

  select btrim(auth_user.email)
  into actor_email
  from auth.users auth_user
  where auth_user.id = actor;

  if actor_email is null or actor_email = '' then
    return jsonb_build_object(
      'outcome', 'not_eligible',
      'prefill', null
    );
  end if;

  normalized_email := lower(actor_email);

  select waitlist.*
  into waitlist_row
  from public.early_access_waitlist waitlist
  where lower(waitlist.email) = normalized_email
  for update;

  if not found then
    return jsonb_build_object(
      'outcome', 'not_waitlisted',
      'prefill', null
    );
  end if;

  waitlist_id := waitlist_row.id;

  if waitlist_row.claimed_user_id = actor then
    outcome := 'already_claimed_by_self';
  elsif waitlist_row.claimed_user_id is not null then
    return jsonb_build_object(
      'outcome', 'already_claimed_other',
      'prefill', null
    );
  elsif waitlist_row.status <> 'waiting' then
    return jsonb_build_object(
      'outcome', 'not_eligible',
      'prefill', null
    );
  else
    update public.early_access_waitlist
    set
      claimed_user_id = actor,
      claimed_at = timezone('utc', now()),
      status = 'claimed'
    where id = waitlist_id
      and claimed_user_id is null
      and status = 'waiting';

    get diagnostics updated = row_count;

    if updated = 0 then
      -- Concurrent claim won the race after lock release edge cases.
      select waitlist.*
      into waitlist_row
      from public.early_access_waitlist waitlist
      where waitlist.id = waitlist_id;

      if waitlist_row.claimed_user_id = actor then
        outcome := 'already_claimed_by_self';
      else
        return jsonb_build_object(
          'outcome', 'already_claimed_other',
          'prefill', null
        );
      end if;
    else
      outcome := 'claimed_now';
    end if;
  end if;

  if outcome in ('claimed_now', 'already_claimed_by_self') then
    prefill := jsonb_build_object(
      'campus', waitlist_row.campus,
      'interestHints', to_jsonb(waitlist_row.interests)
    );
  end if;

  return jsonb_build_object(
    'outcome', outcome,
    'prefill', prefill
  );
end;
$$;

revoke all on function public.claim_early_access_for_me()
  from public, anon, authenticated;
grant execute on function public.claim_early_access_for_me()
  to authenticated;

comment on function public.claim_early_access_for_me() is
  'Idempotent Early Access claim bound to auth.uid() email; returns sanitized outcome + onboarding hints.';

-- Release claim association on account deletion so a future auth user with the
-- same email can reclaim. Retain waitlist consent/source history.
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

  delete from public.user_blocks
  where blocker_id = target_user_id or blocked_id = target_user_id;
  delete from public.conversation_mutual_interests
  where participant_id = target_user_id;
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

  -- Retain waitlist consent/source; clear claim so deleted UUID cannot reactivate.
  update public.early_access_waitlist
  set
    claimed_user_id = null,
    claimed_at = null,
    status = 'waiting'
  where claimed_user_id = target_user_id;

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

-- Table remains closed to normal clients.
revoke all on table public.early_access_waitlist from anon, authenticated;
