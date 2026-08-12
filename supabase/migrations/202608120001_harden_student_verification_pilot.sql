alter table public.student_verification_requests
  drop constraint student_verification_rejection_reason_allowed;

alter table public.student_verification_requests
  add constraint student_verification_rejection_reason_allowed
  check (
    rejection_reason_code is null
    or rejection_reason_code in (
      'academic_not_found', 'academic_mismatch', 'registry_unavailable',
      'ownership_failed', 'evidence_unreadable',
      'additional_information_required', 'verification_invalidated'
    )
  );

alter table public.verification_events
  drop constraint verification_event_type_allowed;

alter table public.verification_events
  add constraint verification_event_type_allowed
  check (event_type in (
    'request_submitted', 'campus_email_sent', 'campus_email_verified',
    'review_started', 'action_requested', 'verification_approved',
    'verification_rejected', 'verification_invalidated',
    'request_cancelled', 'request_expired', 'evidence_deleted'
  ));

create table public.student_verification_cleanup_health (
  singleton boolean primary key default true check (singleton),
  last_started_at timestamptz null,
  last_succeeded_at timestamptz null,
  last_status text not null default 'never_run'
    check (last_status in ('never_run', 'running', 'succeeded', 'failed')),
  last_processed_count integer not null default 0
    check (last_processed_count between 0 and 100),
  last_failed_count integer not null default 0
    check (last_failed_count between 0 and 100),
  last_remaining_count integer not null default 0
    check (last_remaining_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.student_verification_cleanup_health enable row level security;
revoke all on table public.student_verification_cleanup_health
  from public, anon, authenticated;

insert into public.student_verification_cleanup_health (singleton)
values (true);

create table public.student_verification_provider_metrics (
  bucket_started_at timestamptz not null,
  outcome text not null check (outcome in (
    'academic_match', 'not_found', 'mismatch',
    'provider_unavailable', 'provider_invalid_response'
  )),
  latency_bucket text not null check (latency_bucket in (
    'under_2s', '2_to_10s', '10_to_25s', 'over_25s'
  )),
  candidate_bucket text not null check (candidate_bucket in (
    'zero', 'one', 'two_to_ten', 'over_ten'
  )),
  schema_valid boolean not null,
  academic_status_present boolean not null,
  sample_count integer not null default 1 check (sample_count > 0),
  primary key (
    bucket_started_at, outcome, latency_bucket, candidate_bucket,
    schema_valid, academic_status_present
  )
);

alter table public.student_verification_provider_metrics enable row level security;
revoke all on table public.student_verification_provider_metrics
  from public, anon, authenticated;

create or replace function public.record_student_verification_provider_metric(
  p_outcome text,
  p_latency_bucket text,
  p_candidate_bucket text,
  p_schema_valid boolean,
  p_academic_status_present boolean
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
  if p_outcome not in (
    'academic_match', 'not_found', 'mismatch',
    'provider_unavailable', 'provider_invalid_response'
  ) or p_latency_bucket not in (
    'under_2s', '2_to_10s', '10_to_25s', 'over_25s'
  ) or p_candidate_bucket not in (
    'zero', 'one', 'two_to_ten', 'over_ten'
  ) then
    raise exception 'invalid provider metric' using errcode = '22023';
  end if;

  insert into public.student_verification_provider_metrics (
    bucket_started_at, outcome, latency_bucket, candidate_bucket,
    schema_valid, academic_status_present
  ) values (
    date_trunc('hour', timezone('utc', now())),
    p_outcome, p_latency_bucket, p_candidate_bucket,
    p_schema_valid, p_academic_status_present
  )
  on conflict (
    bucket_started_at, outcome, latency_bucket, candidate_bucket,
    schema_valid, academic_status_present
  ) do update
  set sample_count =
    public.student_verification_provider_metrics.sample_count + 1;
end;
$$;

revoke all on function public.record_student_verification_provider_metric(
  text, text, text, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.record_student_verification_provider_metric(
  text, text, text, boolean, boolean
) to service_role;

create or replace function public.confirm_student_campus_email_code(
  p_user_id uuid,
  p_request_id uuid,
  p_candidate_hash text,
  p_max_attempts smallint
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenge public.campus_email_verifications%rowtype;
  target public.student_verification_requests%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  perform public.lock_eligible_verification_student(p_user_id);

  select * into challenge
  from public.campus_email_verifications
  where request_id = p_request_id and user_id = p_user_id
  for update;

  if challenge.id is null or challenge.verified_at is not null
    or challenge.expires_at <= timezone('utc', now())
    or challenge.attempts >= p_max_attempts then
    return 'invalid';
  end if;

  if challenge.code_hash <> p_candidate_hash then
    update public.campus_email_verifications
    set attempts = least(attempts + 1, p_max_attempts)
    where id = challenge.id;
    return 'invalid';
  end if;

  select * into target
  from public.student_verification_requests
  where id = p_request_id
    and user_id = p_user_id
    and method = 'campus_email'
    and status in ('pending', 'needs_action', 'under_review')
  for update;

  if target.id is null then
    raise exception 'request is not eligible' using errcode = '42501';
  end if;

  update public.campus_email_verifications
  set verified_at = timezone('utc', now())
  where id = challenge.id;

  update public.student_verification_requests
  set ownership_status = 'campus_email_verified',
    status = 'under_review',
    reviewed_at = coalesce(reviewed_at, timezone('utc', now())),
    verified_at = null,
    rejection_reason_code = null
  where id = p_request_id;

  update public.profiles
  set verification_status = 'pending'
  where user_id = p_user_id;

  insert into public.verification_events (
    request_id, user_id, actor_id, event_type
  ) values (
    p_request_id, p_user_id, p_user_id, 'campus_email_verified'
  );

  return 'ownership_verified';
end;
$$;

revoke all on function public.confirm_student_campus_email_code(
  uuid, uuid, text, smallint
) from public, anon, authenticated;
grant execute on function public.confirm_student_campus_email_code(
  uuid, uuid, text, smallint
) to service_role;

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
  target public.student_verification_requests%rowtype;
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

  select * into target
  from public.student_verification_requests as request
  where request.id = p_request_id
    and request.status in ('pending', 'under_review', 'needs_action')
  for update;

  if target.id is null or target.user_id = actor_user_id then
    raise exception 'review is not allowed' using errcode = '42501';
  end if;

  perform public.lock_eligible_verification_student(target.user_id);

  if target.method = 'academic_pending'
    or p_pddikti_match_status <> target.pddikti_match_status then
    raise exception 'academic result must use dedicated workflow' using errcode = '42501';
  end if;

  if target.method = 'campus_email'
    and p_ownership_status <> target.ownership_status then
    raise exception 'campus email ownership is immutable' using errcode = '42501';
  end if;

  if p_request_status = 'verified' and not (
    target.pddikti_match_status = 'matched'
    and p_ownership_status in ('campus_email_verified', 'document_verified')
  ) then
    raise exception 'combined verification required' using errcode = '23514';
  end if;

  if p_ownership_status = 'campus_email_verified'
    and target.method <> 'campus_email' then
    raise exception 'ownership method mismatch' using errcode = '23514';
  end if;

  if p_ownership_status = 'document_verified'
    and target.method <> 'student_card' then
    raise exception 'ownership method mismatch' using errcode = '23514';
  end if;

  update public.student_verification_requests
  set status = p_request_status,
    ownership_status = p_ownership_status,
    reviewed_at = timezone('utc', now()),
    verified_at = case
      when p_request_status = 'verified' then timezone('utc', now())
      else null
    end,
    evidence_deletion_at = case
      when evidence_path is null then null
      when p_request_status in ('verified', 'rejected', 'expired')
        then timezone('utc', now()) + interval '30 days'
      else evidence_deletion_at
    end,
    pddikti_evidence_deletion_at = case
      when pddikti_evidence_path is null then null
      when p_request_status in ('verified', 'rejected', 'expired')
        then timezone('utc', now()) + interval '30 days'
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
  where user_id = target.user_id;

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
    p_request_id, target.user_id, actor_user_id, event_name
  );
end;
$$;

revoke all on function public.finalize_staff_verification_review(
  uuid, text, text, text, text
) from public, anon;
grant execute on function public.finalize_staff_verification_review(
  uuid, text, text, text, text
) to authenticated;

create or replace function public.cancel_student_verification_request(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target public.student_verification_requests%rowtype;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into target
  from public.student_verification_requests
  where id = p_request_id
    and user_id = current_user_id
    and status in ('pending', 'under_review', 'needs_action')
  for update;

  if target.id is null then
    raise exception 'request not cancellable' using errcode = '42501';
  end if;

  update public.student_verification_requests
  set status = 'cancelled',
    evidence_deletion_at = case
      when evidence_path is null then null
      else timezone('utc', now()) + interval '24 hours'
    end,
    pddikti_evidence_deletion_at = case
      when pddikti_evidence_path is null then null
      else timezone('utc', now()) + interval '24 hours'
    end
  where id = p_request_id;

  update public.profiles
  set verification_status = 'unverified'
  where user_id = current_user_id;

  insert into public.verification_events (
    request_id, user_id, actor_id, event_type
  ) values (
    p_request_id, current_user_id, current_user_id, 'request_cancelled'
  );
end;
$$;

revoke all on function public.cancel_student_verification_request(uuid)
  from public, anon;
grant execute on function public.cancel_student_verification_request(uuid)
  to authenticated;

create or replace function public.expire_overdue_student_verification_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  with expired as (
    update public.student_verification_requests as request
    set status = 'expired',
      evidence_deletion_at = case
        when request.evidence_path is null then null
        else timezone('utc', now()) + interval '24 hours'
      end,
      pddikti_evidence_deletion_at = case
        when request.pddikti_evidence_path is null then null
        else timezone('utc', now()) + interval '24 hours'
      end
    where request.status in ('pending', 'under_review', 'needs_action')
      and request.expires_at <= timezone('utc', now())
    returning request.id, request.user_id
  ), profile_updates as (
    update public.profiles as profile
    set verification_status = 'unverified'
    where profile.user_id in (select expired.user_id from expired)
    returning profile.user_id
  ), events as (
    insert into public.verification_events (
      request_id, user_id, actor_id, event_type
    )
    select expired.id, expired.user_id, null, 'request_expired'
    from expired
    returning 1
  )
  select count(*)::integer into expired_count from events;

  return expired_count;
end;
$$;

revoke all on function public.expire_overdue_student_verification_requests()
  from public, anon, authenticated;
grant execute on function public.expire_overdue_student_verification_requests()
  to service_role;

create or replace function public.invalidate_student_verification(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target public.student_verification_requests%rowtype;
begin
  if not public.is_current_active_staff(
    array['owner', 'admin']::text[], true
  ) then
    raise exception 'reviewer authorization required' using errcode = '42501';
  end if;

  select * into target
  from public.student_verification_requests
  where id = p_request_id and status = 'verified'
  for update;

  if target.id is null or target.user_id = actor then
    raise exception 'invalidation is not allowed' using errcode = '42501';
  end if;

  perform public.lock_eligible_verification_student(target.user_id);

  update public.student_verification_requests
  set status = 'rejected',
    verified_at = null,
    reviewed_at = timezone('utc', now()),
    rejection_reason_code = 'verification_invalidated',
    evidence_deletion_at = case
      when evidence_path is null then null
      else greatest(
        coalesce(evidence_deletion_at, timezone('utc', now())),
        timezone('utc', now()) + interval '30 days'
      )
    end,
    pddikti_evidence_deletion_at = case
      when pddikti_evidence_path is null then null
      else greatest(
        coalesce(pddikti_evidence_deletion_at, timezone('utc', now())),
        timezone('utc', now()) + interval '30 days'
      )
    end
  where id = p_request_id;

  update public.profiles
  set verification_status = 'unverified'
  where user_id = target.user_id;

  insert into public.verification_events (
    request_id, user_id, actor_id, event_type
  ) values (
    p_request_id, target.user_id, actor, 'verification_invalidated'
  );
end;
$$;

revoke all on function public.invalidate_student_verification(uuid)
  from public, anon;
grant execute on function public.invalidate_student_verification(uuid)
  to authenticated;

create or replace function public.enforce_verification_reviewer_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type = 'request_expired' and new.actor_id is null then
    if auth.role() <> 'service_role' then
      raise exception 'service role required';
    end if;
    return new;
  end if;

  if new.event_type in (
    'review_started',
    'action_requested',
    'verification_approved',
    'verification_rejected',
    'verification_invalidated',
    'request_expired'
  ) then
    if new.actor_id is null or new.actor_id = new.user_id then
      raise exception 'authorized reviewer required';
    end if;

    if not public.is_current_active_staff(
      array['owner', 'admin']::text[], true
    ) then
      raise exception 'authorized reviewer required';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_verification_reviewer_event()
  from public, anon, authenticated;

create or replace function public.record_student_verification_cleanup_health(
  p_status text,
  p_processed_count integer,
  p_failed_count integer,
  p_remaining_count integer
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
  if p_status not in ('running', 'succeeded', 'failed')
    or p_processed_count not between 0 and 100
    or p_failed_count not between 0 and 100
    or p_remaining_count < 0 then
    raise exception 'invalid cleanup health' using errcode = '22023';
  end if;

  update public.student_verification_cleanup_health
  set last_started_at = case
      when p_status = 'running' then timezone('utc', now())
      else last_started_at
    end,
    last_succeeded_at = case
      when p_status = 'succeeded' then timezone('utc', now())
      else last_succeeded_at
    end,
    last_status = p_status,
    last_processed_count = p_processed_count,
    last_failed_count = p_failed_count,
    last_remaining_count = p_remaining_count,
    updated_at = timezone('utc', now())
  where singleton;
end;
$$;

revoke all on function public.record_student_verification_cleanup_health(
  text, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.record_student_verification_cleanup_health(
  text, integer, integer, integer
) to service_role;

create or replace function public.count_due_student_verification_evidence(
  p_now timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  due_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select count(*)::integer into due_count
  from public.student_verification_requests as request
  where request.status in ('verified', 'rejected', 'expired', 'cancelled')
    and (
      (
        request.evidence_path is not null
        and request.evidence_deletion_at <= p_now
      )
      or (
        request.pddikti_evidence_path is not null
        and request.pddikti_evidence_deletion_at <= p_now
      )
    );

  return due_count;
end;
$$;

revoke all on function public.count_due_student_verification_evidence(
  timestamptz
) from public, anon, authenticated;
grant execute on function public.count_due_student_verification_evidence(
  timestamptz
) to service_role;
