-- Link a published event ticket to the existing attendance QR and manual check-in.
-- Events with no published ticket types keep the original RSVP-only flow.

create or replace function public.campus_event_requires_ticket_order(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campus_event_ticket_types ticket
    where ticket.event_id = p_event_id
      and ticket.status in ('on_sale', 'paused', 'ended')
  );
$$;

create or replace function public.campus_event_has_valid_ticket_order(p_event_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campus_event_ticket_orders orders
    where orders.event_id = p_event_id and orders.buyer_user_id = p_user_id
      and orders.status in ('free', 'paid')
  );
$$;

create or replace function public.my_campus_event_requires_ticket_order(p_public_slug text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); v_event_id uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select event.id into v_event_id from public.campus_events event
    where event.public_slug = p_public_slug;
  if v_event_id is null then return false; end if;
  return public.campus_event_requires_ticket_order(v_event_id);
end; $$;

create or replace function public.guard_campus_event_ticket_issue()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.campus_event_requires_ticket_order(new.event_id)
    and (new.user_id is null or not public.campus_event_has_valid_ticket_order(new.event_id, new.user_id)) then
    raise exception 'event ticket order required' using errcode = 'P0001';
  end if;
  return new;
end; $$;

create trigger campus_event_tickets_require_order
before insert on public.campus_event_tickets
for each row execute function public.guard_campus_event_ticket_issue();

create or replace function public.guard_campus_event_ticket_checkin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.checked_in_at is null and new.checked_in_at is not null
    and public.campus_event_requires_ticket_order(new.event_id)
    and (new.user_id is null or not public.campus_event_has_valid_ticket_order(new.event_id, new.user_id)) then
    raise exception 'event ticket order required' using errcode = 'P0001';
  end if;
  return new;
end; $$;

create trigger campus_event_rsvps_require_order_for_checkin
before update of checked_in_at on public.campus_event_rsvps
for each row execute function public.guard_campus_event_ticket_checkin();

-- A settled payment cannot silently turn into a cancelled RSVP without a refund decision.
create or replace function public.guard_paid_campus_event_rsvp_cancellation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'going' and new.status <> 'going'
    and exists (select 1 from public.campus_events event
      where event.id = new.event_id and event.status = 'scheduled')
    and exists (select 1 from public.campus_event_ticket_orders orders
      where orders.event_id = new.event_id and orders.buyer_user_id = new.user_id
        and orders.status in ('paid', 'partially_refunded')) then
    raise exception 'paid event ticket cancellation requires support' using errcode = 'P0001';
  end if;
  return new;
end; $$;

create trigger campus_event_rsvps_guard_paid_cancellation
before update of status on public.campus_event_rsvps
for each row execute function public.guard_paid_campus_event_rsvp_cancellation();

revoke all on function public.campus_event_requires_ticket_order(uuid) from public, anon, authenticated;
revoke all on function public.campus_event_has_valid_ticket_order(uuid, uuid) from public, anon, authenticated;
revoke all on function public.my_campus_event_requires_ticket_order(text) from public, anon;
grant execute on function public.my_campus_event_requires_ticket_order(text) to authenticated;
revoke all on function public.guard_campus_event_ticket_issue() from public, anon, authenticated;
revoke all on function public.guard_campus_event_ticket_checkin() from public, anon, authenticated;
revoke all on function public.guard_paid_campus_event_rsvp_cancellation() from public, anon, authenticated;
