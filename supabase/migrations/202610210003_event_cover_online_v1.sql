-- Event cover and online events v1.
--
-- 1. Acara online dan hybrid. Acara online memakai kategori tempat 'online'
--    (tanpa konfirmasi tempat publik, karena tidak ada lokasi fisik). Link rapat
--    disimpan di tabel privat terpisah dan hanya dibuka untuk penyelenggara, tim
--    acara, dan peserta yang sudah terdaftar. Acara hybrid = tempat fisik + link.
-- 2. Foto sampul acara. File disimpan di bucket publik 'event-covers' dengan nama
--    acak, ditulis hanya oleh server (service role). Database menyimpan path-nya.
-- 3. RPC media acara untuk daftar acara: sampul dan mode kehadiran.

-- ---------------------------------------------------------------------------
-- 1. Kategori tempat 'online'
-- ---------------------------------------------------------------------------

alter table public.campus_events
  drop constraint if exists campus_events_venue_category_allowed;
alter table public.campus_events
  add constraint campus_events_venue_category_allowed check (venue_category in (
    'campus_public_area', 'cafe', 'library', 'coworking_space',
    'community_space', 'other_public_place', 'online'
  ));

create or replace function public.create_campus_event(p_title text, p_description text, p_category text, p_scope text, p_starts_at_local text, p_ends_at_local text, p_timezone_name text, p_venue_category text, p_venue_name text, p_venue_area text, p_city text, p_capacity integer, p_confirms_public_place boolean, p_confirms_expected_operating boolean, p_confirms_not_private_residence boolean, p_confirms_no_private_location_disclosure boolean, p_registration_mode text, p_waitlist_enabled boolean, p_registration_closes_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 set search_path = ''
AS $$
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
      'community_space', 'other_public_place', 'online'
    ) or p_capacity not between 3 and 200
    or p_registration_mode not in ('instant', 'approval')
    or p_waitlist_enabled is null
    or (p_registration_closes_at is not null
      and (
        p_registration_closes_at <= timezone('utc', now())
        or p_registration_closes_at > start_value
      )) then
    raise exception 'invalid event settings' using errcode = '22023'; end if;
  -- Acara online tidak punya lokasi fisik, jadi konfirmasi tempat publik tidak berlaku.
  if p_venue_category <> 'online' and (
    p_confirms_public_place is distinct from true
    or p_confirms_expected_operating is distinct from true
    or p_confirms_not_private_residence is distinct from true
    or p_confirms_no_private_location_disclosure is distinct from true
  ) then
    raise exception 'safety confirmation required' using errcode = '22023'; end if;
  if p_venue_category <> 'online' and public.campus_event_has_private_venue(
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

create or replace function public.update_campus_event(p_public_slug text, p_title text, p_description text, p_category text, p_starts_at_local text, p_ends_at_local text, p_timezone_name text, p_venue_category text, p_venue_name text, p_venue_area text, p_city text, p_capacity integer, p_confirms_public_place boolean, p_confirms_expected_operating boolean, p_confirms_not_private_residence boolean, p_confirms_no_private_location_disclosure boolean, p_registration_mode text, p_waitlist_enabled boolean, p_registration_closes_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 set search_path = ''
AS $$
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
      'community_space', 'other_public_place', 'online'
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
  if p_venue_category <> 'online' and (
    p_confirms_public_place is distinct from true
    or p_confirms_expected_operating is distinct from true
    or p_confirms_not_private_residence is distinct from true
    or p_confirms_no_private_location_disclosure is distinct from true
    or public.campus_event_has_private_venue(
      normalized_venue_name || ' ' || normalized_venue_area
    )
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

-- ---------------------------------------------------------------------------
-- 2. Link acara online (privat)
-- ---------------------------------------------------------------------------

create or replace function public.campus_event_meeting_url_allowed(p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_url is not null
    and char_length(p_url) between 12 and 500
    and p_url ~ '^https://[^\s<>"]+$'
    and (
      lower(substring(p_url from '^https://([^/?#:@]+)')) = any (array[
    'zoom.us', 'meet.google.com', 'teams.microsoft.com', 'teams.live.com',
    'youtube.com', 'www.youtube.com', 'youtu.be', 'webex.com', 'meet.jit.si'
  ])
      or lower(substring(p_url from '^https://([^/?#:@]+)')) ~ '^[a-z0-9-]+\.(zoom\.us|webex\.com)$'
    );
$$;

revoke all on function public.campus_event_meeting_url_allowed(text)
  from public, anon, authenticated;

create table if not exists public.campus_event_online_links (
  event_id uuid primary key references public.campus_events (id) on delete cascade,
  meeting_url text not null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null references auth.users (id) on delete set null,
  constraint campus_event_online_links_url_allowed
    check (public.campus_event_meeting_url_allowed(meeting_url))
);

alter table public.campus_event_online_links enable row level security;
revoke all on table public.campus_event_online_links from public, anon, authenticated;

drop trigger if exists campus_event_online_links_reject_deletion_locked_mutation
  on public.campus_event_online_links;
create trigger campus_event_online_links_reject_deletion_locked_mutation
before insert or update or delete on public.campus_event_online_links
for each row execute function public.reject_account_deletion_locked_mutation();

create or replace function public.can_manage_campus_event_content(
  p_event_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campus_events event
    where event.id = p_event_id and event.organizer_user_id = p_user_id
  ) or public.is_event_team_member(p_event_id, p_user_id, array['cohost']::text[]);
$$;

revoke all on function public.can_manage_campus_event_content(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.set_campus_event_online_link(
  p_public_slug text,
  p_meeting_url text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  clean_url text := nullif(btrim(coalesce(p_meeting_url, '')), '');
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_row.id is null
    or event_row.status <> 'scheduled'
    or not public.can_manage_campus_event_content(event_row.id, actor) then
    raise exception 'event management required' using errcode = '42501';
  end if;

  if clean_url is null then
    delete from public.campus_event_online_links link where link.event_id = event_row.id;
    return false;
  end if;
  if not public.campus_event_meeting_url_allowed(clean_url) then
    raise exception 'invalid meeting url' using errcode = '22023';
  end if;

  insert into public.campus_event_online_links (event_id, meeting_url, updated_at, updated_by)
  values (event_row.id, clean_url, timezone('utc', now()), actor)
  on conflict (event_id) do update set
    meeting_url = excluded.meeting_url,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;
  return true;
end;
$$;

revoke all on function public.set_campus_event_online_link(text, text) from public, anon;
grant execute on function public.set_campus_event_online_link(text, text) to authenticated;

-- Link hanya dibuka untuk penyelenggara, tim acara, dan peserta berstatus 'going'.
create or replace function public.get_campus_event_online_link(p_public_slug text)
returns table (has_link boolean, meeting_url text, can_view boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  link_row public.campus_event_online_links%rowtype;
  allowed boolean;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_row.id is null then return; end if;

  allowed := public.can_manage_campus_event_content(event_row.id, actor)
    or public.is_event_team_member(event_row.id, actor, array['checkin_staff']::text[])
    or exists (
      select 1 from public.campus_event_rsvps rsvp
      where rsvp.event_id = event_row.id
        and rsvp.user_id = actor
        and rsvp.status = 'going'
    );
  if not allowed and not public.can_view_listed_campus_event(event_row.id, actor) then
    return;
  end if;

  select * into link_row from public.campus_event_online_links link
  where link.event_id = event_row.id;

  return query select
    link_row.event_id is not null,
    case when allowed and event_row.status = 'scheduled' then link_row.meeting_url else null end,
    allowed;
end;
$$;

revoke all on function public.get_campus_event_online_link(text) from public, anon;
grant execute on function public.get_campus_event_online_link(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Foto sampul acara
-- ---------------------------------------------------------------------------

alter table public.campus_events
  add column if not exists cover_path text null;

alter table public.campus_events
  drop constraint if exists campus_events_cover_path_format;
alter table public.campus_events
  add constraint campus_events_cover_path_format check (
    cover_path is null
    or (
      cover_path ~ '^[0-9a-f]{24}/[0-9a-f]{32}\.webp$'
      and split_part(cover_path, '/', 1) = substring(public_slug from 7)
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-covers', 'event-covers', true, 2097152, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Mengganti sampul. Mengembalikan path lama supaya server bisa menghapus filenya.
create or replace function public.set_campus_event_cover(
  p_public_slug text,
  p_cover_path text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  previous text;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug
  for update;
  if event_row.id is null
    or event_row.status <> 'scheduled'
    or not public.can_manage_campus_event_content(event_row.id, actor) then
    raise exception 'event management required' using errcode = '42501';
  end if;
  if p_cover_path is not null and (
    p_cover_path !~ '^[0-9a-f]{24}/[0-9a-f]{32}\.webp$'
    or split_part(p_cover_path, '/', 1) <> substring(event_row.public_slug from 7)
  ) then
    raise exception 'invalid cover path' using errcode = '22023';
  end if;
  if not public.consume_campus_event_rate_limit(actor, 'edit_day', 30, 86400) then
    raise exception 'rate limited' using errcode = 'P0001';
  end if;

  previous := event_row.cover_path;
  update public.campus_events
  set cover_path = p_cover_path, updated_at = timezone('utc', now())
  where id = event_row.id;
  return previous;
end;
$$;

revoke all on function public.set_campus_event_cover(text, text) from public, anon;
grant execute on function public.set_campus_event_cover(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Media acara untuk daftar dan halaman detail
-- ---------------------------------------------------------------------------

create or replace function public.get_campus_event_media(p_public_slugs text[])
returns table (public_slug text, cover_path text, attendance_mode text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_public_slugs is null or cardinality(p_public_slugs) > 50 then
    raise exception 'invalid event list' using errcode = '22023';
  end if;

  return query
  select event.public_slug, event.cover_path,
    case
      when event.venue_category = 'online' then 'online'
      when link.event_id is not null then 'hybrid'
      else 'offline'
    end
  from public.campus_events event
  left join public.campus_event_online_links link on link.event_id = event.id
  where event.public_slug = any (p_public_slugs)
    and (
      public.can_view_listed_campus_event(event.id, actor)
      or event.organizer_user_id = actor
      or public.is_event_team_member(event.id, actor, array['cohost', 'checkin_staff']::text[])
      or exists (
        select 1 from public.campus_event_rsvps rsvp
        where rsvp.event_id = event.id and rsvp.user_id = actor
      )
    );
end;
$$;

revoke all on function public.get_campus_event_media(text[]) from public, anon;
grant execute on function public.get_campus_event_media(text[]) to authenticated;
