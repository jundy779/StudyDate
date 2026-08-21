-- Campus Event Free/Plus product quotas. Security rate limits remain unchanged.

create or replace function public.event_membership_limit(p_plan text, p_key text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_plan = 'plus' and p_key = 'created_events_active' then 5
    when p_plan = 'plus' and p_key = 'joined_events_active' then 10
    when p_key = 'created_events_active' then 2
    when p_key = 'joined_events_active' then 5
    else 0
  end;
$$;
revoke all on function public.event_membership_limit(text, text)
  from public, anon, authenticated;

create or replace function public.enforce_campus_event_membership_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare active_owned integer; plan text;
begin
  if new.status <> 'scheduled' or new.starts_at <= timezone('utc', now()) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'scheduled'
    and old.starts_at > timezone('utc', now()) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    new.organizer_user_id::text || ':event-owner-quota', 0
  ));
  plan := public.effective_membership_plan(new.organizer_user_id);
  select count(*)::integer into active_owned
  from public.campus_events event
  where event.organizer_user_id = new.organizer_user_id
    and event.status = 'scheduled'
    and event.starts_at > timezone('utc', now())
    and event.id <> new.id;
  if active_owned >= public.event_membership_limit(plan, 'created_events_active') then
    raise exception 'event ownership quota reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger campus_events_membership_quota
before insert or update of status, starts_at on public.campus_events
for each row execute function public.enforce_campus_event_membership_quota();

create or replace function public.enforce_campus_event_rsvp_membership_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare joined_count integer; plan text; event_row public.campus_events%rowtype;
begin
  if new.status <> 'going'
    or (tg_op = 'UPDATE' and old.status = 'going') then return new; end if;
  select * into event_row from public.campus_events event where event.id = new.event_id;
  if event_row.organizer_user_id = new.user_id then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    new.user_id::text || ':event-rsvp-quota', 0
  ));
  plan := public.effective_membership_plan(new.user_id);
  select count(*)::integer into joined_count
  from public.campus_event_rsvps rsvp
  join public.campus_events event on event.id = rsvp.event_id
  where rsvp.user_id = new.user_id and rsvp.status = 'going'
    and event.status = 'scheduled' and event.starts_at > timezone('utc', now())
    and rsvp.id <> new.id;
  if joined_count >= public.event_membership_limit(plan, 'joined_events_active') then
    raise exception 'event attendance quota reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger campus_event_rsvps_membership_quota
before insert or update of status on public.campus_event_rsvps
for each row execute function public.enforce_campus_event_rsvp_membership_quota();

revoke all on function public.enforce_campus_event_membership_quota()
  from public, anon, authenticated;
revoke all on function public.enforce_campus_event_rsvp_membership_quota()
  from public, anon, authenticated;
