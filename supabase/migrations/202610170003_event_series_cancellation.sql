-- Event Series cancellation controls. Forward-only migration.
-- Reuses the existing single-event cancellation path so audit and notifications stay consistent.

create or replace function public.cancel_campus_event_series_sessions(
  p_public_slug text,
  p_scope text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target public.campus_events%rowtype;
  candidate record;
  cancelled_count integer := 0;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_scope not in ('following', 'all') then
    raise exception 'invalid series cancellation scope' using errcode = '22023';
  end if;
  select event.* into target
  from public.campus_events event
  where event.public_slug = p_public_slug
  for update;
  if target.id is null or target.series_id is null
    or not public.event_can_manage_registrations(target.id, actor) then
    raise exception 'event series unavailable' using errcode = '42501';
  end if;

  for candidate in
    select event.public_slug
    from public.campus_events event
    where event.series_id = target.series_id
      and event.status = 'scheduled'
      and event.starts_at > timezone('utc', now())
      and (
        p_scope = 'all'
        or event.series_position >= target.series_position
      )
    order by event.series_position asc
    for update
  loop
    if public.cancel_campus_event(candidate.public_slug) then
      cancelled_count := cancelled_count + 1;
    end if;
  end loop;

  if cancelled_count = 0 then
    raise exception 'no upcoming series sessions' using errcode = '22023';
  end if;
  return cancelled_count;
end;
$$;

revoke all on function public.cancel_campus_event_series_sessions(text, text)
  from public, anon;
grant execute on function public.cancel_campus_event_series_sessions(text, text)
  to authenticated;
