-- Expand the event category allowlist with formats commonly used by
-- student communities while preserving all existing category values.

set local lock_timeout = '5s';

alter table public.campus_events
  drop constraint if exists campus_events_category_allowed;

alter table public.campus_events
  add constraint campus_events_category_allowed check (
    category in (
      'study_together', 'coding_tech', 'design', 'languages', 'thesis',
      'exam_prep', 'workshop', 'discussion', 'networking', 'community',
      'seminar', 'meetup', 'hackathon', 'other'
    )
  ) not valid;

alter table public.campus_events
  validate constraint campus_events_category_allowed;

create or replace function public.update_campus_event(
  p_public_slug text, p_title text, p_description text, p_category text,
  p_starts_at_local text, p_ends_at_local text, p_timezone_name text,
  p_venue_category text, p_venue_name text, p_venue_area text, p_city text,
  p_capacity integer, p_confirms_public_place boolean,
  p_confirms_expected_operating boolean, p_confirms_not_private_residence boolean,
  p_confirms_no_private_location_disclosure boolean,
  p_registration_mode text, p_waitlist_enabled boolean,
  p_registration_closes_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  normalized_title text := public.normalize_campus_event_single_line(p_title);
  normalized_description text := public.normalize_campus_event_body(p_description);
  normalized_venue_name text := public.normalize_campus_event_single_line(p_venue_name);
  normalized_venue_area text := public.normalize_campus_event_single_line(p_venue_area);
  normalized_city text := public.normalize_campus_event_single_line(p_city);
  start_value timestamptz;
  end_value timestamptz;
  going_count integer;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug for update;
  if event_row.id is null or event_row.organizer_user_id <> actor
    or event_row.status <> 'scheduled'
    or event_row.starts_at <= timezone('utc', now()) + interval '2 hours' then
    raise exception 'event unavailable' using errcode = 'P0001';
  end if;
  if not public.consume_campus_event_rate_limit(actor, 'edit_day', 20, 86400) then
    raise exception 'event edit rate limited' using errcode = 'P0001';
  end if;
  if p_timezone_name not in ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')
    or p_starts_at_local !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'
    or p_ends_at_local !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then
    raise exception 'invalid event time' using errcode = '22023';
  end if;
  start_value := p_starts_at_local::timestamp at time zone p_timezone_name;
  end_value := p_ends_at_local::timestamp at time zone p_timezone_name;
  if start_value < timezone('utc', now()) + interval '2 hours'
    or start_value > timezone('utc', now()) + interval '180 days'
    or end_value - start_value not between interval '30 minutes' and interval '12 hours'
  then raise exception 'invalid event time' using errcode = '22023'; end if;
  if char_length(normalized_title) not between 5 and 100
    or char_length(normalized_description) not between 20 and 1000
    or char_length(normalized_venue_name) not between 3 and 120
    or char_length(normalized_venue_area) not between 8 and 240
    or char_length(normalized_city) not between 2 and 100
    or p_category not in (
      'study_together', 'coding_tech', 'design', 'languages', 'thesis',
      'exam_prep', 'workshop', 'discussion', 'networking', 'community',
      'seminar', 'meetup', 'hackathon', 'other'
    )
    or p_venue_category not in (
      'campus_public_area', 'cafe', 'library', 'coworking_space',
      'community_space', 'other_public_place'
    )
    or p_capacity not between 3 and 200
    or p_registration_mode not in ('instant', 'approval')
    or p_waitlist_enabled is null
    or (p_registration_closes_at is not null
      and (
        p_registration_closes_at <= timezone('utc', now())
        or p_registration_closes_at > start_value
      )) then
    raise exception 'invalid event settings' using errcode = '22023';
  end if;
  if p_confirms_public_place is distinct from true
    or p_confirms_expected_operating is distinct from true
    or p_confirms_not_private_residence is distinct from true
    or p_confirms_no_private_location_disclosure is distinct from true
    or public.campus_event_has_private_venue(
      normalized_venue_name || ' ' || normalized_venue_area
    ) then raise exception 'safety confirmation required' using errcode = '22023'; end if;
  select count(*)::integer into going_count from public.campus_event_rsvps rsvp
  where rsvp.event_id = event_row.id and rsvp.status = 'going';
  if p_capacity < going_count then
    raise exception 'capacity below attendees' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.campus_event_rsvps attendee
    where attendee.event_id = event_row.id
      and attendee.user_id <> event_row.organizer_user_id
      and attendee.status = 'going'
  ) and (
    start_value <> event_row.starts_at or end_value <> event_row.ends_at
    or p_timezone_name <> event_row.timezone_name
    or p_venue_category <> event_row.venue_category
    or normalized_venue_name <> event_row.venue_name
    or normalized_venue_area <> event_row.venue_area
    or normalized_city <> event_row.city
  ) then raise exception 'schedule venue locked after rsvp' using errcode = 'P0001'; end if;
  update public.campus_events
  set title = normalized_title, description = normalized_description,
    category = p_category, starts_at = start_value, ends_at = end_value,
    timezone_name = p_timezone_name, venue_category = p_venue_category,
    venue_name = normalized_venue_name, venue_area = normalized_venue_area,
    city = normalized_city, capacity = p_capacity,
    registration_mode = p_registration_mode,
    waitlist_enabled = p_waitlist_enabled,
    registration_closes_at = p_registration_closes_at,
    safety_confirmed_at = timezone('utc', now())
  where id = event_row.id;
  while (select count(*) from public.campus_event_rsvps rsvp
    where rsvp.event_id = event_row.id and rsvp.status = 'going') < p_capacity
  loop
    exit when public.promote_campus_event_waitlisted_rsvp(event_row.id) is null;
  end loop;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (event_row.id, actor, 'updated');
end;
$$;

create or replace function public.create_campus_event(
  p_title text, p_description text, p_category text, p_scope text,
  p_starts_at_local text, p_ends_at_local text, p_timezone_name text,
  p_venue_category text, p_venue_name text, p_venue_area text, p_city text,
  p_capacity integer, p_confirms_public_place boolean,
  p_confirms_expected_operating boolean, p_confirms_not_private_residence boolean,
  p_confirms_no_private_location_disclosure boolean,
  p_registration_mode text, p_waitlist_enabled boolean,
  p_registration_closes_at timestamptz default null
)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); actor_campus text; new_id uuid; new_slug text;
  start_value timestamptz; end_value timestamptz;
  normalized_title text := public.normalize_campus_event_single_line(p_title);
  normalized_description text := public.normalize_campus_event_body(p_description);
  normalized_venue_name text := public.normalize_campus_event_single_line(p_venue_name);
  normalized_venue_area text := public.normalize_campus_event_single_line(p_venue_area);
  normalized_city text := public.normalize_campus_event_single_line(p_city);
begin
  if not public.is_event_organizer_eligible(actor) then
    raise exception 'organizer eligibility required' using errcode = '42501'; end if;
  if p_timezone_name not in ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')
    or p_starts_at_local !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'
    or p_ends_at_local !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then
    raise exception 'invalid event time' using errcode = '22023'; end if;
  start_value := p_starts_at_local::timestamp at time zone p_timezone_name;
  end_value := p_ends_at_local::timestamp at time zone p_timezone_name;
  if start_value < timezone('utc', now()) + interval '2 hours'
    or start_value > timezone('utc', now()) + interval '180 days'
    or end_value - start_value not between interval '30 minutes' and interval '12 hours'
  then raise exception 'invalid event time' using errcode = '22023'; end if;
  if char_length(normalized_title) not between 5 and 100
    or char_length(normalized_description) not between 20 and 1000
    or char_length(normalized_venue_name) not between 3 and 120
    or char_length(normalized_venue_area) not between 8 and 240
    or char_length(normalized_city) not between 2 and 100
    or p_category not in (
      'study_together', 'coding_tech', 'design', 'languages', 'thesis',
      'exam_prep', 'workshop', 'discussion', 'networking', 'community',
      'seminar', 'meetup', 'hackathon', 'other'
    ) or p_scope not in ('open', 'campus')
    or p_venue_category not in (
      'campus_public_area', 'cafe', 'library', 'coworking_space',
      'community_space', 'other_public_place'
    ) or p_capacity not between 3 and 200
    or p_registration_mode not in ('instant', 'approval')
    or p_waitlist_enabled is null
    or (p_registration_closes_at is not null
      and (
        p_registration_closes_at <= timezone('utc', now())
        or p_registration_closes_at > start_value
      )) then
    raise exception 'invalid event settings' using errcode = '22023'; end if;
  if p_confirms_public_place is distinct from true
    or p_confirms_expected_operating is distinct from true
    or p_confirms_not_private_residence is distinct from true
    or p_confirms_no_private_location_disclosure is distinct from true then
    raise exception 'safety confirmation required' using errcode = '22023'; end if;
  if public.campus_event_has_private_venue(
    normalized_venue_name || ' ' || normalized_venue_area
  ) then raise exception 'private venue blocked' using errcode = '22023'; end if;
  if not public.consume_campus_event_rate_limit(actor, 'create_day', 2, 86400) then
    raise exception 'event creation rate limited' using errcode = 'P0001'; end if;
  select profile.campus into actor_campus from public.profiles profile
  where profile.user_id = actor for update;
  insert into public.campus_events (
    organizer_user_id, title, description, category, scope, campus_scope,
    starts_at, ends_at, timezone_name, venue_category, venue_name,
    venue_area, city, capacity, safety_confirmed_at,
    registration_mode, waitlist_enabled, registration_closes_at
  ) values (
    actor, normalized_title, normalized_description, p_category, p_scope,
    case when p_scope = 'campus' then actor_campus else null end,
    start_value, end_value, p_timezone_name, p_venue_category,
    normalized_venue_name, normalized_venue_area, normalized_city,
    p_capacity, timezone('utc', now()), p_registration_mode,
    p_waitlist_enabled, p_registration_closes_at
  ) returning id, public_slug into new_id, new_slug;
  insert into public.campus_event_rsvps (
    event_id, user_id, status, public_id
  ) values (new_id, actor, 'going', encode(extensions.gen_random_bytes(16), 'hex'));
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (new_id, actor, 'created');
  return new_slug;
end; $$;
