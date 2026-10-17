-- Event Series v2. Forward-only migration; apply only after verifying the target project.
-- Groups independently managed campus events without exposing private participant data.

create table public.campus_event_series (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique
    default ('series-' || encode(extensions.gen_random_bytes(12), 'hex')),
  organizer_user_id uuid not null references auth.users (id) on delete cascade,
  cadence text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint campus_event_series_public_id_format check (
    public_id ~ '^series-[0-9a-f]{24}$'
  ),
  constraint campus_event_series_cadence_allowed check (
    cadence in ('weekly', 'monthly')
  )
);

create index campus_event_series_organizer_idx
  on public.campus_event_series (organizer_user_id, created_at desc);

alter table public.campus_event_series enable row level security;
revoke all on table public.campus_event_series from public, anon, authenticated;

create trigger campus_event_series_set_updated_at
before update on public.campus_event_series
for each row execute function public.set_updated_at();

alter table public.campus_events
  add column series_id uuid null
    references public.campus_event_series (id) on delete set null,
  add column series_position smallint null,
  add constraint campus_events_series_consistency check (
    (series_id is null and series_position is null)
    or (series_id is not null and series_position between 1 and 12)
  );

create unique index campus_events_series_position_unique
  on public.campus_events (series_id, series_position)
  where series_id is not null;
create index campus_events_series_schedule_idx
  on public.campus_events (series_id, starts_at)
  where series_id is not null;

create or replace function public.attach_campus_event_series(
  p_public_slugs text[],
  p_cadence text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  safe_slugs text[];
  series_row public.campus_event_series%rowtype;
  matched_count integer;
begin
  if actor is null or not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_cadence not in ('weekly', 'monthly')
    or coalesce(array_length(p_public_slugs, 1), 0) not between 2 and 12 then
    raise exception 'invalid event series' using errcode = '22023';
  end if;

  select array_agg(distinct slug order by slug) into safe_slugs
  from unnest(p_public_slugs) as slug
  where slug ~ '^event-[0-9a-f]{24}$';
  if coalesce(array_length(safe_slugs, 1), 0)
    <> array_length(p_public_slugs, 1) then
    raise exception 'invalid event series' using errcode = '22023';
  end if;

  select count(*)::integer into matched_count
  from public.campus_events event
  where event.public_slug = any(safe_slugs)
    and event.organizer_user_id = actor
    and event.status = 'scheduled'
    and event.series_id is null;
  if matched_count <> array_length(safe_slugs, 1) then
    raise exception 'event series unavailable' using errcode = '42501';
  end if;

  insert into public.campus_event_series (organizer_user_id, cadence)
  values (actor, p_cadence)
  returning * into series_row;

  update public.campus_events event
  set series_id = series_row.id,
      series_position = ordered.position
  from (
    select source.public_slug,
      row_number() over (order by source.starts_at, source.public_slug)::smallint
        as position
    from public.campus_events source
    where source.public_slug = any(safe_slugs)
  ) ordered
  where event.public_slug = ordered.public_slug;

  return series_row.public_id;
end;
$$;

create or replace function public.list_campus_event_series_sessions(
  p_public_slug text
)
returns table (
  series_public_id text,
  cadence text,
  public_slug text,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  series_position integer
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
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select event.* into target
  from public.campus_events event
  where event.public_slug = p_public_slug;
  if target.id is null or target.series_id is null
    or not (
      target.organizer_user_id = actor
      or public.event_can_manage_registrations(target.id, actor)
    ) then
    return;
  end if;

  return query
  select series.public_id, series.cadence, event.public_slug, event.title,
    event.starts_at, event.ends_at, event.status,
    event.series_position::integer
  from public.campus_event_series series
  join public.campus_events event on event.series_id = series.id
  where series.id = target.series_id
  order by event.series_position asc;
end;
$$;

revoke all on function public.attach_campus_event_series(text[], text)
  from public, anon;
grant execute on function public.attach_campus_event_series(text[], text)
  to authenticated;
revoke all on function public.list_campus_event_series_sessions(text)
  from public, anon;
grant execute on function public.list_campus_event_series_sessions(text)
  to authenticated;
