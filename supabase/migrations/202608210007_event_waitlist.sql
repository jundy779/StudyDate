-- Atomic Campus Event waitlist and first-in promotion.

create table public.campus_event_waitlist (
  event_id uuid not null references public.campus_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'waiting' check (
    status in ('waiting', 'promoted', 'left', 'cancelled')
  ),
  joined_at timestamptz not null default timezone('utc', now()),
  promoted_at timestamptz null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (event_id, user_id),
  constraint campus_event_waitlist_lifecycle check (
    (status = 'promoted' and promoted_at is not null)
    or (status <> 'promoted' and promoted_at is null)
  )
);
create index campus_event_waitlist_queue_idx
  on public.campus_event_waitlist (event_id, joined_at, user_id)
  where status = 'waiting';
alter table public.campus_event_waitlist enable row level security;
revoke all on table public.campus_event_waitlist from public, anon, authenticated;
create trigger campus_event_waitlist_reject_deletion_locked_mutation
before insert or update or delete on public.campus_event_waitlist
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
    'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H', 'EVENT_WAITLIST_PROMOTED'
  )),
  add constraint user_notifications_metadata_safe check (
    (
      notification_type = 'CONTACT_REVEAL_COMPLETED'
      and metadata ? 'channel' and metadata->>'channel' in ('telegram', 'instagram', 'linkedin')
      and metadata - 'channel' = '{}'::jsonb
    )
    or (
      notification_type in (
        'CIRCLE_MEMBER_JOINED', 'CIRCLE_UPDATED', 'CIRCLE_ARCHIVED',
        'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED', 'EVENT_CANCELLED',
        'EVENT_WAITLIST_PROMOTED'
      )
      and metadata ? 'title' and jsonb_typeof(metadata->'title') = 'string'
      and char_length(metadata->>'title') between 1 and 100
      and metadata - 'title' = '{}'::jsonb
    )
    or (
      notification_type in ('EVENT_SCHEDULE_CHANGED', 'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H')
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
        'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED', 'MEETING_PLAN_CANCELLED'
      ) and metadata = '{}'::jsonb
    )
  );

create or replace function public.join_campus_event_waitlist(p_public_slug text)
returns integer
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); event public.campus_events%rowtype;
  going_count integer; actor_campus text;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501'; end if;
  select * into event from public.campus_events candidate
  where candidate.public_slug = p_public_slug for update;
  select profile.campus into actor_campus from public.profiles profile
  where profile.user_id = actor;
  if event.id is null or event.status <> 'scheduled'
    or event.starts_at <= timezone('utc', now()) or event.organizer_user_id = actor
    or (event.scope = 'campus' and event.campus_scope <> actor_campus)
    or not public.is_campus_event_student(event.organizer_user_id)
    or exists (
      select 1 from public.campus_event_rsvps existing
      where existing.event_id = event.id and existing.user_id = actor
        and existing.status = 'going'
    )
    or public.users_are_blocked(actor, event.organizer_user_id) then
    raise exception 'event unavailable' using errcode = 'P0001'; end if;
  select count(*)::integer into going_count from public.campus_event_rsvps rsvp
  where rsvp.event_id = event.id and rsvp.status = 'going';
  if going_count < event.capacity then raise exception 'event has capacity' using errcode = 'P0001'; end if;
  insert into public.campus_event_waitlist (event_id, user_id, status, joined_at)
  values (event.id, actor, 'waiting', timezone('utc', now()))
  on conflict (event_id, user_id) do update set status = 'waiting',
    joined_at = case when campus_event_waitlist.status = 'waiting'
      then campus_event_waitlist.joined_at else timezone('utc', now()) end,
    promoted_at = null, updated_at = timezone('utc', now());
  return (
    select count(*)::integer
    from public.campus_event_waitlist waiting
    join public.campus_event_waitlist mine
      on mine.event_id = waiting.event_id and mine.user_id = actor
    where waiting.event_id = event.id and waiting.status = 'waiting'
      and (
        waiting.joined_at < mine.joined_at
        or (waiting.joined_at = mine.joined_at and waiting.user_id <= mine.user_id)
      )
  );
end; $$;

create or replace function public.leave_campus_event_waitlist(p_public_slug text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  update public.campus_event_waitlist waiting set status = 'left',
    updated_at = timezone('utc', now())
  from public.campus_events event
  where waiting.event_id = event.id and event.public_slug = p_public_slug
    and waiting.user_id = actor and waiting.status = 'waiting';
  return found;
end; $$;

create or replace function public.get_my_campus_event_waitlist_position(
  p_public_slug text
)
returns integer
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); v_event_id uuid; v_joined_at timestamptz;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select event.id, mine.joined_at into v_event_id, v_joined_at
  from public.campus_events event
  join public.campus_event_waitlist mine on mine.event_id = event.id
  where event.public_slug = p_public_slug
    and mine.user_id = actor and mine.status = 'waiting';
  if v_event_id is null then return null; end if;
  return (
    select count(*)::integer
    from public.campus_event_waitlist waiting
    where waiting.event_id = v_event_id and waiting.status = 'waiting'
      and (
        waiting.joined_at < v_joined_at
        or (waiting.joined_at = v_joined_at and waiting.user_id <= actor)
      )
  );
end; $$;

create or replace function public.promote_campus_event_waitlist(p_event_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare event public.campus_events%rowtype; next_user uuid; going_count integer;
  next_joined_at timestamptz; candidate record; joined_active integer;
begin
  select * into event from public.campus_events candidate
  where candidate.id = p_event_id for update;
  if event.id is null or event.status <> 'scheduled'
    or event.starts_at <= timezone('utc', now())
    or not public.is_campus_event_student(event.organizer_user_id)
    then return null; end if;
  select count(*)::integer into going_count from public.campus_event_rsvps rsvp
  where rsvp.event_id = event.id and rsvp.status = 'going';
  if going_count >= event.capacity then return null; end if;
  for candidate in
    select waiting.user_id, waiting.joined_at
    from public.campus_event_waitlist waiting
    join public.profiles candidate_profile
      on candidate_profile.user_id = waiting.user_id
    where waiting.event_id = event.id and waiting.status = 'waiting'
      and public.is_campus_event_student(waiting.user_id)
      and (
        event.scope = 'open'
        or event.campus_scope = candidate_profile.campus
      )
      and not public.users_are_blocked(waiting.user_id, event.organizer_user_id)
      and not exists (
        select 1 from public.campus_event_rsvps existing
        where existing.event_id = event.id
          and existing.user_id = waiting.user_id
          and existing.status = 'going'
      )
    order by waiting.joined_at, waiting.user_id
    for update of waiting skip locked
  loop
    perform pg_advisory_xact_lock(hashtextextended(
      candidate.user_id::text || ':event-rsvp-quota', 0
    ));
    select count(*)::integer into joined_active
    from public.campus_event_rsvps active_rsvp
    join public.campus_events active_event on active_event.id = active_rsvp.event_id
    where active_rsvp.user_id = candidate.user_id
      and active_rsvp.status = 'going'
      and active_event.status = 'scheduled'
      and active_event.starts_at > timezone('utc', now());
    if joined_active < public.event_membership_limit(
      public.effective_membership_plan(candidate.user_id),
      'joined_events_active'
    ) then
      next_user := candidate.user_id;
      next_joined_at := candidate.joined_at;
      exit;
    end if;
  end loop;
  if next_user is null then return null; end if;
  insert into public.campus_event_rsvps (event_id, user_id, status, rsvped_at, cancelled_at)
  values (event.id, next_user, 'going', timezone('utc', now()), null)
  on conflict (event_id, user_id) do update set status = 'going',
    rsvped_at = timezone('utc', now()), cancelled_at = null;
  update public.campus_event_waitlist set status = 'promoted',
    promoted_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where event_id = event.id and user_id = next_user;
  perform public.emit_user_notification(
    next_user, 'EVENT_WAITLIST_PROMOTED', '/app/events/' || event.public_slug,
    jsonb_build_object('title', public.notification_safe_label(event.title, 100, 'Campus Event')),
    'event_waitlist_promoted:' || event.id::text || ':' || next_user::text
      || ':' || extract(epoch from next_joined_at)::text
  );
  return next_user;
end; $$;

create or replace function public.notify_event_waitlist_slot()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'going' and new.status = 'cancelled' then
    perform public.promote_campus_event_waitlist(new.event_id);
  end if;
  return new;
end; $$;
create trigger campus_event_rsvps_promote_waitlist
after update of status on public.campus_event_rsvps
for each row execute function public.notify_event_waitlist_slot();

create or replace function public.sync_campus_event_waitlist_lifecycle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare available_slots integer; promoted integer := 0;
begin
  if new.status <> 'scheduled' then
    update public.campus_event_waitlist
    set status = 'cancelled', promoted_at = null,
        updated_at = timezone('utc', now())
    where event_id = new.id and status = 'waiting';
    return new;
  end if;
  if old.status = 'scheduled' and new.capacity > old.capacity then
    select greatest(new.capacity - count(*)::integer, 0) into available_slots
    from public.campus_event_rsvps rsvp
    where rsvp.event_id = new.id and rsvp.status = 'going';
    while promoted < available_slots loop
      exit when public.promote_campus_event_waitlist(new.id) is null;
      promoted := promoted + 1;
    end loop;
  end if;
  return new;
end; $$;
create trigger campus_events_sync_waitlist_lifecycle
after update of status, capacity on public.campus_events
for each row execute function public.sync_campus_event_waitlist_lifecycle();

revoke all on function public.join_campus_event_waitlist(text) from public, anon;
grant execute on function public.join_campus_event_waitlist(text) to authenticated;
revoke all on function public.leave_campus_event_waitlist(text) from public, anon;
grant execute on function public.leave_campus_event_waitlist(text) to authenticated;
revoke all on function public.get_my_campus_event_waitlist_position(text)
  from public, anon;
grant execute on function public.get_my_campus_event_waitlist_position(text)
  to authenticated;
revoke all on function public.promote_campus_event_waitlist(uuid)
  from public, anon, authenticated;
revoke all on function public.notify_event_waitlist_slot()
  from public, anon, authenticated;
revoke all on function public.sync_campus_event_waitlist_lifecycle()
  from public, anon, authenticated;
