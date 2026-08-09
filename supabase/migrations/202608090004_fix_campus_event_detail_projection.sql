-- Forward-only fix for the deployed Campus Events detail projection.
-- Keep the RETURNS TABLE order aligned with RETURN QUERY.

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
    target.status,
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

revoke all on function public.get_campus_event(text) from public, anon;
grant execute on function public.get_campus_event(text) to authenticated;
