-- Notifications v1 (local-only; do not apply remotely in this task).
-- Privacy boundary: only completed two-party reveal events are notified.
-- One-sided Mutual Interest, Identity Reveal, and Contact Reveal never emit rows.

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  notification_type text not null,
  target_path text not null,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz null,
  constraint user_notifications_public_id_format
    check (public_id ~ '^[0-9a-f]{32}$'),
  constraint user_notifications_type_allowed
    check (notification_type in (
      'INTRODUCTION_RECEIVED',
      'INTRODUCTION_ACCEPTED',
      'MESSAGE_RECEIVED',
      'MUTUAL_INTEREST_COMPLETED',
      'IDENTITY_REVEAL_COMPLETED',
      'CONTACT_REVEAL_COMPLETED'
    )),
  constraint user_notifications_target_safe
    check (
      target_path = '/app/introductions'
      or target_path ~ '^/app/messages/[0-9a-f]{32}$'
    ),
  constraint user_notifications_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint user_notifications_metadata_safe
    check (
      (
        notification_type = 'CONTACT_REVEAL_COMPLETED'
        and metadata ? 'channel'
        and metadata->>'channel' in ('telegram', 'instagram', 'linkedin')
        and metadata - 'channel' = '{}'::jsonb
      )
      or (
        notification_type <> 'CONTACT_REVEAL_COMPLETED'
        and metadata = '{}'::jsonb
      )
    ),
  constraint user_notifications_read_after_create
    check (read_at is null or read_at >= created_at),
  constraint user_notifications_dedupe_length
    check (char_length(dedupe_key) between 1 and 240)
);

comment on table public.user_notifications is
  'Private in-app Notifications v1. Stores only recipient, constrained event type, safe route, safe channel metadata, timestamps, and an internal dedupe key.';
comment on column public.user_notifications.dedupe_key is
  'Internal deterministic idempotency key. Never returned by student projections.';

create index user_notifications_recipient_created_idx
  on public.user_notifications (recipient_user_id, created_at desc, public_id desc);
create index user_notifications_recipient_unread_idx
  on public.user_notifications (recipient_user_id, created_at desc, public_id desc)
  where read_at is null;

alter table public.user_notifications enable row level security;
revoke all on table public.user_notifications from public, anon, authenticated;

create or replace function public.is_notification_student(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and exists (
      select 1
      from public.profiles profile
      where profile.user_id = p_user_id
        and profile.onboarding_completed_at is not null
    )
    and not public.is_active_staff_user(p_user_id);
$$;

revoke all on function public.is_notification_student(uuid)
  from public, anon, authenticated;

create or replace function public.emit_user_notification(
  p_recipient_user_id uuid,
  p_notification_type text,
  p_target_path text,
  p_metadata jsonb,
  p_dedupe_key text
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

  if not public.is_notification_student(p_recipient_user_id) then
    return;
  end if;

  insert into public.user_notifications (
    recipient_user_id,
    notification_type,
    target_path,
    metadata,
    dedupe_key
  )
  values (
    p_recipient_user_id,
    p_notification_type,
    p_target_path,
    coalesce(p_metadata, '{}'::jsonb),
    p_dedupe_key
  )
  on conflict (dedupe_key) do nothing;
end;
$$;

revoke all on function public.emit_user_notification(uuid, text, text, jsonb, text)
  from public, anon, authenticated;

create or replace function public.notify_introduction_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.emit_user_notification(
      new.recipient_id,
      'INTRODUCTION_RECEIVED',
      '/app/introductions',
      '{}'::jsonb,
      'introduction_received:' || new.id::text
    );
  elsif tg_op = 'UPDATE'
    and old.status is distinct from 'accepted'
    and new.status = 'accepted' then
    perform public.emit_user_notification(
      new.sender_id,
      'INTRODUCTION_ACCEPTED',
      '/app/introductions',
      '{}'::jsonb,
      'introduction_accepted:' || new.id::text
    );
  end if;

  return new;
end;
$$;

revoke all on function public.notify_introduction_transition()
  from public, anon, authenticated;

create trigger introduction_requests_notify_v1
after insert or update of status on public.introduction_requests
for each row execute function public.notify_introduction_transition();

create or replace function public.notify_anonymous_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  shell public.conversation_shells%rowtype;
  recipient_user_id uuid;
begin
  select * into shell
  from public.conversation_shells candidate
  where candidate.id = new.conversation_id;

  if shell.id is null or shell.status in ('ended', 'blocked') then
    return new;
  end if;

  recipient_user_id := case
    when new.sender_id = shell.participant_sender_id
      then shell.participant_recipient_id
    when new.sender_id = shell.participant_recipient_id
      then shell.participant_sender_id
    else null
  end;

  if recipient_user_id is null
    or public.users_are_blocked(new.sender_id, recipient_user_id) then
    return new;
  end if;

  perform public.emit_user_notification(
    recipient_user_id,
    'MESSAGE_RECEIVED',
    '/app/messages/' || shell.public_id,
    '{}'::jsonb,
    'message_received:' || new.id::text
  );

  return new;
end;
$$;

revoke all on function public.notify_anonymous_message()
  from public, anon, authenticated;

create trigger anonymous_messages_notify_v1
after insert on public.anonymous_messages
for each row execute function public.notify_anonymous_message();

create or replace function public.notify_completed_connection_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  shell public.conversation_shells%rowtype;
  notification_type text;
  event_metadata jsonb := '{}'::jsonb;
  dedupe_prefix text;
begin
  if new.event_type not in (
    'mutual_interest_reached',
    'identity_revealed',
    'contact_revealed'
  ) then
    return new;
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.id = new.conversation_id;

  if shell.id is null or shell.status in ('ended', 'blocked') then
    return new;
  end if;

  if new.event_type = 'mutual_interest_reached' then
    if shell.mutual_interest_at is null then
      return new;
    end if;
    notification_type := 'MUTUAL_INTEREST_COMPLETED';
    dedupe_prefix := 'mutual_completed:' || shell.id::text;
  elsif new.event_type = 'identity_revealed' then
    if shell.identity_revealed_at is null then
      return new;
    end if;
    notification_type := 'IDENTITY_REVEAL_COMPLETED';
    dedupe_prefix := 'identity_completed:' || shell.id::text;
  else
    if new.event_channel not in ('telegram', 'instagram', 'linkedin')
      or not exists (
        select 1
        from public.conversation_contact_reveals reveal
        where reveal.conversation_id = shell.id
          and reveal.channel = new.event_channel
      ) then
      return new;
    end if;
    notification_type := 'CONTACT_REVEAL_COMPLETED';
    event_metadata := jsonb_build_object('channel', new.event_channel);
    dedupe_prefix :=
      'contact_completed:' || shell.id::text || ':' || new.event_channel;
  end if;

  perform public.emit_user_notification(
    shell.participant_sender_id,
    notification_type,
    '/app/messages/' || shell.public_id,
    event_metadata,
    dedupe_prefix || ':' || shell.participant_sender_id::text
  );
  perform public.emit_user_notification(
    shell.participant_recipient_id,
    notification_type,
    '/app/messages/' || shell.public_id,
    event_metadata,
    dedupe_prefix || ':' || shell.participant_recipient_id::text
  );

  return new;
end;
$$;

revoke all on function public.notify_completed_connection_event()
  from public, anon, authenticated;

create trigger conversation_events_notify_v1
after insert on public.conversation_events
for each row execute function public.notify_completed_connection_event();

create or replace function public.list_my_notifications(
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

create or replace function public.count_my_unread_notifications()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  unread_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_notification_student(current_user_id) then
    raise exception 'student access required' using errcode = '42501';
  end if;

  select count(*)::integer into unread_count
  from public.user_notifications notification
  where notification.recipient_user_id = current_user_id
    and notification.read_at is null;

  return unread_count;
end;
$$;

create or replace function public.mark_my_notification_read(
  p_notification_public_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_notification_student(current_user_id) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_notification_public_id is null
    or p_notification_public_id !~ '^[0-9a-f]{32}$' then
    raise exception 'notification unavailable' using errcode = 'P0002';
  end if;

  update public.user_notifications notification
  set read_at = coalesce(notification.read_at, timezone('utc', now()))
  where notification.public_id = p_notification_public_id
    and notification.recipient_user_id = current_user_id;

  return found;
end;
$$;

create or replace function public.mark_all_my_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  updated_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_notification_student(current_user_id) then
    raise exception 'student access required' using errcode = '42501';
  end if;

  update public.user_notifications notification
  set read_at = timezone('utc', now())
  where notification.recipient_user_id = current_user_id
    and notification.read_at is null;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.list_my_notifications(integer, timestamptz, text, boolean)
  from public, anon;
revoke all on function public.count_my_unread_notifications()
  from public, anon;
revoke all on function public.mark_my_notification_read(text)
  from public, anon;
revoke all on function public.mark_all_my_notifications_read()
  from public, anon;

grant execute on function public.list_my_notifications(integer, timestamptz, text, boolean)
  to authenticated;
grant execute on function public.count_my_unread_notifications()
  to authenticated;
grant execute on function public.mark_my_notification_read(text)
  to authenticated;
grant execute on function public.mark_all_my_notifications_read()
  to authenticated;
