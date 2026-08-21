-- Optional association between one Campus Event and one organizer-owned Study Circle.

create table public.campus_event_circle_links (
  event_id uuid primary key references public.campus_events (id) on delete cascade,
  circle_id uuid not null references public.study_circles (id) on delete cascade,
  linked_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (circle_id, event_id)
);
alter table public.campus_event_circle_links enable row level security;
revoke all on table public.campus_event_circle_links from public, anon, authenticated;
create trigger campus_event_circle_links_reject_deletion_locked_mutation
before insert or update or delete on public.campus_event_circle_links
for each row execute function public.reject_account_deletion_locked_mutation();

create or replace function public.list_my_circle_options_for_event()
returns table (public_slug text, name text)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  return query select circle.public_slug, circle.name
  from public.study_circles circle
  where circle.owner_user_id = actor and circle.status = 'active'
  order by circle.name;
end; $$;

create or replace function public.set_campus_event_circle(
  p_event_public_slug text, p_circle_public_slug text
)
returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); v_event_id uuid; v_circle_id uuid;
begin
  select event.id into v_event_id from public.campus_events event
  where event.public_slug = p_event_public_slug
    and event.organizer_user_id = actor and event.status = 'scheduled';
  if v_event_id is null then raise exception 'event unavailable' using errcode = '42501'; end if;
  if p_circle_public_slug is null then
    delete from public.campus_event_circle_links link where link.event_id = v_event_id;
    return;
  end if;
  select circle.id into v_circle_id from public.study_circles circle
  where circle.public_slug = p_circle_public_slug
    and circle.owner_user_id = actor and circle.status = 'active';
  if v_circle_id is null then raise exception 'circle unavailable' using errcode = '42501'; end if;
  insert into public.campus_event_circle_links (event_id, circle_id, linked_by)
  values (v_event_id, v_circle_id, actor)
  on conflict (event_id) do update
    set circle_id = excluded.circle_id, linked_by = actor,
        created_at = timezone('utc', now());
end; $$;

create or replace function public.get_campus_event_circle(p_event_public_slug text)
returns table (circle_public_slug text, circle_name text)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  return query select circle.public_slug, circle.name
  from public.campus_events event
  join public.campus_event_circle_links link on link.event_id = event.id
  join public.study_circles circle on circle.id = link.circle_id
  where event.public_slug = p_event_public_slug
    and circle.status = 'active'
    and (
      event.organizer_user_id = actor
      or exists (
        select 1 from public.campus_event_rsvps event_membership
        where event_membership.event_id = event.id
          and event_membership.user_id = actor
      )
      or (
        event.status = 'scheduled'
        and event.starts_at > timezone('utc', now())
        and public.is_campus_event_student(event.organizer_user_id)
        and not public.users_are_blocked(actor, event.organizer_user_id)
        and (
          event.scope = 'open'
          or event.campus_scope = (
            select profile.campus from public.profiles profile
            where profile.user_id = actor
          )
        )
      )
    )
    and (
      circle.scope = 'open'
      or exists (
        select 1 from public.study_circle_memberships membership
        where membership.circle_id = circle.id and membership.user_id = actor
          and membership.status = 'active'
      )
    );
end; $$;

revoke all on function public.list_my_circle_options_for_event() from public, anon;
grant execute on function public.list_my_circle_options_for_event() to authenticated;
revoke all on function public.set_campus_event_circle(text, text) from public, anon;
grant execute on function public.set_campus_event_circle(text, text) to authenticated;
revoke all on function public.get_campus_event_circle(text) from public, anon;
grant execute on function public.get_campus_event_circle(text) to authenticated;
