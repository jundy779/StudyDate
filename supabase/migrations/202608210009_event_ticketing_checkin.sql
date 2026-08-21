-- Opaque Event tickets and self/organizer check-in. Check-in is attendance only.

create table public.campus_event_tickets (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  event_id uuid not null references public.campus_events (id) on delete cascade,
  user_id uuid null references auth.users (id) on delete set null,
  ticket_hash text not null unique check (ticket_hash ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz null,
  checked_in_at timestamptz null,
  checked_in_by uuid null references auth.users (id) on delete set null,
  constraint campus_event_tickets_public_id check (public_id ~ '^[0-9a-f]{32}$'),
  constraint campus_event_tickets_lifecycle check (
    (revoked_at is null or revoked_at >= issued_at)
    and (
      checked_in_at is null
      or (checked_in_at >= issued_at and revoked_at is null)
    )
  )
);
create unique index campus_event_tickets_active_user_idx
  on public.campus_event_tickets (event_id, user_id)
  where revoked_at is null and user_id is not null;
alter table public.campus_event_tickets enable row level security;
revoke all on table public.campus_event_tickets from public, anon, authenticated;
create trigger campus_event_tickets_reject_deletion_locked_mutation
before insert or update or delete on public.campus_event_tickets
for each row execute function public.reject_account_deletion_locked_mutation();

create or replace function public.get_my_campus_event_ticket_state(p_public_slug text)
returns table (
  status text, issued_at timestamptz, checked_in_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); v_event_id uuid;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'event participation required' using errcode = '42501';
  end if;
  select event.id into v_event_id
  from public.campus_events event
  join public.campus_event_rsvps rsvp on rsvp.event_id = event.id
  where event.public_slug = p_public_slug
    and rsvp.user_id = actor and rsvp.status = 'going';
  if v_event_id is null then return; end if;
  return query
  select case
      when ticket.checked_in_at is not null then 'checked_in'
      when ticket.revoked_at is not null then 'revoked'
      else 'issued'
    end,
    ticket.issued_at, ticket.checked_in_at
  from public.campus_event_tickets ticket
  where ticket.event_id = v_event_id and ticket.user_id = actor
  order by ticket.issued_at desc
  limit 1;
end; $$;

create or replace function public.issue_my_campus_event_ticket(p_public_slug text)
returns table (ticket_public_id text, ticket_token text)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); v_event_id uuid; v_ticket_id uuid; raw_token text;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'event participation required' using errcode = '42501';
  end if;
  select event.id into v_event_id from public.campus_events event
  join public.campus_event_rsvps rsvp on rsvp.event_id = event.id
  where event.public_slug = p_public_slug and event.status = 'scheduled'
    and event.ends_at > timezone('utc', now())
    and rsvp.user_id = actor and rsvp.status = 'going';
  if v_event_id is null then raise exception 'event participation required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    v_event_id::text || ':' || actor::text || ':event-ticket', 0
  ));
  select existing.id into v_ticket_id from public.campus_event_tickets existing
  where existing.event_id = v_event_id and existing.user_id = actor
    and existing.revoked_at is null;
  if v_ticket_id is not null then
    raise exception 'ticket already issued' using errcode = 'P0001';
  end if;
  update public.campus_event_tickets
  set user_id = null
  where event_id = v_event_id and user_id = actor and revoked_at is not null;
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.campus_event_tickets (event_id, user_id, ticket_hash)
  values (v_event_id, actor, encode(extensions.digest(raw_token, 'sha256'), 'hex'))
  returning id into v_ticket_id;
  return query select existing.public_id, raw_token
  from public.campus_event_tickets existing where existing.id = v_ticket_id;
end; $$;

create or replace function public.check_in_campus_event_ticket(
  p_event_public_slug text, p_ticket_token text
)
returns text
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); event public.campus_events%rowtype;
  ticket public.campus_event_tickets%rowtype;
begin
  select * into event from public.campus_events candidate
  where candidate.public_slug = p_event_public_slug;
  if actor is null or not public.is_campus_event_student(actor)
    or event.id is null or event.organizer_user_id is distinct from actor
    or event.status <> 'scheduled'
    or timezone('utc', now()) < event.starts_at - interval '2 hours'
    or timezone('utc', now()) > event.ends_at + interval '2 hours'
    or p_ticket_token !~ '^[0-9a-f]{64}$' then
    raise exception 'check-in unavailable' using errcode = '42501'; end if;
  select * into ticket from public.campus_event_tickets candidate
  where candidate.event_id = event.id
    and candidate.ticket_hash = encode(extensions.digest(p_ticket_token, 'sha256'), 'hex')
  for update;
  if ticket.id is null or ticket.revoked_at is not null then
    raise exception 'ticket unavailable' using errcode = 'P0001'; end if;
  if ticket.user_id is null
    or not public.is_campus_event_student(ticket.user_id)
    or not exists (
      select 1 from public.campus_event_rsvps rsvp
      where rsvp.event_id = event.id and rsvp.user_id = ticket.user_id
        and rsvp.status = 'going'
    ) then
    raise exception 'ticket unavailable' using errcode = 'P0001';
  end if;
  if ticket.checked_in_at is not null then return 'duplicate'; end if;
  update public.campus_event_tickets set checked_in_at = timezone('utc', now()),
    checked_in_by = actor where id = ticket.id;
  return 'checked_in';
end; $$;

create or replace function public.revoke_campus_event_ticket()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'campus_event_rsvps'
    and old.status = 'going' and new.status <> 'going' then
    update public.campus_event_tickets
    set revoked_at = coalesce(revoked_at, timezone('utc', now()))
    where event_id = new.event_id and user_id = new.user_id
      and revoked_at is null and checked_in_at is null;
  elsif tg_table_name = 'campus_events'
    and old.status = 'scheduled' and new.status <> 'scheduled' then
    update public.campus_event_tickets
    set revoked_at = coalesce(revoked_at, timezone('utc', now()))
    where event_id = new.id and revoked_at is null and checked_in_at is null;
  end if;
  return new;
end; $$;

create trigger campus_event_rsvps_revoke_ticket
after update of status on public.campus_event_rsvps
for each row execute function public.revoke_campus_event_ticket();
create trigger campus_events_revoke_tickets
after update of status on public.campus_events
for each row execute function public.revoke_campus_event_ticket();

create or replace function public.cleanup_event_roadmap_profile_data()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notification_preferences where user_id = old.user_id;
  delete from public.campus_event_waitlist where user_id = old.user_id;
  delete from public.campus_event_reminder_receipts where user_id = old.user_id;
  update public.campus_event_circle_links set linked_by = null
  where linked_by = old.user_id;
  update public.campus_event_tickets
  set revoked_at = case
      when checked_in_at is null then coalesce(revoked_at, timezone('utc', now()))
      else revoked_at
    end,
    user_id = null
  where user_id = old.user_id;
  return old;
end; $$;
create trigger profiles_cleanup_event_roadmap_data
after delete on public.profiles
for each row execute function public.cleanup_event_roadmap_profile_data();

revoke all on function public.issue_my_campus_event_ticket(text) from public, anon;
grant execute on function public.issue_my_campus_event_ticket(text) to authenticated;
revoke all on function public.get_my_campus_event_ticket_state(text) from public, anon;
grant execute on function public.get_my_campus_event_ticket_state(text) to authenticated;
revoke all on function public.check_in_campus_event_ticket(text, text) from public, anon;
grant execute on function public.check_in_campus_event_ticket(text, text) to authenticated;
revoke all on function public.revoke_campus_event_ticket()
  from public, anon, authenticated;
revoke all on function public.cleanup_event_roadmap_profile_data()
  from public, anon, authenticated;

comment on table public.campus_event_tickets is
  'Opaque attendance tickets. Check-in is not live location, safety monitoring, identity reveal, or proof of safety.';
