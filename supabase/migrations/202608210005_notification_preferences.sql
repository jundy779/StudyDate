-- Per-type in-app notification preferences. External channels stay future/off.

create table public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_type text not null,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false check (email_enabled = false),
  telegram_enabled boolean not null default false check (telegram_enabled = false),
  web_push_enabled boolean not null default false check (web_push_enabled = false),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, notification_type),
  constraint notification_preferences_type check (notification_type in (
    'INTRODUCTION_RECEIVED', 'INTRODUCTION_ACCEPTED', 'MESSAGE_RECEIVED',
    'MUTUAL_INTEREST_COMPLETED', 'IDENTITY_REVEAL_COMPLETED',
    'CONTACT_REVEAL_COMPLETED', 'CIRCLE_MEMBER_JOINED', 'CIRCLE_UPDATED',
    'CIRCLE_ARCHIVED', 'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED',
    'EVENT_SCHEDULE_CHANGED', 'EVENT_LOCATION_CHANGED', 'EVENT_CANCELLED',
    'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED', 'MEETING_PLAN_CANCELLED',
    'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H', 'EVENT_WAITLIST_PROMOTED'
  ))
);
alter table public.notification_preferences enable row level security;
revoke all on table public.notification_preferences from public, anon, authenticated;
create trigger notification_preferences_reject_deletion_locked_mutation
before insert or update or delete on public.notification_preferences
for each row execute function public.reject_account_deletion_locked_mutation();

create or replace function public.list_my_notification_preferences()
returns table (notification_type text, in_app_enabled boolean)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  return query select preference.notification_type, preference.in_app_enabled
  from public.notification_preferences preference
  where preference.user_id = actor order by preference.notification_type;
end; $$;

create or replace function public.set_my_notification_preference(
  p_notification_type text, p_in_app_enabled boolean
)
returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_notification_type not in (
    'INTRODUCTION_RECEIVED', 'INTRODUCTION_ACCEPTED', 'MESSAGE_RECEIVED',
    'MUTUAL_INTEREST_COMPLETED', 'IDENTITY_REVEAL_COMPLETED',
    'CONTACT_REVEAL_COMPLETED', 'CIRCLE_MEMBER_JOINED', 'CIRCLE_UPDATED',
    'CIRCLE_ARCHIVED', 'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED',
    'EVENT_SCHEDULE_CHANGED', 'EVENT_LOCATION_CHANGED', 'EVENT_CANCELLED',
    'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED', 'MEETING_PLAN_CANCELLED',
    'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H', 'EVENT_WAITLIST_PROMOTED'
  ) or p_in_app_enabled is null then
    raise exception 'invalid preference' using errcode = '22023';
  end if;
  insert into public.notification_preferences (
    user_id, notification_type, in_app_enabled
  ) values (actor, p_notification_type, p_in_app_enabled)
  on conflict (user_id, notification_type) do update
    set in_app_enabled = excluded.in_app_enabled,
        updated_at = timezone('utc', now());
end; $$;

revoke all on function public.list_my_notification_preferences() from public, anon;
grant execute on function public.list_my_notification_preferences() to authenticated;
revoke all on function public.set_my_notification_preference(text, boolean)
  from public, anon;
grant execute on function public.set_my_notification_preference(text, boolean)
  to authenticated;

create or replace function public.emit_user_notification(
  p_recipient_user_id uuid, p_notification_type text, p_target_path text,
  p_metadata jsonb, p_dedupe_key text
)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if session_user not in ('postgres', 'supabase_admin', 'authenticator') then
    raise exception 'notification emitter unavailable' using errcode = '42501';
  end if;
  if not public.is_notification_student(p_recipient_user_id)
    or exists (
      select 1 from public.notification_preferences preference
      where preference.user_id = p_recipient_user_id
        and preference.notification_type = p_notification_type
        and not preference.in_app_enabled
    ) then return; end if;
  insert into public.user_notifications (
    recipient_user_id, notification_type, target_path, metadata, dedupe_key
  ) values (
    p_recipient_user_id, p_notification_type, p_target_path,
    coalesce(p_metadata, '{}'::jsonb), p_dedupe_key
  ) on conflict (dedupe_key) do nothing;
end; $$;
revoke all on function public.emit_user_notification(uuid, text, text, jsonb, text)
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
    recipient_user_id, notification_type, target_path, metadata, dedupe_key
  )
  select membership.user_id, p_notification_type, p_target_path,
    coalesce(p_metadata, '{}'::jsonb),
    left(p_dedupe_prefix || ':' || membership.user_id::text, 240)
  from public.study_circle_memberships membership
  where membership.circle_id = p_circle_id
    and membership.status = 'active'
    and (p_exclude_user_id is null or membership.user_id <> p_exclude_user_id)
    and (not coalesce(p_owner_only, false) or membership.role = 'owner')
    and public.is_notification_student(membership.user_id)
    and not exists (
      select 1 from public.notification_preferences preference
      where preference.user_id = membership.user_id
        and preference.notification_type = p_notification_type
        and not preference.in_app_enabled
    )
  on conflict (dedupe_key) do nothing;
end;
$$;

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
    recipient_user_id, notification_type, target_path, metadata, dedupe_key
  )
  select rsvp.user_id, p_notification_type, p_target_path,
    coalesce(p_metadata, '{}'::jsonb),
    left(p_dedupe_prefix || ':' || rsvp.user_id::text, 240)
  from public.campus_event_rsvps rsvp
  where rsvp.event_id = p_event_id and rsvp.status = 'going'
    and rsvp.user_id is not null
    and (p_exclude_user_id is null or rsvp.user_id <> p_exclude_user_id)
    and public.is_notification_student(rsvp.user_id)
    and not exists (
      select 1 from public.notification_preferences preference
      where preference.user_id = rsvp.user_id
        and preference.notification_type = p_notification_type
        and not preference.in_app_enabled
    )
  on conflict (dedupe_key) do nothing;
end;
$$;

revoke all on function public.fanout_circle_membership_notifications(
  uuid, text, text, jsonb, text, uuid, boolean
) from public, anon, authenticated;
revoke all on function public.fanout_event_going_notifications(
  uuid, text, text, jsonb, text, uuid
) from public, anon, authenticated;
