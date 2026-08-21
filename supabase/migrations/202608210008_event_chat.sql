-- Event-scoped text discussion for organizer and RSVP-going participants.

create table public.campus_event_messages (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  event_id uuid not null references public.campus_events (id) on delete cascade,
  author_user_id uuid null references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 800),
  moderation_status text not null default 'visible' check (
    moderation_status in ('visible', 'removed')
  ),
  client_idempotency_key text not null check (
    client_idempotency_key ~ '^[A-Za-z0-9_-]{16,80}$'
  ),
  created_at timestamptz not null default timezone('utc', now()),
  unique (event_id, author_user_id, client_idempotency_key),
  constraint campus_event_messages_public_id check (public_id ~ '^[0-9a-f]{32}$'),
  constraint campus_event_messages_plain_text check (body !~ '<[^>]+>')
);
alter table public.campus_event_messages
  add constraint campus_event_messages_id_event_unique unique (id, event_id);
create index campus_event_messages_event_created_idx
  on public.campus_event_messages (event_id, created_at desc, public_id desc);
alter table public.campus_event_messages enable row level security;
revoke all on table public.campus_event_messages from public, anon, authenticated;
create trigger campus_event_messages_reject_deletion_locked_mutation
before insert or update or delete on public.campus_event_messages
for each row execute function public.reject_account_deletion_locked_mutation();

alter table public.user_reports
  drop constraint user_reports_event_context,
  add column campus_event_message_id uuid null,
  add column campus_event_message_excerpt text null,
  add constraint user_reports_event_context check (
    (
      campus_event_target_kind is null
      and campus_event_message_id is null
      and campus_event_id is null
      and campus_event_title_snapshot is null
      and campus_event_description_excerpt is null
      and campus_event_venue_category_snapshot is null
      and campus_event_venue_name_snapshot is null
      and campus_event_venue_area_snapshot is null
    )
    or (
      campus_event_target_kind is not null
      and campus_event_message_id is null
      and campus_event_title_snapshot is not null
      and campus_event_description_excerpt is not null
      and campus_event_venue_category_snapshot is not null
      and campus_event_venue_name_snapshot is not null
      and campus_event_venue_area_snapshot is not null
      and introduction_request_id is null
      and conversation_id is null
      and anonymous_message_id is null
      and study_circle_id is null
      and study_circle_message_id is null
    )
    or (
      campus_event_target_kind is null
      and campus_event_message_id is not null
      and campus_event_id is not null
      and campus_event_title_snapshot is null
      and campus_event_description_excerpt is null
      and campus_event_venue_category_snapshot is null
      and campus_event_venue_name_snapshot is null
      and campus_event_venue_area_snapshot is null
      and introduction_request_id is null
      and conversation_id is null
      and anonymous_message_id is null
      and study_circle_id is null
      and study_circle_message_id is null
    )
  ),
  add constraint user_reports_event_message_context_fk
    foreign key (campus_event_message_id, campus_event_id)
    references public.campus_event_messages (id, event_id) on delete cascade,
  add constraint user_reports_event_message_excerpt check (
    (campus_event_message_id is null and campus_event_message_excerpt is null)
    or (
      campus_event_message_id is not null
      and campus_event_message_excerpt is not null
      and char_length(campus_event_message_excerpt) between 1 and 280
    )
  );
create index user_reports_campus_event_message_idx
  on public.user_reports (campus_event_message_id)
  where campus_event_message_id is not null;

create or replace function public.list_moderation_reports(
  p_status text default null, p_limit integer default 50
)
returns table (
  report_id uuid, moderation_status text, reason_code text, target_kind text,
  subject_suffix text, has_details boolean, has_message_ref boolean,
  created_at timestamptz, reviewed_at timestamptz, resolved_at timestamptz,
  reviewer_suffix text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  if p_status is not null
    and p_status not in ('submitted', 'under_review', 'resolved', 'dismissed') then
    raise exception 'invalid moderation status' using errcode = '22023';
  end if;
  return query select report.id, report.moderation_status, report.reason_code,
    case
      when report.campus_event_message_id is not null then 'event_message'
      when report.campus_event_target_kind is not null
        then report.campus_event_target_kind
      when report.study_circle_message_id is not null then 'circle_message'
      when report.study_circle_id is not null then 'circle'
      when report.anonymous_message_id is not null then 'message'
      when report.conversation_id is not null then 'conversation'
      when report.introduction_request_id is not null then 'introduction'
      else 'other'
    end,
    right(report.subject_user_id::text, 8),
    report.details is not null and char_length(report.details) > 0,
    report.anonymous_message_id is not null
      or report.study_circle_message_id is not null
      or report.campus_event_message_id is not null
      or report.campus_event_id is not null,
    report.created_at, report.reviewed_at, report.resolved_at,
    case when report.reviewer_user_id is null then null
      else right(report.reviewer_user_id::text, 8) end
  from public.user_reports report
  where p_status is null or report.moderation_status = p_status
  order by case report.moderation_status
    when 'submitted' then 0 when 'under_review' then 1
    when 'resolved' then 2 when 'dismissed' then 3 else 4 end,
    report.created_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end; $$;

create or replace function public.get_moderation_report(p_report_id uuid)
returns table (
  report_id uuid, moderation_status text, reason_code text, target_kind text,
  subject_suffix text, reporter_suffix text, details text,
  conversation_public_id text, referenced_message_excerpt text,
  internal_note text, created_at timestamptz, reviewed_at timestamptz,
  resolved_at timestamptz, reviewer_suffix text
)
language plpgsql stable security definer set search_path = '' as $$
declare report public.user_reports%rowtype;
  shell public.conversation_shells%rowtype; evidence text;
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  select * into report from public.user_reports candidate
  where candidate.id = p_report_id;
  if report.id is null then
    raise exception 'report unavailable' using errcode = 'P0001';
  end if;
  if report.conversation_id is not null then
    select * into shell from public.conversation_shells candidate
    where candidate.id = report.conversation_id;
  end if;
  if report.campus_event_message_id is not null then
    evidence := report.campus_event_message_excerpt;
  elsif report.campus_event_id is not null then
    evidence := left(
      report.campus_event_title_snapshot || ' — '
      || report.campus_event_description_excerpt || ' — '
      || report.campus_event_venue_category_snapshot || ': '
      || report.campus_event_venue_name_snapshot || ', '
      || report.campus_event_venue_area_snapshot,
      280
    );
  elsif report.study_circle_message_id is not null then
    evidence := report.study_circle_message_excerpt;
  elsif report.anonymous_message_id is not null then
    select left(message.body, 280) into evidence
    from public.anonymous_messages message
    where message.id = report.anonymous_message_id
      and (report.conversation_id is null
        or message.conversation_id = report.conversation_id);
  end if;
  return query select report.id, report.moderation_status, report.reason_code,
    case
      when report.campus_event_message_id is not null then 'event_message'
      when report.campus_event_target_kind is not null
        then report.campus_event_target_kind
      when report.study_circle_message_id is not null then 'circle_message'
      when report.study_circle_id is not null then 'circle'
      when report.anonymous_message_id is not null then 'message'
      when report.conversation_id is not null then 'conversation'
      when report.introduction_request_id is not null then 'introduction'
      else 'other'
    end,
    right(report.subject_user_id::text, 8), right(report.reporter_id::text, 8),
    report.details, shell.public_id, evidence, report.internal_note,
    report.created_at, report.reviewed_at, report.resolved_at,
    case when report.reviewer_user_id is null then null
      else right(report.reviewer_user_id::text, 8) end;
end; $$;

alter table public.campus_event_rate_limits
  drop constraint campus_event_rate_limits_bucket;
alter table public.campus_event_rate_limits
  add constraint campus_event_rate_limits_bucket check (
    bucket in (
      'create_day', 'rsvp_day', 'edit_day', 'report_hour', 'report_day',
      'message_minute', 'message_day'
    )
  );

create or replace function public.consume_campus_event_rate_limit(
  p_actor_user_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_value timestamptz;
  next_hit integer;
begin
  if p_actor_user_id is null
    or p_bucket not in (
      'create_day', 'rsvp_day', 'edit_day', 'report_hour', 'report_day',
      'message_minute', 'message_day'
    )
    or p_limit < 1 or p_limit > 1000
    or p_window_seconds < 1 or p_window_seconds > 86400 then
    return false;
  end if;
  window_value := to_timestamp(
    floor(extract(epoch from timezone('utc', now())) / p_window_seconds)
      * p_window_seconds
  );
  insert into public.campus_event_rate_limits as rate (
    actor_user_id, bucket, window_start, hit_count
  ) values (p_actor_user_id, p_bucket, window_value, 1)
  on conflict (actor_user_id, bucket, window_start)
  do update set hit_count = rate.hit_count + 1
    where rate.hit_count < p_limit
  returning hit_count into next_hit;
  return next_hit is not null;
end;
$$;

revoke all on function public.consume_campus_event_rate_limit(
  uuid, text, integer, integer
) from public, anon, authenticated;

create or replace function public.is_active_campus_event_participant(
  p_event_id uuid, p_user_id uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_campus_event_student(p_user_id)
    and exists (
    select 1 from public.campus_event_rsvps rsvp
    join public.campus_events event on event.id = rsvp.event_id
    where rsvp.event_id = p_event_id and rsvp.user_id = p_user_id
      and rsvp.status = 'going' and event.status = 'scheduled'
      and event.ends_at > timezone('utc', now())
  );
$$;
revoke all on function public.is_active_campus_event_participant(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.list_campus_event_messages(
  p_public_slug text, p_before_created_at timestamptz default null,
  p_before_public_id text default null, p_limit integer default 51
)
returns table (
  message_public_id text, author_alias text, author_is_verified boolean,
  body text, created_at timestamptz, is_mine boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); v_event_id uuid;
begin
  select event.id into v_event_id from public.campus_events event
  where event.public_slug = p_public_slug;
  if v_event_id is null
    or not public.is_active_campus_event_participant(v_event_id, actor) then
    raise exception 'event participation required' using errcode = '42501'; end if;
  if (p_before_created_at is null) <> (p_before_public_id is null)
    or (p_before_public_id is not null and p_before_public_id !~ '^[0-9a-f]{32}$') then
    raise exception 'invalid message cursor' using errcode = '22023'; end if;
  return query select message.public_id,
    case when message.author_user_id is null
      or public.is_account_deletion_locked(message.author_user_id)
      then 'Akun dihapus' else profile.public_alias end,
    case when message.author_user_id is null
      or public.is_account_deletion_locked(message.author_user_id)
      then false else coalesce(profile.verification_status = 'verified', false) end,
    message.body, message.created_at, message.author_user_id = actor
  from public.campus_event_messages message
  left join public.profiles profile on profile.user_id = message.author_user_id
  where message.event_id = v_event_id and message.moderation_status = 'visible'
    and (
      p_before_created_at is null
      or (message.created_at, message.public_id) < (p_before_created_at, p_before_public_id)
    )
  order by message.created_at desc, message.public_id desc
  limit least(greatest(coalesce(p_limit, 51), 1), 101);
end; $$;

create or replace function public.send_campus_event_message(
  p_public_slug text, p_body text, p_idempotency_key text
)
returns text
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); event public.campus_events%rowtype;
  body_value text; existing text; result text;
begin
  select * into event from public.campus_events candidate
  where candidate.public_slug = p_public_slug for update;
  if event.id is null or not public.is_active_campus_event_participant(event.id, actor) then
    raise exception 'event participation required' using errcode = '42501'; end if;
  if p_idempotency_key !~ '^[A-Za-z0-9_-]{16,80}$' then
    raise exception 'invalid idempotency key' using errcode = '22023'; end if;
  select message.public_id into existing from public.campus_event_messages message
  where message.event_id = event.id and message.author_user_id = actor
    and message.client_idempotency_key = p_idempotency_key;
  if existing is not null then return existing; end if;
  body_value := public.normalize_campus_event_body(p_body);
  if char_length(body_value) not between 1 and 800 or body_value ~ '<[^>]+>'
    or public.introduction_message_has_contact(body_value) then
    raise exception 'invalid event message' using errcode = '22023'; end if;
  if not public.consume_campus_event_rate_limit(actor, 'message_minute', 20, 60)
    or not public.consume_campus_event_rate_limit(actor, 'message_day', 300, 86400) then
    raise exception 'event message rate limited' using errcode = 'P0001'; end if;
  insert into public.campus_event_messages (
    event_id, author_user_id, body, client_idempotency_key
  ) values (event.id, actor, body_value, p_idempotency_key)
  returning public_id into result;
  return result;
end; $$;

create or replace function public.report_campus_event_message(
  p_public_slug text, p_message_public_id text, p_reason_code text,
  p_details text default null
)
returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); event public.campus_events%rowtype;
  target_message public.campus_event_messages%rowtype; normalized_details text;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'event message unavailable' using errcode = '42501';
  end if;
  select * into event from public.campus_events candidate
  where candidate.public_slug = p_public_slug;
  if event.id is null or not (
      public.is_active_campus_event_participant(event.id, actor)
      or (
        event.organizer_user_id = actor
        and event.status = 'scheduled'
        and event.ends_at > timezone('utc', now())
      )
    )
    or p_message_public_id !~ '^[0-9a-f]{32}$'
    or p_reason_code not in (
      'harassment', 'spam', 'contact_pressure', 'fake_or_misleading',
      'unsafe_location', 'other'
    ) then
    raise exception 'event message unavailable' using errcode = '42501';
  end if;
  select * into target_message from public.campus_event_messages message
  where message.event_id = event.id
    and message.public_id = p_message_public_id
    and message.moderation_status = 'visible';
  if target_message.id is null or target_message.author_user_id is null
    or target_message.author_user_id = actor then
    raise exception 'event message unavailable' using errcode = 'P0001';
  end if;
  normalized_details := nullif(public.normalize_campus_event_body(p_details), '');
  if normalized_details is not null and (
    char_length(normalized_details) > 300
    or normalized_details ~ '<[^>]+>'
    or public.introduction_message_has_contact(normalized_details)
  ) then raise exception 'invalid report details' using errcode = '22023'; end if;
  if not public.consume_campus_event_rate_limit(actor, 'report_hour', 3, 3600)
    or not public.consume_campus_event_rate_limit(actor, 'report_day', 10, 86400) then
    raise exception 'event report rate limited' using errcode = 'P0001';
  end if;
  insert into public.user_reports (
    reporter_id, subject_user_id, campus_event_id, campus_event_message_id,
    campus_event_message_excerpt, reason_code, details
  ) values (
    actor, target_message.author_user_id, event.id, target_message.id,
    left(target_message.body, 280), p_reason_code, normalized_details
  );
end; $$;

revoke all on function public.list_campus_event_messages(text, timestamptz, text, integer)
  from public, anon;
grant execute on function public.list_campus_event_messages(text, timestamptz, text, integer)
  to authenticated;
revoke all on function public.send_campus_event_message(text, text, text)
  from public, anon;
grant execute on function public.send_campus_event_message(text, text, text)
  to authenticated;
revoke all on function public.report_campus_event_message(text, text, text, text)
  from public, anon;
grant execute on function public.report_campus_event_message(text, text, text, text)
  to authenticated;
