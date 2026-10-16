-- Event Blast v1. Repository migration only; production preflight is required before apply.
-- Sends privacy-safe in-app announcements to confirmed event participants.

create table public.campus_event_announcements (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default encode(gen_random_bytes(16), 'hex'),
  event_id uuid not null references public.campus_events (id) on delete cascade,
  author_user_id uuid null references auth.users (id) on delete set null,
  title text not null check (
    char_length(btrim(title)) between 5 and 100
    and title !~ '[<>{}]'
    and title !~ '[[:cntrl:]]'
  ),
  body text not null check (
    char_length(btrim(body)) between 10 and 1200
    and body !~ '<[^>]+>'
  ),
  audience text not null default 'going' check (audience = 'going'),
  client_idempotency_key text not null check (
    client_idempotency_key ~ '^[A-Za-z0-9_-]{16,80}$'
  ),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (event_id, author_user_id, client_idempotency_key)
);

create index campus_event_announcements_event_created_idx
  on public.campus_event_announcements (event_id, created_at desc, public_id desc);

alter table public.campus_event_announcements enable row level security;
revoke all on table public.campus_event_announcements
  from public, anon, authenticated;

create trigger campus_event_announcements_reject_deletion_locked_mutation
before insert or update or delete on public.campus_event_announcements
for each row execute function public.reject_account_deletion_locked_mutation();

alter table public.campus_event_audit_events
  drop constraint campus_event_audit_type,
  add constraint campus_event_audit_type check (event_type in (
    'created', 'updated', 'rsvp_joined', 'rsvp_cancelled', 'cancelled',
    'archived', 'event_reported', 'organizer_reported',
    'team_invited', 'team_accepted', 'team_declined', 'team_removed',
    'registration_submitted', 'registration_approved',
    'registration_declined', 'ticket_issued', 'ticket_regenerated',
    'checked_in_qr', 'checked_in_manual', 'checkin_undone',
    'official_enabled', 'official_disabled', 'announcement_sent'
  ));

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
    'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H', 'EVENT_WAITLIST_PROMOTED',
    'EVENT_REGISTRATION_PENDING', 'EVENT_REGISTRATION_APPROVED',
    'EVENT_REGISTRATION_DECLINED', 'EVENT_WAITLISTED', 'EVENT_TEAM_INVITED',
    'EVENT_ANNOUNCEMENT'
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
        'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED', 'EVENT_CANCELLED',
        'EVENT_WAITLIST_PROMOTED', 'EVENT_REGISTRATION_PENDING',
        'EVENT_REGISTRATION_APPROVED', 'EVENT_REGISTRATION_DECLINED',
        'EVENT_WAITLISTED', 'EVENT_TEAM_INVITED', 'EVENT_ANNOUNCEMENT'
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
      and char_length(metadata->>'title') between 1 and 100
      and char_length(metadata->>'when_label') between 1 and 64
      and metadata - 'title' - 'when_label' = '{}'::jsonb
    )
    or (
      notification_type = 'EVENT_LOCATION_CHANGED'
      and metadata ? 'title' and metadata ? 'venue_label'
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
      ) and metadata = '{}'::jsonb
    )
  );

alter table public.notification_preferences
  drop constraint notification_preferences_type,
  add constraint notification_preferences_type check (notification_type in (
    'INTRODUCTION_RECEIVED', 'INTRODUCTION_ACCEPTED', 'MESSAGE_RECEIVED',
    'MUTUAL_INTEREST_COMPLETED', 'IDENTITY_REVEAL_COMPLETED',
    'CONTACT_REVEAL_COMPLETED', 'CIRCLE_MEMBER_JOINED', 'CIRCLE_UPDATED',
    'CIRCLE_ARCHIVED', 'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED',
    'EVENT_SCHEDULE_CHANGED', 'EVENT_LOCATION_CHANGED', 'EVENT_CANCELLED',
    'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED', 'MEETING_PLAN_CANCELLED',
    'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H', 'EVENT_WAITLIST_PROMOTED',
    'EVENT_REGISTRATION_PENDING', 'EVENT_REGISTRATION_APPROVED',
    'EVENT_REGISTRATION_DECLINED', 'EVENT_WAITLISTED', 'EVENT_TEAM_INVITED',
    'EVENT_ANNOUNCEMENT'
  ));

create or replace function public.set_my_notification_preference(
  p_notification_type text, p_in_app_enabled boolean
)
returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_notification_type not in (
    'INTRODUCTION_RECEIVED', 'INTRODUCTION_ACCEPTED', 'MESSAGE_RECEIVED',
    'MUTUAL_INTEREST_COMPLETED', 'IDENTITY_REVEAL_COMPLETED',
    'CONTACT_REVEAL_COMPLETED', 'CIRCLE_MEMBER_JOINED', 'CIRCLE_UPDATED',
    'CIRCLE_ARCHIVED', 'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED',
    'EVENT_SCHEDULE_CHANGED', 'EVENT_LOCATION_CHANGED', 'EVENT_CANCELLED',
    'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED', 'MEETING_PLAN_CANCELLED',
    'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H', 'EVENT_WAITLIST_PROMOTED',
    'EVENT_REGISTRATION_PENDING', 'EVENT_REGISTRATION_APPROVED',
    'EVENT_REGISTRATION_DECLINED', 'EVENT_WAITLISTED', 'EVENT_TEAM_INVITED',
    'EVENT_ANNOUNCEMENT'
  ) or p_in_app_enabled is null then
    raise exception 'invalid preference' using errcode = '22023';
  end if;
  insert into public.notification_preferences (
    user_id, notification_type, in_app_enabled
  ) values (actor, p_notification_type, p_in_app_enabled)
  on conflict (user_id, notification_type) do update
    set in_app_enabled = excluded.in_app_enabled,
        updated_at = timezone('utc', now());
end;
$$;

create or replace function public.create_campus_event_announcement(
  p_public_slug text,
  p_title text,
  p_body text,
  p_client_idempotency_key text
)
returns table (announcement_public_id text, recipient_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  announcement_row public.campus_event_announcements%rowtype;
  inserted_count integer := 0;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select event.* into event_row
  from public.campus_events event
  where event.public_slug = p_public_slug
  for update;
  if event_row.id is null
    or not public.event_can_manage_registrations(event_row.id, actor) then
    raise exception 'event management required' using errcode = '42501';
  end if;
  if event_row.status <> 'scheduled' then
    raise exception 'event announcement unavailable' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 5 and 100
    or p_title ~ '[<>{}]' or p_title ~ '[[:cntrl:]]'
    or char_length(btrim(coalesce(p_body, ''))) not between 10 and 1200
    or p_body ~ '<[^>]+>'
    or coalesce(p_client_idempotency_key, '') !~ '^[A-Za-z0-9_-]{16,80}$' then
    raise exception 'invalid event announcement' using errcode = '22023';
  end if;
  if not public.consume_campus_event_rate_limit(
    actor, 'announcement_day', 5, 86400
  ) then
    raise exception 'event announcement rate limited' using errcode = 'P0001';
  end if;

  insert into public.campus_event_announcements (
    event_id, author_user_id, title, body, client_idempotency_key
  ) values (
    event_row.id, actor, btrim(p_title), btrim(p_body),
    p_client_idempotency_key
  )
  on conflict (event_id, author_user_id, client_idempotency_key)
  do update set client_idempotency_key = excluded.client_idempotency_key
  returning * into announcement_row;

  insert into public.user_notifications (
    recipient_user_id, notification_type, target_path, metadata, dedupe_key
  )
  select rsvp.user_id, 'EVENT_ANNOUNCEMENT',
    '/app/events/' || event_row.public_slug || '#event-announcements',
    jsonb_build_object('title', left(announcement_row.title, 100)),
    left(
      'event_announcement:' || announcement_row.id::text || ':' ||
      rsvp.user_id::text,
      240
    )
  from public.campus_event_rsvps rsvp
  where rsvp.event_id = event_row.id
    and rsvp.status = 'going'
    and rsvp.user_id is not null
    and rsvp.user_id <> actor
    and public.is_notification_student(rsvp.user_id)
    and not exists (
      select 1 from public.notification_preferences preference
      where preference.user_id = rsvp.user_id
        and preference.notification_type = 'EVENT_ANNOUNCEMENT'
        and not preference.in_app_enabled
    )
  on conflict (dedupe_key) do nothing;
  get diagnostics inserted_count = row_count;

  update public.campus_event_announcements
  set recipient_count = greatest(recipient_count, inserted_count)
  where id = announcement_row.id;

  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (event_row.id, actor, 'announcement_sent');

  return query select announcement_row.public_id, inserted_count;
end;
$$;

create or replace function public.list_campus_event_announcements(
  p_public_slug text,
  p_limit integer default 20
)
returns table (
  announcement_public_id text,
  title text,
  body text,
  recipient_count integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_id_value uuid;
  can_manage boolean := false;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select event.id,
    public.event_can_manage_registrations(event.id, actor)
  into event_id_value, can_manage
  from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_id_value is null or (
    not can_manage and not exists (
      select 1 from public.campus_event_rsvps rsvp
      where rsvp.event_id = event_id_value
        and rsvp.user_id = actor
        and rsvp.status = 'going'
    )
  ) then
    raise exception 'event announcement unavailable' using errcode = '42501';
  end if;

  return query
  select announcement.public_id, announcement.title, announcement.body,
    case when can_manage then announcement.recipient_count else 0 end,
    announcement.created_at
  from public.campus_event_announcements announcement
  where announcement.event_id = event_id_value
  order by announcement.created_at desc, announcement.public_id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

revoke all on function public.create_campus_event_announcement(
  text, text, text, text
) from public, anon;
grant execute on function public.create_campus_event_announcement(
  text, text, text, text
) to authenticated;

revoke all on function public.list_campus_event_announcements(text, integer)
  from public, anon;
grant execute on function public.list_campus_event_announcements(text, integer)
  to authenticated;
