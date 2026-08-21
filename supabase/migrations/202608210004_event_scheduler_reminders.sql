-- Generic product scheduler v1 with in-app Campus Event reminders.

create table public.product_scheduler_runs (
  job_name text primary key,
  last_started_at timestamptz null,
  last_succeeded_at timestamptz null,
  last_result_count integer not null default 0 check (last_result_count >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.product_scheduler_runs enable row level security;
revoke all on table public.product_scheduler_runs from public, anon, authenticated;

create table public.campus_event_reminder_receipts (
  event_id uuid not null references public.campus_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_kind text not null check (reminder_kind in ('24h', '2h')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (event_id, user_id, reminder_kind)
);
alter table public.campus_event_reminder_receipts enable row level security;
revoke all on table public.campus_event_reminder_receipts
  from public, anon, authenticated;
create trigger campus_event_reminder_receipts_reject_deletion_locked_mutation
before insert or update or delete on public.campus_event_reminder_receipts
for each row execute function public.reject_account_deletion_locked_mutation();

alter table public.user_notifications
  drop constraint user_notifications_type_allowed,
  drop constraint user_notifications_metadata_safe;
alter table public.user_notifications
  add constraint user_notifications_type_allowed check (notification_type in (
    'INTRODUCTION_RECEIVED', 'INTRODUCTION_ACCEPTED', 'MESSAGE_RECEIVED',
    'MUTUAL_INTEREST_COMPLETED', 'IDENTITY_REVEAL_COMPLETED',
    'CONTACT_REVEAL_COMPLETED', 'CIRCLE_MEMBER_JOINED', 'CIRCLE_UPDATED',
    'CIRCLE_ARCHIVED', 'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED',
    'EVENT_SCHEDULE_CHANGED', 'EVENT_LOCATION_CHANGED', 'EVENT_CANCELLED',
    'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED', 'MEETING_PLAN_CANCELLED',
    'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H'
  )),
  add constraint user_notifications_metadata_safe check (
    (
      notification_type = 'CONTACT_REVEAL_COMPLETED'
      and metadata ? 'channel'
      and metadata->>'channel' in ('telegram', 'instagram', 'linkedin')
      and metadata - 'channel' = '{}'::jsonb
    )
    or (
      notification_type in (
        'CIRCLE_MEMBER_JOINED', 'CIRCLE_UPDATED', 'CIRCLE_ARCHIVED',
        'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED', 'EVENT_CANCELLED'
      )
      and metadata ? 'title'
      and jsonb_typeof(metadata->'title') = 'string'
      and char_length(metadata->>'title') between 1 and 100
      and metadata - 'title' = '{}'::jsonb
    )
    or (
      notification_type in (
        'EVENT_SCHEDULE_CHANGED', 'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H'
      )
      and metadata ? 'title' and metadata ? 'when_label'
      and jsonb_typeof(metadata->'title') = 'string'
      and jsonb_typeof(metadata->'when_label') = 'string'
      and char_length(metadata->>'title') between 1 and 100
      and char_length(metadata->>'when_label') between 1 and 64
      and metadata - 'title' - 'when_label' = '{}'::jsonb
    )
    or (
      notification_type = 'EVENT_LOCATION_CHANGED'
      and metadata ? 'title' and metadata ? 'venue_label'
      and jsonb_typeof(metadata->'title') = 'string'
      and jsonb_typeof(metadata->'venue_label') = 'string'
      and char_length(metadata->>'title') between 1 and 100
      and char_length(metadata->>'venue_label') between 1 and 160
      and metadata - 'title' - 'venue_label' = '{}'::jsonb
    )
    or (
      notification_type in (
        'INTRODUCTION_RECEIVED', 'INTRODUCTION_ACCEPTED', 'MESSAGE_RECEIVED',
        'MUTUAL_INTEREST_COMPLETED', 'IDENTITY_REVEAL_COMPLETED',
        'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED',
        'MEETING_PLAN_CANCELLED'
      )
      and metadata = '{}'::jsonb
    )
  );

create or replace function public.product_scheduler_tick()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare inserted_count integer := 0; reminder record;
begin
  if session_user not in ('postgres', 'supabase_admin') and auth.role() <> 'service_role' then
    raise exception 'scheduler unavailable' using errcode = '42501';
  end if;
  insert into public.product_scheduler_runs (job_name, last_started_at)
  values ('product-scheduler-v1', timezone('utc', now()))
  on conflict (job_name) do update
    set last_started_at = excluded.last_started_at, updated_at = excluded.last_started_at;

  for reminder in
    select event.id event_id, event.public_slug, event.title,
      event.starts_at, event.timezone_name, rsvp.user_id,
      '24h'::text kind, 'EVENT_REMINDER_24H'::text notification_type
    from public.campus_events event
    join public.campus_event_rsvps rsvp
      on rsvp.event_id = event.id and rsvp.status = 'going'
    where event.status = 'scheduled'
      and rsvp.user_id is not null
      and public.is_notification_student(rsvp.user_id)
      and event.starts_at > timezone('utc', now()) + interval '2 hours'
      and event.starts_at <= timezone('utc', now()) + interval '24 hours'
    union all
    select event.id, event.public_slug, event.title,
      event.starts_at, event.timezone_name, rsvp.user_id,
      '2h', 'EVENT_REMINDER_2H'
    from public.campus_events event
    join public.campus_event_rsvps rsvp
      on rsvp.event_id = event.id and rsvp.status = 'going'
    where event.status = 'scheduled'
      and rsvp.user_id is not null
      and public.is_notification_student(rsvp.user_id)
      and event.starts_at > timezone('utc', now())
      and event.starts_at <= timezone('utc', now()) + interval '2 hours'
  loop
    insert into public.campus_event_reminder_receipts (event_id, user_id, reminder_kind)
    values (reminder.event_id, reminder.user_id, reminder.kind)
    on conflict do nothing;
    if found then
      perform public.emit_user_notification(
        reminder.user_id,
        reminder.notification_type,
        '/app/events/' || reminder.public_slug,
        jsonb_build_object(
          'title', public.notification_safe_label(
            reminder.title, 100, 'Campus Event'
          ),
          'when_label', public.notification_safe_label(
            to_char(
              reminder.starts_at at time zone reminder.timezone_name,
              'YYYY-MM-DD HH24:MI'
            ),
            64, 'jadwal event'
          )
        ),
        'event_reminder:' || reminder.kind || ':' || reminder.event_id::text
          || ':' || reminder.user_id::text
      );
      inserted_count := inserted_count + 1;
    end if;
  end loop;

  perform public.purge_expired_meeting_plan_details(100);
  update public.product_scheduler_runs
  set last_succeeded_at = timezone('utc', now()),
      last_result_count = inserted_count,
      updated_at = timezone('utc', now())
  where job_name = 'product-scheduler-v1';
  return inserted_count;
end;
$$;
revoke all on function public.product_scheduler_tick()
  from public, anon, authenticated;
grant execute on function public.product_scheduler_tick() to service_role;

create extension if not exists pg_cron;
