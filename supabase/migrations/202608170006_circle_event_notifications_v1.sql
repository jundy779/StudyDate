-- Circle + Campus Event notifications v1 (local-only; do not apply remotely
-- in this task). Extends the existing Notification Center. In-app only.
-- Reminders are deferred: no new cron/scheduler is introduced here.

alter table public.user_notifications
  drop constraint user_notifications_type_allowed,
  drop constraint user_notifications_target_safe,
  drop constraint user_notifications_metadata_safe;

alter table public.user_notifications
  add constraint user_notifications_type_allowed
    check (notification_type in (
      'INTRODUCTION_RECEIVED',
      'INTRODUCTION_ACCEPTED',
      'MESSAGE_RECEIVED',
      'MUTUAL_INTEREST_COMPLETED',
      'IDENTITY_REVEAL_COMPLETED',
      'CONTACT_REVEAL_COMPLETED',
      'CIRCLE_MEMBER_JOINED',
      'CIRCLE_UPDATED',
      'CIRCLE_ARCHIVED',
      'CIRCLE_MEMBER_REMOVED',
      'EVENT_REGISTERED',
      'EVENT_SCHEDULE_CHANGED',
      'EVENT_LOCATION_CHANGED',
      'EVENT_CANCELLED'
    )),
  add constraint user_notifications_target_safe
    check (
      target_path = '/app/introductions'
      or target_path ~ '^/app/messages/[0-9a-f]{32}$'
      or target_path ~ '^/app/circles/circle-[0-9a-f]{24}$'
      or target_path ~ '^/app/events/event-[0-9a-f]{24}$'
    ),
  add constraint user_notifications_metadata_safe
    check (
      (
        notification_type = 'CONTACT_REVEAL_COMPLETED'
        and metadata ? 'channel'
        and metadata->>'channel' in ('telegram', 'instagram', 'linkedin')
        and metadata - 'channel' = '{}'::jsonb
      )
      or (
        notification_type in (
          'CIRCLE_MEMBER_JOINED',
          'CIRCLE_UPDATED',
          'CIRCLE_ARCHIVED',
          'CIRCLE_MEMBER_REMOVED',
          'EVENT_REGISTERED',
          'EVENT_CANCELLED'
        )
        and metadata ? 'title'
        and jsonb_typeof(metadata->'title') = 'string'
        and char_length(metadata->>'title') between 1 and 100
        and metadata - 'title' = '{}'::jsonb
      )
      or (
        notification_type = 'EVENT_SCHEDULE_CHANGED'
        and metadata ? 'title'
        and metadata ? 'when_label'
        and jsonb_typeof(metadata->'title') = 'string'
        and jsonb_typeof(metadata->'when_label') = 'string'
        and char_length(metadata->>'title') between 1 and 100
        and char_length(metadata->>'when_label') between 1 and 64
        and metadata - 'title' - 'when_label' = '{}'::jsonb
      )
      or (
        notification_type = 'EVENT_LOCATION_CHANGED'
        and metadata ? 'title'
        and metadata ? 'venue_label'
        and jsonb_typeof(metadata->'title') = 'string'
        and jsonb_typeof(metadata->'venue_label') = 'string'
        and char_length(metadata->>'title') between 1 and 100
        and char_length(metadata->>'venue_label') between 1 and 160
        and metadata - 'title' - 'venue_label' = '{}'::jsonb
      )
      or (
        notification_type in (
          'INTRODUCTION_RECEIVED',
          'INTRODUCTION_ACCEPTED',
          'MESSAGE_RECEIVED',
          'MUTUAL_INTEREST_COMPLETED',
          'IDENTITY_REVEAL_COMPLETED'
        )
        and metadata = '{}'::jsonb
      )
    );

comment on table public.user_notifications is
  'Private in-app Notifications v1. Stores recipient, constrained event type, safe route, bounded safe metadata, timestamps, and an internal dedupe key.';

create or replace function public.notification_safe_label(
  p_value text,
  p_max integer,
  p_fallback text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      left(
        btrim(regexp_replace(coalesce(p_value, ''), E'[\\n\\r\\t]+', ' ', 'g')),
        greatest(coalesce(p_max, 80), 1)
      ),
      ''
    ),
    left(coalesce(nullif(btrim(p_fallback), ''), 'StudyDate'), 100)
  );
$$;

revoke all on function public.notification_safe_label(text, integer, text)
  from public, anon, authenticated;

create or replace function public.fanout_circle_membership_notifications(
  p_circle_id uuid,
  p_notification_type text,
  p_target_path text,
  p_metadata jsonb,
  p_dedupe_prefix text,
  p_exclude_user_id uuid,
  p_owner_only boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if session_user not in ('postgres', 'supabase_admin', 'authenticator') then
    raise exception 'notification emitter unavailable' using errcode = '42501';
  end if;

  insert into public.user_notifications (
    recipient_user_id,
    notification_type,
    target_path,
    metadata,
    dedupe_key
  )
  select
    membership.user_id,
    p_notification_type,
    p_target_path,
    coalesce(p_metadata, '{}'::jsonb),
    left(p_dedupe_prefix || ':' || membership.user_id::text, 240)
  from public.study_circle_memberships membership
  where membership.circle_id = p_circle_id
    and membership.status = 'active'
    and (p_exclude_user_id is null or membership.user_id <> p_exclude_user_id)
    and (not coalesce(p_owner_only, false) or membership.role = 'owner')
    and public.is_notification_student(membership.user_id)
  on conflict (dedupe_key) do nothing;
end;
$$;

revoke all on function public.fanout_circle_membership_notifications(
  uuid, text, text, jsonb, text, uuid, boolean
) from public, anon, authenticated;

create or replace function public.fanout_event_going_notifications(
  p_event_id uuid,
  p_notification_type text,
  p_target_path text,
  p_metadata jsonb,
  p_dedupe_prefix text,
  p_exclude_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if session_user not in ('postgres', 'supabase_admin', 'authenticator') then
    raise exception 'notification emitter unavailable' using errcode = '42501';
  end if;

  insert into public.user_notifications (
    recipient_user_id,
    notification_type,
    target_path,
    metadata,
    dedupe_key
  )
  select
    rsvp.user_id,
    p_notification_type,
    p_target_path,
    coalesce(p_metadata, '{}'::jsonb),
    left(p_dedupe_prefix || ':' || rsvp.user_id::text, 240)
  from public.campus_event_rsvps rsvp
  where rsvp.event_id = p_event_id
    and rsvp.status = 'going'
    and (p_exclude_user_id is null or rsvp.user_id <> p_exclude_user_id)
    and public.is_notification_student(rsvp.user_id)
  on conflict (dedupe_key) do nothing;
end;
$$;

revoke all on function public.fanout_event_going_notifications(
  uuid, text, text, jsonb, text, uuid
) from public, anon, authenticated;

create or replace function public.notify_study_circle_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  circle_row public.study_circles%rowtype;
  safe_title text;
  target_path text;
begin
  select * into circle_row
  from public.study_circles candidate
  where candidate.id = new.circle_id;
  if circle_row.id is null then
    return new;
  end if;

  safe_title := public.notification_safe_label(circle_row.name, 80, 'Study Circle');
  target_path := '/app/circles/' || circle_row.public_slug;

  if new.status = 'active'
    and new.role = 'member'
    and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    perform public.emit_user_notification(
      circle_row.owner_user_id,
      'CIRCLE_MEMBER_JOINED',
      target_path,
      jsonb_build_object('title', safe_title),
      'circle_member_joined:' || circle_row.id::text || ':' || new.user_id::text
    );
  elsif tg_op = 'UPDATE'
    and new.status = 'removed'
    and old.status is distinct from 'removed' then
    perform public.emit_user_notification(
      new.user_id,
      'CIRCLE_MEMBER_REMOVED',
      target_path,
      jsonb_build_object('title', safe_title),
      'circle_member_removed:' || circle_row.id::text || ':' || new.user_id::text
    );
  end if;

  return new;
end;
$$;

revoke all on function public.notify_study_circle_membership()
  from public, anon, authenticated;

create trigger study_circle_memberships_notify_v1
after insert or update of status on public.study_circle_memberships
for each row execute function public.notify_study_circle_membership();

create or replace function public.notify_study_circle_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_title text;
  target_path text;
begin
  safe_title := public.notification_safe_label(new.name, 80, 'Study Circle');
  target_path := '/app/circles/' || new.public_slug;

  if old.status is distinct from 'archived' and new.status = 'archived' then
    perform public.fanout_circle_membership_notifications(
      new.id,
      'CIRCLE_ARCHIVED',
      target_path,
      jsonb_build_object('title', safe_title),
      'circle_archived:' || new.id::text,
      new.owner_user_id,
      false
    );
    return new;
  end if;

  if new.status = 'active'
    and (
      old.name is distinct from new.name
      or old.topic is distinct from new.topic
    ) then
    perform public.fanout_circle_membership_notifications(
      new.id,
      'CIRCLE_UPDATED',
      target_path,
      jsonb_build_object('title', safe_title),
      'circle_updated:'
        || new.id::text
        || ':'
        || md5(coalesce(new.name, '') || chr(31) || coalesce(new.topic, '')),
      new.owner_user_id,
      false
    );
  end if;

  return new;
end;
$$;

revoke all on function public.notify_study_circle_change()
  from public, anon, authenticated;

create trigger study_circles_notify_v1
after update on public.study_circles
for each row execute function public.notify_study_circle_change();

create or replace function public.notify_campus_event_rsvp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.campus_events%rowtype;
  safe_title text;
begin
  if new.status is distinct from 'going'
    or (tg_op = 'UPDATE' and old.status is not distinct from 'going') then
    return new;
  end if;

  select * into event_row
  from public.campus_events candidate
  where candidate.id = new.event_id;
  if event_row.id is null
    or event_row.organizer_user_id = new.user_id then
    return new;
  end if;

  safe_title := public.notification_safe_label(event_row.title, 100, 'Campus Event');
  perform public.emit_user_notification(
    new.user_id,
    'EVENT_REGISTERED',
    '/app/events/' || event_row.public_slug,
    jsonb_build_object('title', safe_title),
    'event_registered:' || event_row.id::text || ':' || new.user_id::text
  );

  return new;
end;
$$;

revoke all on function public.notify_campus_event_rsvp()
  from public, anon, authenticated;

create trigger campus_event_rsvps_notify_v1
after insert or update of status on public.campus_event_rsvps
for each row execute function public.notify_campus_event_rsvp();

create or replace function public.notify_campus_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_title text;
  target_path text;
  when_text text;
  venue_text text;
  schedule_changed boolean;
  location_changed boolean;
begin
  safe_title := public.notification_safe_label(new.title, 100, 'Campus Event');
  target_path := '/app/events/' || new.public_slug;

  if old.status is distinct from 'cancelled' and new.status = 'cancelled' then
    perform public.fanout_event_going_notifications(
      new.id,
      'EVENT_CANCELLED',
      target_path,
      jsonb_build_object('title', safe_title),
      'event_cancelled:' || new.id::text,
      new.organizer_user_id
    );
    return new;
  end if;

  if new.status is distinct from 'scheduled' then
    return new;
  end if;

  schedule_changed :=
    old.starts_at is distinct from new.starts_at
    or old.ends_at is distinct from new.ends_at
    or old.timezone_name is distinct from new.timezone_name;
  location_changed :=
    old.venue_name is distinct from new.venue_name
    or old.venue_area is distinct from new.venue_area
    or old.city is distinct from new.city
    or old.venue_category is distinct from new.venue_category;

  if schedule_changed then
    when_text := public.notification_safe_label(
      to_char(new.starts_at at time zone new.timezone_name, 'YYYY-MM-DD HH24:MI')
        || ' '
        || case new.timezone_name
          when 'Asia/Makassar' then 'WITA'
          when 'Asia/Jayapura' then 'WIT'
          else 'WIB'
        end,
      64,
      'jadwal baru'
    );
    perform public.fanout_event_going_notifications(
      new.id,
      'EVENT_SCHEDULE_CHANGED',
      target_path,
      jsonb_build_object('title', safe_title, 'when_label', when_text),
      'event_schedule_changed:'
        || new.id::text
        || ':'
        || to_char(new.starts_at at time zone 'utc', 'YYYYMMDDHH24MISS')
        || ':'
        || to_char(new.ends_at at time zone 'utc', 'YYYYMMDDHH24MISS')
        || ':'
        || new.timezone_name,
      new.organizer_user_id
    );
  end if;

  if location_changed then
    venue_text := public.notification_safe_label(
      btrim(new.venue_name) || ' · ' || btrim(new.city),
      160,
      'tempat publik'
    );
    perform public.fanout_event_going_notifications(
      new.id,
      'EVENT_LOCATION_CHANGED',
      target_path,
      jsonb_build_object('title', safe_title, 'venue_label', venue_text),
      'event_location_changed:'
        || new.id::text
        || ':'
        || md5(
          coalesce(new.venue_category, '')
          || chr(31)
          || coalesce(new.venue_name, '')
          || chr(31)
          || coalesce(new.venue_area, '')
          || chr(31)
          || coalesce(new.city, '')
        ),
      new.organizer_user_id
    );
  end if;

  return new;
end;
$$;

revoke all on function public.notify_campus_event_change()
  from public, anon, authenticated;

create trigger campus_events_notify_v1
after update on public.campus_events
for each row execute function public.notify_campus_event_change();

drop function if exists public.list_my_notifications(integer, timestamptz, text, boolean);

create function public.list_my_notifications(
  p_limit integer default 21,
  p_before_created_at timestamptz default null,
  p_before_public_id text default null,
  p_unread_only boolean default false
)
returns table (
  notification_public_id text,
  notification_type text,
  target_path text,
  channel text,
  headline text,
  when_label text,
  venue_label text,
  created_at timestamptz,
  read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 21), 1), 51);
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_notification_student(current_user_id) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if (p_before_created_at is null) <> (p_before_public_id is null)
    or (
      p_before_public_id is not null
      and p_before_public_id !~ '^[0-9a-f]{32}$'
    ) then
    raise exception 'invalid notification cursor' using errcode = '22023';
  end if;

  return query
  select
    notification.public_id,
    notification.notification_type,
    notification.target_path,
    case
      when notification.notification_type = 'CONTACT_REVEAL_COMPLETED'
        then notification.metadata->>'channel'
      else null
    end,
    case
      when notification.metadata ? 'title'
        then left(notification.metadata->>'title', 100)
      else null
    end,
    case
      when notification.metadata ? 'when_label'
        then left(notification.metadata->>'when_label', 64)
      else null
    end,
    case
      when notification.metadata ? 'venue_label'
        then left(notification.metadata->>'venue_label', 160)
      else null
    end,
    notification.created_at,
    notification.read_at
  from public.user_notifications notification
  where notification.recipient_user_id = current_user_id
    and (not coalesce(p_unread_only, false) or notification.read_at is null)
    and (
      p_before_created_at is null
      or (notification.created_at, notification.public_id)
        < (p_before_created_at, p_before_public_id)
    )
  order by notification.created_at desc, notification.public_id desc
  limit safe_limit;
end;
$$;

revoke all on function public.list_my_notifications(integer, timestamptz, text, boolean)
  from public, anon;
grant execute on function public.list_my_notifications(integer, timestamptz, text, boolean)
  to authenticated;
