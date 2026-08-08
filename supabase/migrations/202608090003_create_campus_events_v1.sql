-- Campus Events v1. Forward-only local migration; no remote mutation is implied.
-- Public-place events with bounded discovery, atomic RSVP capacity, and safe evidence.

create table public.campus_events (
  id uuid primary key default gen_random_uuid(),
  public_slug text not null unique
    default ('event-' || encode(extensions.gen_random_bytes(12), 'hex')),
  organizer_user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  scope text not null,
  campus_scope text null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone_name text not null,
  venue_category text not null,
  venue_name text not null,
  venue_area text not null,
  city text not null,
  capacity smallint not null,
  status text not null default 'scheduled',
  safety_confirmed_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  cancelled_at timestamptz null,
  archived_at timestamptz null,
  constraint campus_events_public_slug_format check (
    public_slug ~ '^event-[0-9a-f]{24}$'
  ),
  constraint campus_events_title_length check (
    char_length(title) between 5 and 100
  ),
  constraint campus_events_description_length check (
    char_length(description) between 20 and 1000
  ),
  constraint campus_events_plain_text check (
    title !~ '<[^>]+>' and description !~ '<[^>]+>'
    and venue_name !~ '<[^>]+>' and venue_area !~ '<[^>]+>'
    and city !~ '<[^>]+>'
  ),
  constraint campus_events_category_allowed check (
    category in (
      'study_together', 'coding_tech', 'design', 'languages', 'thesis',
      'exam_prep', 'workshop', 'discussion', 'networking', 'community', 'other'
    )
  ),
  constraint campus_events_scope_allowed check (scope in ('open', 'campus')),
  constraint campus_events_scope_consistency check (
    (scope = 'open' and campus_scope is null)
    or (scope = 'campus' and campus_scope is not null)
  ),
  constraint campus_events_time_order check (starts_at < ends_at),
  constraint campus_events_duration check (
    ends_at - starts_at between interval '30 minutes' and interval '12 hours'
  ),
  constraint campus_events_timezone_allowed check (
    timezone_name in ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')
  ),
  constraint campus_events_venue_category_allowed check (
    venue_category in (
      'campus_public_area', 'cafe', 'library', 'coworking_space',
      'community_space', 'other_public_place'
    )
  ),
  constraint campus_events_venue_name_length check (
    char_length(venue_name) between 3 and 120
  ),
  constraint campus_events_venue_area_length check (
    char_length(venue_area) between 8 and 240
  ),
  constraint campus_events_city_length check (char_length(city) between 2 and 100),
  constraint campus_events_capacity check (capacity between 3 and 30),
  constraint campus_events_status_allowed check (
    status in ('scheduled', 'cancelled', 'archived')
  ),
  constraint campus_events_lifecycle check (
    (status = 'scheduled' and cancelled_at is null and archived_at is null)
    or (status = 'cancelled' and cancelled_at is not null and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  )
);

create index campus_events_discovery_idx
  on public.campus_events (starts_at asc, public_slug asc)
  where status = 'scheduled';
create index campus_events_organizer_idx
  on public.campus_events (organizer_user_id, status, starts_at);
create index campus_events_filter_idx
  on public.campus_events (category, scope, campus_scope, starts_at)
  where status = 'scheduled';

alter table public.campus_events enable row level security;
revoke all on table public.campus_events from public, anon, authenticated;

create trigger campus_events_set_updated_at
before update on public.campus_events
for each row execute function public.set_updated_at();

create table public.campus_event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.campus_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'going',
  rsvped_at timestamptz not null default timezone('utc', now()),
  cancelled_at timestamptz null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint campus_event_rsvps_unique unique (event_id, user_id),
  constraint campus_event_rsvps_status check (status in ('going', 'cancelled')),
  constraint campus_event_rsvps_lifecycle check (
    (status = 'going' and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null)
  )
);

create index campus_event_rsvps_event_status_idx
  on public.campus_event_rsvps (event_id, status, rsvped_at);
create index campus_event_rsvps_user_status_idx
  on public.campus_event_rsvps (user_id, status, rsvped_at);

alter table public.campus_event_rsvps enable row level security;
revoke all on table public.campus_event_rsvps from public, anon, authenticated;

create trigger campus_event_rsvps_set_updated_at
before update on public.campus_event_rsvps
for each row execute function public.set_updated_at();

create table public.campus_event_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.campus_events (id) on delete cascade,
  actor_user_id uuid null references auth.users (id) on delete set null,
  event_type text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint campus_event_audit_type check (
    event_type in (
      'created', 'updated', 'rsvp_joined', 'rsvp_cancelled',
      'cancelled', 'archived', 'event_reported', 'organizer_reported'
    )
  )
);

create index campus_event_audit_event_idx
  on public.campus_event_audit_events (event_id, created_at desc);
alter table public.campus_event_audit_events enable row level security;
revoke all on table public.campus_event_audit_events
  from public, anon, authenticated;

create table public.campus_event_rate_limits (
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  hit_count integer not null default 0,
  constraint campus_event_rate_limits_pkey primary key (
    actor_user_id, bucket, window_start
  ),
  constraint campus_event_rate_limits_bucket check (
    bucket in (
      'create_day', 'rsvp_day', 'edit_day', 'report_hour', 'report_day'
    )
  ),
  constraint campus_event_rate_limits_count check (hit_count >= 0)
);

alter table public.campus_event_rate_limits enable row level security;
revoke all on table public.campus_event_rate_limits
  from public, anon, authenticated;

-- Immutable report-scoped event evidence; never attendee/chat/reveal evidence.
alter table public.user_reports
  add column campus_event_id uuid null
    references public.campus_events (id) on delete set null,
  add column campus_event_target_kind text null,
  add column campus_event_title_snapshot text null,
  add column campus_event_description_excerpt text null,
  add column campus_event_venue_category_snapshot text null,
  add column campus_event_venue_name_snapshot text null,
  add column campus_event_venue_area_snapshot text null;

alter table public.user_reports
  drop constraint user_reports_reason_allowed;
alter table public.user_reports
  add constraint user_reports_reason_allowed check (
    reason_code in (
      'harassment', 'spam', 'contact_pressure', 'fake_or_misleading',
      'unsafe_location', 'other'
    )
  ),
  add constraint user_reports_event_target_kind check (
    campus_event_target_kind is null
    or campus_event_target_kind in ('event', 'event_organizer')
  ),
  add constraint user_reports_event_context check (
    (
      campus_event_target_kind is null
      and campus_event_id is null
      and campus_event_title_snapshot is null
      and campus_event_description_excerpt is null
      and campus_event_venue_category_snapshot is null
      and campus_event_venue_name_snapshot is null
      and campus_event_venue_area_snapshot is null
    )
    or (
      campus_event_target_kind is not null
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
  ),
  add constraint user_reports_event_snapshot_lengths check (
    campus_event_title_snapshot is null
    or (
      char_length(campus_event_title_snapshot) <= 100
      and char_length(campus_event_description_excerpt) <= 280
      and char_length(campus_event_venue_name_snapshot) <= 120
      and char_length(campus_event_venue_area_snapshot) <= 240
    )
  );

create index user_reports_campus_event_idx
  on public.user_reports (campus_event_id)
  where campus_event_id is not null;

create or replace function public.is_campus_event_student(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_eligible_introduction_student(p_user_id)
    and not exists (
      select 1
      from public.profiles profile
      where profile.user_id = p_user_id
        and nullif(to_jsonb(profile)->>'deactivated_at', '') is not null
    );
$$;

create or replace function public.normalize_campus_event_single_line(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(coalesce(p_value, ''), '\s+', ' ', 'g'));
$$;

create or replace function public.normalize_campus_event_body(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text;
begin
  normalized := replace(coalesce(p_value, ''), E'\r\n', E'\n');
  normalized := replace(normalized, E'\r', E'\n');
  normalized := regexp_replace(normalized, E'[ \t]+', ' ', 'g');
  normalized := regexp_replace(normalized, E'\n{3,}', E'\n\n', 'g');
  return btrim(normalized);
end;
$$;

create or replace function public.campus_event_has_private_venue(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  value text := lower(public.normalize_campus_event_single_line(p_value));
begin
  return value ~ '(^|[^[:alnum:]_])(kos|kamar kos|rumah pribadi|apartemen pribadi|unit apartemen|kamar hotel|hotel room|private residence|private bedroom)([^[:alnum:]_]|$)';
end;
$$;

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
      'create_day', 'rsvp_day', 'edit_day', 'report_hour', 'report_day'
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

revoke all on function public.is_campus_event_student(uuid)
  from public, anon, authenticated;
revoke all on function public.normalize_campus_event_single_line(text)
  from public, anon, authenticated;
revoke all on function public.normalize_campus_event_body(text)
  from public, anon, authenticated;
revoke all on function public.campus_event_has_private_venue(text)
  from public, anon, authenticated;
revoke all on function public.consume_campus_event_rate_limit(
  uuid, text, integer, integer
) from public, anon, authenticated;

create or replace function public.list_campus_events(
  p_search text default null,
  p_category text default null,
  p_scope text default null,
  p_before_starts_at timestamptz default null,
  p_before_public_slug text default null,
  p_limit integer default 13
)
returns table (
  public_slug text, title text, description text, category text, scope text,
  campus_scope text, starts_at timestamptz, ends_at timestamptz,
  timezone_name text, venue_category text, venue_name text, venue_area text,
  city text, capacity integer, attendee_count integer, rsvp_status text,
  is_organizer boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_campus text;
  normalized_search text;
  safe_limit integer := least(greatest(coalesce(p_limit, 13), 1), 31);
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_category is not null and p_category not in (
    'study_together', 'coding_tech', 'design', 'languages', 'thesis',
    'exam_prep', 'workshop', 'discussion', 'networking', 'community', 'other'
  ) then raise exception 'invalid event category' using errcode = '22023'; end if;
  if p_scope is not null and p_scope not in ('open', 'campus') then
    raise exception 'invalid event scope' using errcode = '22023';
  end if;
  if (p_before_starts_at is null) <> (p_before_public_slug is null)
    or (p_before_public_slug is not null
      and p_before_public_slug !~ '^event-[0-9a-f]{24}$') then
    raise exception 'invalid event cursor' using errcode = '22023';
  end if;
  normalized_search := nullif(
    public.normalize_campus_event_single_line(p_search), ''
  );
  if normalized_search is not null and char_length(normalized_search) > 100 then
    raise exception 'invalid event search' using errcode = '22023';
  end if;
  select profile.campus into actor_campus
  from public.profiles profile where profile.user_id = actor;

  return query
  select event.public_slug, event.title, event.description, event.category,
    event.scope, event.campus_scope, event.starts_at, event.ends_at,
    event.timezone_name, event.venue_category, event.venue_name,
    event.venue_area, event.city, event.capacity::integer,
    (select count(*)::integer from public.campus_event_rsvps attendance
      where attendance.event_id = event.id and attendance.status = 'going'),
    own_rsvp.status, event.organizer_user_id = actor
  from public.campus_events event
  left join public.campus_event_rsvps own_rsvp
    on own_rsvp.event_id = event.id and own_rsvp.user_id = actor
  where event.status = 'scheduled'
    and event.starts_at > timezone('utc', now())
    and public.is_campus_event_student(event.organizer_user_id)
    and (event.scope = 'open' or event.campus_scope = actor_campus)
    and not public.users_are_blocked(actor, event.organizer_user_id)
    and (p_category is null or event.category = p_category)
    and (p_scope is null or event.scope = p_scope)
    and (
      normalized_search is null
      or event.title ilike '%' || normalized_search || '%'
    )
    and (
      p_before_starts_at is null
      or (event.starts_at, event.public_slug)
        > (p_before_starts_at, p_before_public_slug)
    )
  order by event.starts_at asc, event.public_slug asc
  limit safe_limit;
end;
$$;

create or replace function public.get_campus_event(p_public_slug text)
returns table (
  public_slug text, title text, description text, category text, scope text,
  campus_scope text, starts_at timestamptz, ends_at timestamptz,
  timezone_name text, venue_category text, venue_name text, venue_area text,
  city text, capacity integer, attendee_count integer, rsvp_status text,
  is_organizer boolean, organizer_alias text, organizer_is_verified boolean,
  status text, is_past boolean, can_rsvp boolean,
  can_cancel_rsvp boolean, can_edit boolean, schedule_venue_locked boolean,
  can_cancel_event boolean,
  can_archive boolean, cancelled_at timestamptz, archived_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_campus text;
  target public.campus_events%rowtype;
  own_rsvp public.campus_event_rsvps%rowtype;
  going_count integer;
  has_history boolean;
  blocked boolean;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_public_slug is null or p_public_slug !~ '^event-[0-9a-f]{24}$' then
    return;
  end if;
  select * into target from public.campus_events event
    where event.public_slug = p_public_slug;
  if target.id is null then return; end if;
  select profile.campus into actor_campus from public.profiles profile
    where profile.user_id = actor;
  select * into own_rsvp from public.campus_event_rsvps rsvp
    where rsvp.event_id = target.id and rsvp.user_id = actor;
  has_history := own_rsvp.id is not null;
  blocked := public.users_are_blocked(actor, target.organizer_user_id);
  if not public.is_campus_event_student(target.organizer_user_id)
    and target.organizer_user_id <> actor and not has_history then return; end if;
  if target.status = 'archived'
    and target.organizer_user_id <> actor and not has_history then return; end if;
  if target.scope = 'campus' and target.campus_scope <> actor_campus
    and target.organizer_user_id <> actor and not has_history then return; end if;
  if blocked and target.organizer_user_id <> actor and not has_history then return; end if;
  select count(*)::integer into going_count
    from public.campus_event_rsvps rsvp
    where rsvp.event_id = target.id and rsvp.status = 'going';

  return query select target.public_slug, target.title, target.description,
    target.category, target.scope, target.campus_scope, target.starts_at,
    target.ends_at, target.timezone_name, target.venue_category,
    target.venue_name, target.venue_area, target.city, target.capacity::integer,
    going_count, own_rsvp.status, target.organizer_user_id = actor,
    organizer_profile.public_alias,
    organizer_profile.verification_status = 'verified',
    target.ends_at <= timezone('utc', now()),
    target.status = 'scheduled' and target.starts_at > timezone('utc', now())
      and target.organizer_user_id <> actor and not blocked
      and (target.scope = 'open' or target.campus_scope = actor_campus)
      and own_rsvp.status is distinct from 'going' and going_count < target.capacity,
    own_rsvp.status = 'going' and target.organizer_user_id <> actor
      and target.status = 'scheduled'
      and target.starts_at > timezone('utc', now()),
    target.organizer_user_id = actor and target.status = 'scheduled'
      and target.starts_at > timezone('utc', now()) + interval '2 hours',
    exists (
      select 1
      from public.campus_event_rsvps attendee
      where attendee.event_id = target.id
        and attendee.user_id <> target.organizer_user_id
        and attendee.status = 'going'
    ),
    target.organizer_user_id = actor and target.status = 'scheduled'
      and target.starts_at > timezone('utc', now()),
    target.organizer_user_id = actor and target.status <> 'archived'
      and (target.status = 'cancelled' or target.ends_at <= timezone('utc', now())),
    target.cancelled_at, target.archived_at
  from public.profiles organizer_profile
  where organizer_profile.user_id = target.organizer_user_id;
end;
$$;

create or replace function public.create_campus_event(
  p_title text, p_description text, p_category text, p_scope text,
  p_starts_at_local text, p_ends_at_local text, p_timezone_name text,
  p_venue_category text, p_venue_name text, p_venue_area text, p_city text,
  p_capacity integer, p_confirms_public_place boolean,
  p_confirms_expected_operating boolean, p_confirms_not_private_residence boolean,
  p_confirms_no_private_location_disclosure boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_campus text;
  normalized_title text := public.normalize_campus_event_single_line(p_title);
  normalized_description text := public.normalize_campus_event_body(p_description);
  normalized_venue_name text := public.normalize_campus_event_single_line(p_venue_name);
  normalized_venue_area text := public.normalize_campus_event_single_line(p_venue_area);
  normalized_city text := public.normalize_campus_event_single_line(p_city);
  start_value timestamptz;
  end_value timestamptz;
  active_owned integer;
  new_id uuid;
  new_slug text;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_timezone_name not in ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')
    or p_starts_at_local !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'
    or p_ends_at_local !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then
    raise exception 'invalid event time' using errcode = '22023';
  end if;
  start_value := p_starts_at_local::timestamp at time zone p_timezone_name;
  end_value := p_ends_at_local::timestamp at time zone p_timezone_name;
  if start_value < timezone('utc', now()) + interval '2 hours' then
    raise exception 'start too soon' using errcode = '22023';
  end if;
  if start_value > timezone('utc', now()) + interval '180 days' then
    raise exception 'start too far' using errcode = '22023';
  end if;
  if end_value - start_value not between interval '30 minutes' and interval '12 hours' then
    raise exception 'invalid duration' using errcode = '22023';
  end if;
  if char_length(normalized_title) not between 5 and 100
    or char_length(normalized_description) not between 20 and 1000
    or char_length(normalized_venue_name) not between 3 and 120
    or char_length(normalized_venue_area) not between 8 and 240
    or char_length(normalized_city) not between 2 and 100
    or (normalized_title || normalized_description || normalized_venue_name
      || normalized_venue_area || normalized_city) ~ '<[^>]+>' then
    raise exception 'invalid event content' using errcode = '22023';
  end if;
  if p_category not in (
    'study_together', 'coding_tech', 'design', 'languages', 'thesis',
    'exam_prep', 'workshop', 'discussion', 'networking', 'community', 'other'
  ) or p_scope not in ('open', 'campus')
    or p_venue_category not in (
      'campus_public_area', 'cafe', 'library', 'coworking_space',
      'community_space', 'other_public_place'
    ) or p_capacity not between 3 and 30 then
    raise exception 'invalid event settings' using errcode = '22023';
  end if;
  if p_confirms_public_place is distinct from true
    or p_confirms_expected_operating is distinct from true
    or p_confirms_not_private_residence is distinct from true
    or p_confirms_no_private_location_disclosure is distinct from true then
    raise exception 'safety confirmation required' using errcode = '22023';
  end if;
  if public.campus_event_has_private_venue(
    normalized_venue_name || ' ' || normalized_venue_area
  ) then raise exception 'private venue blocked' using errcode = '22023'; end if;
  if not public.consume_campus_event_rate_limit(actor, 'create_day', 3, 86400) then
    raise exception 'event creation rate limited' using errcode = 'P0001';
  end if;
  select count(*)::integer into active_owned from public.campus_events event
    where event.organizer_user_id = actor and event.status = 'scheduled'
      and event.starts_at > timezone('utc', now());
  if active_owned >= 5 then
    raise exception 'organizer limit reached' using errcode = 'P0001';
  end if;
  select profile.campus into actor_campus from public.profiles profile
    where profile.user_id = actor for update;
  insert into public.campus_events (
    organizer_user_id, title, description, category, scope, campus_scope,
    starts_at, ends_at, timezone_name, venue_category, venue_name,
    venue_area, city, capacity, safety_confirmed_at
  ) values (
    actor, normalized_title, normalized_description, p_category, p_scope,
    case when p_scope = 'campus' then actor_campus else null end,
    start_value, end_value, p_timezone_name, p_venue_category,
    normalized_venue_name, normalized_venue_area, normalized_city, p_capacity,
    timezone('utc', now())
  ) returning id, public_slug into new_id, new_slug;
  insert into public.campus_event_rsvps (event_id, user_id, status)
    values (new_id, actor, 'going');
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (new_id, actor, 'created');
  return new_slug;
end;
$$;

create or replace function public.update_campus_event(
  p_public_slug text, p_title text, p_description text, p_category text,
  p_starts_at_local text, p_ends_at_local text, p_timezone_name text,
  p_venue_category text, p_venue_name text, p_venue_area text, p_city text,
  p_capacity integer, p_confirms_public_place boolean,
  p_confirms_expected_operating boolean, p_confirms_not_private_residence boolean,
  p_confirms_no_private_location_disclosure boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target public.campus_events%rowtype;
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
  select * into target from public.campus_events event
    where event.public_slug = p_public_slug for update;
  if target.id is null or target.organizer_user_id <> actor
    or target.status <> 'scheduled'
    or target.starts_at <= timezone('utc', now()) + interval '2 hours' then
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
  if start_value < timezone('utc', now()) + interval '2 hours' then
    raise exception 'start too soon' using errcode = '22023';
  end if;
  if start_value > timezone('utc', now()) + interval '180 days' then
    raise exception 'start too far' using errcode = '22023';
  end if;
  if end_value - start_value not between interval '30 minutes' and interval '12 hours' then
    raise exception 'invalid duration' using errcode = '22023';
  end if;
  if char_length(normalized_title) not between 5 and 100
    or char_length(normalized_description) not between 20 and 1000
    or char_length(normalized_venue_name) not between 3 and 120
    or char_length(normalized_venue_area) not between 8 and 240
    or char_length(normalized_city) not between 2 and 100
    or p_category not in (
      'study_together', 'coding_tech', 'design', 'languages', 'thesis',
      'exam_prep', 'workshop', 'discussion', 'networking', 'community', 'other'
    )
    or p_venue_category not in (
      'campus_public_area', 'cafe', 'library', 'coworking_space',
      'community_space', 'other_public_place'
    ) or p_capacity not between 3 and 30 then
    raise exception 'invalid event settings' using errcode = '22023';
  end if;
  if p_confirms_public_place is distinct from true
    or p_confirms_expected_operating is distinct from true
    or p_confirms_not_private_residence is distinct from true
    or p_confirms_no_private_location_disclosure is distinct from true then
    raise exception 'safety confirmation required' using errcode = '22023';
  end if;
  if public.campus_event_has_private_venue(
    normalized_venue_name || ' ' || normalized_venue_area
  ) then raise exception 'private venue blocked' using errcode = '22023'; end if;
  select count(*)::integer into going_count from public.campus_event_rsvps rsvp
    where rsvp.event_id = target.id and rsvp.status = 'going';
  if p_capacity < going_count then
    raise exception 'capacity below attendees' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.campus_event_rsvps attendee
    where attendee.event_id = target.id
      and attendee.user_id <> target.organizer_user_id
      and attendee.status = 'going'
  ) and (
    start_value <> target.starts_at
    or end_value <> target.ends_at
    or p_timezone_name <> target.timezone_name
    or p_venue_category <> target.venue_category
    or normalized_venue_name <> target.venue_name
    or normalized_venue_area <> target.venue_area
    or normalized_city <> target.city
  ) then
    raise exception 'schedule venue locked after rsvp' using errcode = 'P0001';
  end if;
  update public.campus_events set title = normalized_title,
    description = normalized_description, category = p_category,
    starts_at = start_value, ends_at = end_value, timezone_name = p_timezone_name,
    venue_category = p_venue_category, venue_name = normalized_venue_name,
    venue_area = normalized_venue_area, city = normalized_city,
    capacity = p_capacity, safety_confirmed_at = timezone('utc', now())
  where id = target.id;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (target.id, actor, 'updated');
end;
$$;

create or replace function public.rsvp_campus_event(p_public_slug text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_campus text;
  target public.campus_events%rowtype;
  existing public.campus_event_rsvps%rowtype;
  going_count integer;
  active_rsvps integer;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into target from public.campus_events event
    where event.public_slug = p_public_slug for update;
  select profile.campus into actor_campus from public.profiles profile
    where profile.user_id = actor;
  if target.id is null or target.status <> 'scheduled'
    or target.starts_at <= timezone('utc', now())
    or target.organizer_user_id = actor
    or not public.is_campus_event_student(target.organizer_user_id)
    or (target.scope = 'campus' and target.campus_scope <> actor_campus)
    or public.users_are_blocked(actor, target.organizer_user_id) then
    raise exception 'event unavailable' using errcode = 'P0001';
  end if;
  select * into existing from public.campus_event_rsvps rsvp
    where rsvp.event_id = target.id and rsvp.user_id = actor for update;
  if existing.status = 'going' then return false; end if;
  if not public.consume_campus_event_rate_limit(actor, 'rsvp_day', 30, 86400) then
    raise exception 'event rsvp rate limited' using errcode = 'P0001';
  end if;
  select count(*)::integer into active_rsvps
    from public.campus_event_rsvps rsvp
    join public.campus_events event on event.id = rsvp.event_id
    where rsvp.user_id = actor and rsvp.status = 'going'
      and event.status = 'scheduled' and event.starts_at > timezone('utc', now());
  if active_rsvps >= 10 then raise exception 'rsvp limit reached' using errcode = 'P0001'; end if;
  select count(*)::integer into going_count from public.campus_event_rsvps rsvp
    where rsvp.event_id = target.id and rsvp.status = 'going';
  if going_count >= target.capacity then
    raise exception 'event full' using errcode = 'P0001';
  end if;
  insert into public.campus_event_rsvps (
    event_id, user_id, status, rsvped_at, cancelled_at
  ) values (target.id, actor, 'going', timezone('utc', now()), null)
  on conflict (event_id, user_id) do update set status = 'going',
    rsvped_at = timezone('utc', now()), cancelled_at = null;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (target.id, actor, 'rsvp_joined');
  return true;
end;
$$;

create or replace function public.cancel_campus_event_rsvp(p_public_slug text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target public.campus_events%rowtype;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into target from public.campus_events event
    where event.public_slug = p_public_slug for update;
  if target.id is null or target.status <> 'scheduled'
    or target.starts_at <= timezone('utc', now()) then
    raise exception 'event unavailable' using errcode = 'P0001';
  end if;
  if target.organizer_user_id = actor then
    raise exception 'organizer rsvp required' using errcode = 'P0001';
  end if;
  if not public.consume_campus_event_rate_limit(actor, 'rsvp_day', 30, 86400) then
    raise exception 'event rsvp rate limited' using errcode = 'P0001';
  end if;
  update public.campus_event_rsvps set status = 'cancelled',
    cancelled_at = timezone('utc', now())
  where event_id = target.id and user_id = actor and status = 'going';
  if not found then return false; end if;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (target.id, actor, 'rsvp_cancelled');
  return true;
end;
$$;

create or replace function public.cancel_campus_event(p_public_slug text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target public.campus_events%rowtype;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into target from public.campus_events event
    where event.public_slug = p_public_slug for update;
  if target.id is null or target.organizer_user_id <> actor
    or target.status <> 'scheduled'
    or target.starts_at <= timezone('utc', now()) then
    raise exception 'event unavailable' using errcode = 'P0001';
  end if;
  update public.campus_events set status = 'cancelled',
    cancelled_at = timezone('utc', now()) where id = target.id;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (target.id, actor, 'cancelled');
  return true;
end;
$$;

create or replace function public.archive_campus_event(p_public_slug text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target public.campus_events%rowtype;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into target from public.campus_events event
    where event.public_slug = p_public_slug for update;
  if target.id is null or target.organizer_user_id <> actor then
    raise exception 'event unavailable' using errcode = 'P0001';
  end if;
  if target.status = 'archived' then return false; end if;
  if target.status <> 'cancelled' and target.ends_at > timezone('utc', now()) then
    raise exception 'event unavailable' using errcode = 'P0001';
  end if;
  update public.campus_events set status = 'archived',
    archived_at = timezone('utc', now()) where id = target.id;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (target.id, actor, 'archived');
  return true;
end;
$$;

create or replace function public.list_campus_event_attendees(p_public_slug text)
returns table (
  public_alias text, campus text, study_program text, semester smallint,
  interests text[], connection_goals text[], is_verified boolean,
  is_organizer boolean, rsvped_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target public.campus_events%rowtype;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into target from public.campus_events event
    where event.public_slug = p_public_slug;
  if target.id is null or (
    target.organizer_user_id <> actor and not exists (
      select 1 from public.campus_event_rsvps caller
      where caller.event_id = target.id and caller.user_id = actor
        and caller.status = 'going'
    )
  ) then raise exception 'rsvp required' using errcode = '42501'; end if;
  return query
  select profile.public_alias, profile.campus, profile.study_program,
    profile.semester, profile.interests, profile.connection_goals,
    profile.verification_status = 'verified',
    rsvp.user_id = target.organizer_user_id, rsvp.rsvped_at
  from public.campus_event_rsvps rsvp
  join public.profiles profile on profile.user_id = rsvp.user_id
  where rsvp.event_id = target.id and rsvp.status = 'going'
    and public.is_campus_event_student(rsvp.user_id)
    and (
      rsvp.user_id = actor
      or not public.users_are_blocked(actor, rsvp.user_id)
    )
  order by (rsvp.user_id = target.organizer_user_id) desc,
    rsvp.rsvped_at asc, profile.public_alias asc;
end;
$$;

create or replace function public.report_campus_event_target(
  p_public_slug text, p_target_kind text, p_reason_code text, p_details text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_campus text;
  target public.campus_events%rowtype;
  normalized_details text;
  has_history boolean;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_target_kind not in ('event', 'event_organizer')
    or p_reason_code not in (
      'harassment', 'spam', 'contact_pressure', 'fake_or_misleading',
      'unsafe_location', 'other'
    ) then raise exception 'invalid report' using errcode = '22023'; end if;
  select * into target from public.campus_events event
    where event.public_slug = p_public_slug;
  if target.id is null or target.organizer_user_id = actor then
    raise exception 'event unavailable' using errcode = 'P0001';
  end if;
  select profile.campus into actor_campus from public.profiles profile
    where profile.user_id = actor;
  select exists (
    select 1 from public.campus_event_rsvps rsvp
    where rsvp.event_id = target.id and rsvp.user_id = actor
  ) into has_history;
  if not has_history and (
    target.status = 'archived'
    or (target.scope = 'campus' and target.campus_scope <> actor_campus)
    or public.users_are_blocked(actor, target.organizer_user_id)
  ) then raise exception 'event unavailable' using errcode = 'P0001'; end if;
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
    reporter_id, subject_user_id, campus_event_id, campus_event_target_kind,
    campus_event_title_snapshot, campus_event_description_excerpt,
    campus_event_venue_category_snapshot, campus_event_venue_name_snapshot,
    campus_event_venue_area_snapshot, reason_code, details
  ) values (
    actor, target.organizer_user_id, target.id, p_target_kind, target.title,
    left(target.description, 280), target.venue_category, target.venue_name,
    target.venue_area, p_reason_code, normalized_details
  );
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (
    target.id, actor,
    case when p_target_kind = 'event' then 'event_reported'
      else 'organizer_reported' end
  );
end;
$$;

create or replace function public.report_campus_event(
  p_public_slug text, p_reason_code text, p_details text default null
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.report_campus_event_target(
    p_public_slug, 'event', p_reason_code, p_details
  );
end;
$$;

create or replace function public.report_campus_event_organizer(
  p_public_slug text, p_reason_code text, p_details text default null
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.report_campus_event_target(
    p_public_slug, 'event_organizer', p_reason_code, p_details
  );
end;
$$;

revoke all on function public.report_campus_event_target(text, text, text, text)
  from public, anon, authenticated;

-- Preserve moderation RPC signatures while adding event kinds and bounded evidence.
create or replace function public.list_moderation_reports(
  p_status text default null, p_limit integer default 50
)
returns table (
  report_id uuid, moderation_status text, reason_code text, target_kind text,
  subject_suffix text, has_details boolean, has_message_ref boolean,
  created_at timestamptz, reviewed_at timestamptz, resolved_at timestamptz,
  reviewer_suffix text
)
language plpgsql stable security definer set search_path = ''
as $$
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
end;
$$;

create or replace function public.get_moderation_report(p_report_id uuid)
returns table (
  report_id uuid, moderation_status text, reason_code text, target_kind text,
  subject_suffix text, reporter_suffix text, details text,
  conversation_public_id text, referenced_message_excerpt text,
  internal_note text, created_at timestamptz, reviewed_at timestamptz,
  resolved_at timestamptz, reviewer_suffix text
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  report public.user_reports%rowtype;
  shell public.conversation_shells%rowtype;
  evidence text;
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  select * into report from public.user_reports candidate
    where candidate.id = p_report_id;
  if report.id is null then raise exception 'report unavailable' using errcode = 'P0001'; end if;
  if report.conversation_id is not null then
    select * into shell from public.conversation_shells candidate
      where candidate.id = report.conversation_id;
  end if;
  if report.campus_event_id is not null then
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
end;
$$;

-- Client RPC grants. Helpers remain inaccessible to authenticated clients.
revoke all on function public.list_campus_events(
  text, text, text, timestamptz, text, integer
) from public, anon;
grant execute on function public.list_campus_events(
  text, text, text, timestamptz, text, integer
) to authenticated;
revoke all on function public.get_campus_event(text) from public, anon;
grant execute on function public.get_campus_event(text) to authenticated;
revoke all on function public.create_campus_event(
  text, text, text, text, text, text, text, text, text, text, text,
  integer, boolean, boolean, boolean, boolean
) from public, anon;
grant execute on function public.create_campus_event(
  text, text, text, text, text, text, text, text, text, text, text,
  integer, boolean, boolean, boolean, boolean
) to authenticated;
revoke all on function public.update_campus_event(
  text, text, text, text, text, text, text, text, text, text, text,
  integer, boolean, boolean, boolean, boolean
) from public, anon;
grant execute on function public.update_campus_event(
  text, text, text, text, text, text, text, text, text, text, text,
  integer, boolean, boolean, boolean, boolean
) to authenticated;
revoke all on function public.rsvp_campus_event(text) from public, anon;
grant execute on function public.rsvp_campus_event(text) to authenticated;
revoke all on function public.cancel_campus_event_rsvp(text) from public, anon;
grant execute on function public.cancel_campus_event_rsvp(text) to authenticated;
revoke all on function public.cancel_campus_event(text) from public, anon;
grant execute on function public.cancel_campus_event(text) to authenticated;
revoke all on function public.archive_campus_event(text) from public, anon;
grant execute on function public.archive_campus_event(text) to authenticated;
revoke all on function public.list_campus_event_attendees(text) from public, anon;
grant execute on function public.list_campus_event_attendees(text) to authenticated;
revoke all on function public.report_campus_event(text, text, text) from public, anon;
grant execute on function public.report_campus_event(text, text, text)
  to authenticated;
revoke all on function public.report_campus_event_organizer(text, text, text)
  from public, anon;
grant execute on function public.report_campus_event_organizer(text, text, text)
  to authenticated;
revoke all on function public.list_moderation_reports(text, integer)
  from public, anon;
grant execute on function public.list_moderation_reports(text, integer)
  to authenticated;
revoke all on function public.get_moderation_report(uuid) from public, anon;
grant execute on function public.get_moderation_report(uuid) to authenticated;

comment on table public.campus_events is
  'Campus Events v1. Opaque slug routes to public-place event projections.';
comment on table public.campus_event_rsvps is
  'Private RSVP history; safe attendee projection is RPC-only.';
