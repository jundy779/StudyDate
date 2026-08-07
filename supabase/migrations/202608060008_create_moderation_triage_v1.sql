-- Moderation triage v1 for user_reports.
-- Applied remotely to StudyDate project ctbqudtvrfezuoqcecyj (2026-08-07).
-- Owner-only queue: submitted → under_review → resolved|dismissed.
-- Never exposes Contact Reveal plaintext, one-sided reveal state, or full chat history.

-- ---------------------------------------------------------------------------
-- 1. Extend user_reports with triage columns
-- ---------------------------------------------------------------------------

alter table public.user_reports
  add column if not exists moderation_status text not null default 'submitted',
  add column if not exists reviewer_user_id uuid null
    references auth.users (id) on delete set null,
  add column if not exists reviewed_at timestamptz null,
  add column if not exists resolved_at timestamptz null,
  add column if not exists internal_note text null;

alter table public.user_reports
  drop constraint if exists user_reports_moderation_status_allowed;

alter table public.user_reports
  add constraint user_reports_moderation_status_allowed
  check (
    moderation_status in (
      'submitted',
      'under_review',
      'resolved',
      'dismissed'
    )
  );

alter table public.user_reports
  drop constraint if exists user_reports_internal_note_length;

alter table public.user_reports
  add constraint user_reports_internal_note_length
  check (
    internal_note is null or char_length(internal_note) <= 500
  );

update public.user_reports
set moderation_status = 'submitted'
where moderation_status is null;

create index if not exists user_reports_moderation_queue_idx
  on public.user_reports (moderation_status, created_at asc);

comment on column public.user_reports.moderation_status is
  'Owner triage: submitted → under_review → resolved|dismissed. Not visible to students.';
comment on column public.user_reports.internal_note is
  'Staff-only plain text note. Never returned to reporter or subject.';

-- ---------------------------------------------------------------------------
-- 2. Append-only moderation audit trail
-- ---------------------------------------------------------------------------

create table if not exists public.moderation_report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.user_reports (id) on delete cascade,
  actor_user_id uuid null references auth.users (id) on delete set null,
  old_status text null,
  new_status text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint moderation_report_events_new_status_allowed check (
    new_status in ('submitted', 'under_review', 'resolved', 'dismissed')
  ),
  constraint moderation_report_events_old_status_allowed check (
    old_status is null
    or old_status in ('submitted', 'under_review', 'resolved', 'dismissed')
  )
);

create index if not exists moderation_report_events_report_created_idx
  on public.moderation_report_events (report_id, created_at desc);

alter table public.moderation_report_events enable row level security;
revoke all on table public.moderation_report_events from public, anon, authenticated;

comment on table public.moderation_report_events is
  'Sanitized moderation status transitions. No message bodies or contact plaintext.';

-- ---------------------------------------------------------------------------
-- 3. list_moderation_reports (Owner only)
-- ---------------------------------------------------------------------------

create or replace function public.list_moderation_reports(
  p_status text default null,
  p_limit integer default 50
)
returns table (
  report_id uuid,
  moderation_status text,
  reason_code text,
  target_kind text,
  subject_suffix text,
  has_details boolean,
  has_message_ref boolean,
  created_at timestamptz,
  reviewed_at timestamptz,
  resolved_at timestamptz,
  reviewer_suffix text
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

  if p_status is not null
    and p_status not in ('submitted', 'under_review', 'resolved', 'dismissed') then
    raise exception 'invalid moderation status' using errcode = '22023';
  end if;

  return query
  select
    report.id,
    report.moderation_status,
    report.reason_code,
    case
      when report.anonymous_message_id is not null then 'message'
      when report.conversation_id is not null then 'conversation'
      when report.introduction_request_id is not null then 'introduction'
      else 'other'
    end as target_kind,
    right(report.subject_user_id::text, 8),
    (report.details is not null and char_length(report.details) > 0),
    (report.anonymous_message_id is not null),
    report.created_at,
    report.reviewed_at,
    report.resolved_at,
    case
      when report.reviewer_user_id is null then null
      else right(report.reviewer_user_id::text, 8)
    end
  from public.user_reports report
  where p_status is null or report.moderation_status = p_status
  order by
    case report.moderation_status
      when 'submitted' then 0
      when 'under_review' then 1
      when 'resolved' then 2
      when 'dismissed' then 3
      else 4
    end,
    report.created_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

revoke all on function public.list_moderation_reports(text, integer)
  from public, anon;
grant execute on function public.list_moderation_reports(text, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. get_moderation_report (Owner only; minimal evidence)
-- ---------------------------------------------------------------------------

create or replace function public.get_moderation_report(
  p_report_id uuid
)
returns table (
  report_id uuid,
  moderation_status text,
  reason_code text,
  target_kind text,
  subject_suffix text,
  reporter_suffix text,
  details text,
  conversation_public_id text,
  referenced_message_excerpt text,
  internal_note text,
  created_at timestamptz,
  reviewed_at timestamptz,
  resolved_at timestamptz,
  reviewer_suffix text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  report public.user_reports%rowtype;
  shell public.conversation_shells%rowtype;
  message_body text;
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;

  if p_report_id is null then
    raise exception 'report unavailable' using errcode = 'P0001';
  end if;

  select * into report
  from public.user_reports candidate
  where candidate.id = p_report_id;

  if report.id is null then
    raise exception 'report unavailable' using errcode = 'P0001';
  end if;

  if report.conversation_id is not null then
    select * into shell
    from public.conversation_shells candidate
    where candidate.id = report.conversation_id;
  end if;

  message_body := null;
  if report.anonymous_message_id is not null then
    select left(msg.body, 280)
    into message_body
    from public.anonymous_messages msg
    where msg.id = report.anonymous_message_id
      and (
        report.conversation_id is null
        or msg.conversation_id = report.conversation_id
      )
    limit 1;
  end if;

  return query
  select
    report.id,
    report.moderation_status,
    report.reason_code,
    case
      when report.anonymous_message_id is not null then 'message'
      when report.conversation_id is not null then 'conversation'
      when report.introduction_request_id is not null then 'introduction'
      else 'other'
    end,
    right(report.subject_user_id::text, 8),
    right(report.reporter_id::text, 8),
    report.details,
    shell.public_id,
    message_body,
    report.internal_note,
    report.created_at,
    report.reviewed_at,
    report.resolved_at,
    case
      when report.reviewer_user_id is null then null
      else right(report.reviewer_user_id::text, 8)
    end;
end;
$$;

revoke all on function public.get_moderation_report(uuid)
  from public, anon;
grant execute on function public.get_moderation_report(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. count unresolved for Owner badge
-- ---------------------------------------------------------------------------

create or replace function public.count_unresolved_moderation_reports()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  total integer;
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;

  select count(*)::integer into total
  from public.user_reports report
  where report.moderation_status in ('submitted', 'under_review');

  return coalesce(total, 0);
end;
$$;

revoke all on function public.count_unresolved_moderation_reports()
  from public, anon;
grant execute on function public.count_unresolved_moderation_reports()
  to authenticated;

-- ---------------------------------------------------------------------------
-- 6. update_moderation_report_status (Owner only; trusted actor = auth.uid())
-- ---------------------------------------------------------------------------

create or replace function public.update_moderation_report_status(
  p_report_id uuid,
  p_new_status text,
  p_internal_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  report public.user_reports%rowtype;
  next_note text;
  allowed boolean := false;
begin
  if actor_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;

  if p_report_id is null
    or p_new_status is null
    or p_new_status not in ('under_review', 'resolved', 'dismissed') then
    raise exception 'invalid moderation transition' using errcode = '22023';
  end if;

  next_note := nullif(btrim(coalesce(p_internal_note, '')), '');
  if next_note is not null and char_length(next_note) > 500 then
    raise exception 'invalid internal note' using errcode = '22023';
  end if;

  select * into report
  from public.user_reports candidate
  where candidate.id = p_report_id
  for update;

  if report.id is null then
    raise exception 'report unavailable' using errcode = 'P0001';
  end if;

  if report.moderation_status = p_new_status
    and (
      next_note is null
      or next_note is not distinct from report.internal_note
    ) then
    return false;
  end if;

  if report.moderation_status = 'submitted' and p_new_status = 'under_review' then
    allowed := true;
  elsif report.moderation_status = 'under_review'
    and p_new_status in ('resolved', 'dismissed') then
    allowed := true;
  elsif report.moderation_status = 'submitted'
    and p_new_status in ('resolved', 'dismissed') then
    -- Allow direct resolve/dismiss for sparse limited-rollout queues.
    allowed := true;
  else
    allowed := false;
  end if;

  if not allowed then
    raise exception 'invalid moderation transition' using errcode = '22023';
  end if;

  update public.user_reports
  set
    moderation_status = p_new_status,
    reviewer_user_id = actor_user_id,
    reviewed_at = case
      when report.reviewed_at is null then timezone('utc', now())
      else report.reviewed_at
    end,
    resolved_at = case
      when p_new_status in ('resolved', 'dismissed') then timezone('utc', now())
      else report.resolved_at
    end,
    internal_note = coalesce(next_note, report.internal_note)
  where id = report.id;

  insert into public.moderation_report_events (
    report_id,
    actor_user_id,
    old_status,
    new_status
  ) values (
    report.id,
    actor_user_id,
    report.moderation_status,
    p_new_status
  );

  return true;
end;
$$;

revoke all on function public.update_moderation_report_status(uuid, text, text)
  from public, anon;
grant execute on function public.update_moderation_report_status(uuid, text, text)
  to authenticated;

-- Applied remotely to StudyDate project ctbqudtvrfezuoqcecyj (2026-08-07).
