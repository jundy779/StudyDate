-- Keep admission ticketed even when a sold-out type is later hidden.
create or replace function public.campus_event_requires_ticket_order(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campus_event_ticket_types ticket
    where ticket.event_id = p_event_id
      and ticket.status in ('on_sale', 'paused', 'ended')
  ) or exists (
    select 1 from public.campus_event_ticket_orders orders
    where orders.event_id = p_event_id and orders.status in ('pending', 'paid', 'free')
  );
$$;

create or replace function public.guard_campus_event_ticket_terms()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.quantity_reserved + old.quantity_sold > 0
    and (new.price_amount is distinct from old.price_amount
      or new.access_type is distinct from old.access_type
      or new.status in ('draft', 'archived')) then
    raise exception 'ticket terms locked after reservation' using errcode = 'P0001';
  end if;
  return new;
end; $$;

drop trigger campus_event_ticket_price_locked on public.campus_event_ticket_types;
create trigger campus_event_ticket_terms_locked
before update on public.campus_event_ticket_types
for each row execute function public.guard_campus_event_ticket_terms();

revoke all on function public.guard_campus_event_ticket_terms() from public, anon, authenticated;
