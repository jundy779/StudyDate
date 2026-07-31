alter table public.verification_events
  drop constraint verification_event_type_allowed;

alter table public.verification_events
  add constraint verification_event_type_allowed
  check (event_type in (
    'request_submitted', 'campus_email_sent', 'campus_email_verified',
    'review_started', 'action_requested', 'verification_approved',
    'verification_rejected', 'request_cancelled', 'request_expired',
    'evidence_deleted'
  ));

create or replace function public.enforce_verification_reviewer_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type in (
    'review_started',
    'action_requested',
    'verification_approved',
    'verification_rejected',
    'request_expired'
  ) then
    if new.actor_id is null or new.actor_id = new.user_id then
      raise exception 'authorized reviewer required';
    end if;

    if not exists (
      select 1
      from auth.users reviewer
      where reviewer.id = new.actor_id
        and reviewer.raw_app_meta_data -> 'verification_reviewer' = 'true'::jsonb
        and reviewer.raw_user_meta_data -> 'verification_reviewer'
          is distinct from 'true'::jsonb
    ) then
      raise exception 'authorized reviewer required';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_verification_reviewer_event()
  from public, anon, authenticated;

drop trigger if exists verification_events_require_reviewer
  on public.verification_events;
create trigger verification_events_require_reviewer
before insert on public.verification_events
for each row execute function public.enforce_verification_reviewer_event();

create or replace function public.record_student_verification_evidence_cleanup(
  p_request_id uuid,
  p_student_card_deleted boolean,
  p_pddikti_deleted boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.student_verification_requests%rowtype;
  delete_student_card boolean := false;
  delete_pddikti boolean := false;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  select *
  into target_request
  from public.student_verification_requests
  where id = p_request_id
  for update;

  if not found then
    return false;
  end if;

  if target_request.status not in ('verified', 'rejected', 'expired', 'cancelled') then
    raise exception 'evidence is still active';
  end if;

  delete_student_card :=
    coalesce(p_student_card_deleted, false)
    and target_request.evidence_path is not null
    and target_request.evidence_deletion_at is not null
    and target_request.evidence_deletion_at <= now();

  delete_pddikti :=
    coalesce(p_pddikti_deleted, false)
    and target_request.pddikti_evidence_path is not null
    and target_request.pddikti_evidence_deletion_at is not null
    and target_request.pddikti_evidence_deletion_at <= now();

  if not delete_student_card and not delete_pddikti then
    return false;
  end if;

  update public.student_verification_requests
  set
    evidence_path = case
      when delete_student_card then null
      else evidence_path
    end,
    evidence_deleted_at = case
      when delete_student_card then now()
      else evidence_deleted_at
    end,
    pddikti_evidence_path = case
      when delete_pddikti then null
      else pddikti_evidence_path
    end,
    pddikti_evidence_deleted_at = case
      when delete_pddikti then now()
      else pddikti_evidence_deleted_at
    end
  where id = p_request_id;

  insert into public.verification_events (
    request_id,
    user_id,
    actor_id,
    event_type
  )
  values (
    p_request_id,
    target_request.user_id,
    null,
    'evidence_deleted'
  );

  return true;
end;
$$;

revoke execute on function public.record_student_verification_evidence_cleanup(
  uuid,
  boolean,
  boolean
) from public, anon, authenticated;

grant execute on function public.record_student_verification_evidence_cleanup(
  uuid,
  boolean,
  boolean
) to service_role;
